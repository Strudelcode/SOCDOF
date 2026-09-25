import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  Info,
  LockKeyhole,
  LogIn,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  UserRoundCog,
  X
} from 'lucide-react';
import {
  AccountType,
  adminResetPassword,
  authenticate,
  changePassword,
  clearSession,
  createUser,
  deleteUser,
  getLockoutRemaining,
  getSecuritySettings,
  getSession,
  getUserById,
  getUserByUsername,
  getUsers,
  hasUsers,
  lockSession,
  recordSessionActivity,
  resetPasswordWithRecovery,
  saveSession,
  updateSecuritySettings,
  updateUser,
  type SecuritySettings,
  type UserAccount,
  type UserRole,
  RECOVERY_QUESTIONS
} from '../lib/auth';
import {
  SUPPORTED_LANGUAGES,
  formatSystemDate,
  formatSystemTime,
  getRecoveryQuestionLabel,
  setLanguage,
  t,
  useLanguage,
  type LanguageCode,
  getDesktopLanguageFiles,
  subscribeDesktopLanguageFiles,
  syncDesktopLanguageFiles,
  getCustomLanguagePacks,
  getActiveCustomPackId,
  setActiveCustomPack,
  type DesktopLanguageFileInfo
} from '../lib/i18n';
import { sounds } from '../lib/sound';
import { db } from '../lib/db';
import type { CompanyProfile } from '../types';

const getAuthCopy = (lang: LanguageCode) => ({
  welcome: t('auth.welcome', lang),
  setup: t('auth.setup', lang),
  login: t('auth.login', lang),
  username: t('auth.username', lang),
  displayName: t('auth.displayName', lang),
  password: t('auth.password', lang),
  confirm: t('auth.confirm', lang),
  account: t('auth.account', lang),
  personal: t('auth.personal', lang),
  business: t('auth.business', lang),
  create: t('auth.create', lang),
  invalid: t('auth.invalid', lang),
  inactive: t('auth.inactive', lang),
  locked: t('auth.locked', lang),
  retry: t('auth.retry', lang),
  short: t('auth.short', lang),
  mismatch: t('auth.mismatch', lang),
  exists: t('auth.exists', lang),
  required: t('auth.required', lang),
  lock: t('auth.lock', lang),
  logout: t('auth.logout', lang),
  switchUser: t('auth.switchUser', lang),
  otherUser: t('auth.otherUser', lang),
  otherUserDesc: t('auth.otherUserDesc', lang),
  unlock: t('auth.unlock', lang),
  lockedTitle: t('auth.lockedTitle', lang),
  lockedDesc: t('auth.lockedDesc', lang),
  users: t('auth.users', lang),
  add: t('auth.add', lang),
  role: t('auth.role', lang),
  admin: t('auth.admin', lang),
  user: t('auth.user', lang),
  active: t('auth.active', lang),
  disabled: t('auth.disabled', lang),
  deactivate: t('auth.deactivate', lang),
  activate: t('auth.activate', lang),
  remove: t('auth.remove', lang),
  passwordChange: t('auth.passwordChange', lang),
  newPassword: t('auth.newPassword', lang),
  save: t('auth.save', lang),
  close: t('auth.close', lang),
  current: t('auth.current', lang),
  manage: t('auth.manage', lang),
  lastAdmin: t('auth.lastAdmin', lang),
  resetDone: t('auth.resetDone', lang),
  forgot: t('auth.forgot', lang),
  recover: t('auth.recover', lang),
  recoveryQuestion: t('auth.recoveryQuestion', lang),
  recoveryAnswer: t('auth.recoveryAnswer', lang),
  recoveryRequired: t('auth.recoveryRequired', lang),
  recoveryInvalid: t('auth.recoveryInvalid', lang),
  recoveryUnavailable: t('auth.recoveryUnavailable', lang),
  backLogin: t('auth.backLogin', lang),
  newPasswordTitle: t('auth.newPasswordTitle', lang),
  avatar: t('auth.avatar', lang),
  autoLock: t('auth.autoLock', lang),
  off: t('auth.off', lang),
  minutes: t('auth.minutes', lang),
  profileSaved: t('auth.profileSaved', lang),
  security: t('auth.security', lang),
  threshold: t('auth.threshold', lang),
  lockoutDuration: t('auth.lockoutDuration', lang),
  backoff: t('auth.backoff', lang),
  enabled: t('auth.enabled', lang),
  securitySaved: t('auth.securitySaved', lang),
  forcePassword: t('auth.forcePassword', lang),
  clock: t('auth.clock', lang),
  shortcut: t('auth.shortcut', lang),
});

type AuthText = ReturnType<typeof getAuthCopy>;
const fieldClass = 'w-full rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white scheme-light dark:scheme-dark px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/40';
const avatars = ['●', '◆', '▲', '■', '✦', '✚', '◉', '⬢'];

function computePasswordStrength(password: string): {
  score: number;
  labelKey: string;
  colorClass: string;
  percent: number;
} {
  if (!password) {
    return { score: 0, labelKey: '', colorClass: 'bg-slate-200 dark:bg-white/10', percent: 0 };
  }

  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;

  if (password.length < 6) {
    return { score: 1, labelKey: 'auth.strength.veryWeak', colorClass: 'bg-rose-500', percent: 20 };
  }
  if (points <= 2) {
    return { score: 2, labelKey: 'auth.strength.weak', colorClass: 'bg-amber-500', percent: 40 };
  }
  if (points === 3) {
    return { score: 3, labelKey: 'auth.strength.medium', colorClass: 'bg-yellow-500', percent: 65 };
  }
  if (points === 4) {
    return { score: 4, labelKey: 'auth.strength.strong', colorClass: 'bg-emerald-500', percent: 85 };
  }
  return { score: 5, labelKey: 'auth.strength.veryStrong', colorClass: 'bg-emerald-600', percent: 100 };
}

export function AuthGate({ children, company }: { children: React.ReactNode; company: CompanyProfile }) {
  const [users, setUsers] = useState<UserAccount[]>(() => getUsers());
  const [languageReady, setLanguageReady] = useState(() => typeof localStorage === 'undefined' || localStorage.getItem('socdof_language_initialized') === 'true');
  const [onboardingLanguageChosen, setOnboardingLanguageChosen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);
  const [preselectedUsername, setPreselectedUsername] = useState<string | null>(null);
  const [session, setSession] = useState(() => getSession());
  const lang = useLanguage();
  const [locked, setLocked] = useState(() => Boolean(getSession()?.locked));
  const refresh = useCallback(() => { setUsers(getUsers()); const current = getSession(); setSession(current); setLocked(Boolean(current?.locked)); }, []);
  const currentUser = session ? getUserById(session.userId) : null;
  const text = getAuthCopy(lang);

  useEffect(() => { const onStorage = () => refresh(); window.addEventListener('storage', onStorage); window.addEventListener('socdof-auth-changed', onStorage); return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('socdof-auth-changed', onStorage); }; }, [refresh]);
  useEffect(() => {
    const handleDesktopAuthAction = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === 'lock') {
        lockSession();
        setLocked(true);
      } else if (action === 'logout' || action === 'switch-user') {
        clearSession();
        setSession(null);
        setLocked(false);
      }
    };
    window.addEventListener('socdof-desktop-auth-action', handleDesktopAuthAction as EventListener);
    return () => window.removeEventListener('socdof-desktop-auth-action', handleDesktopAuthAction as EventListener);
  }, []);
  useEffect(() => {
    if (!session || locked) return;
    const activity = () => { recordSessionActivity(); };
    const events = ['mousedown', 'keydown', 'pointerdown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    const timer = window.setInterval(() => {
      const current = getSession();
      const user = current ? getUserById(current.userId) : null;
      const minutes = user?.preferences.autoLockMinutes ?? 15;
      if (current && !current.locked && minutes > 0 && Date.now() - current.lastActivityAt >= minutes * 60_000) {
        lockSession();
        setLocked(true);
      }
    }, 10_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, activity));
      window.clearInterval(timer);
    };
  }, [session, locked]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l' && getSession() && !locked) { event.preventDefault(); lockSession(); setLocked(true); } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [locked]);

  const login = async (username: string, password: string) => {
    const startedAt = Date.now();
    const result = await authenticate(username, password);
    if (!result.ok) { refresh(); return { ok: false as const, reason: result.reason, retryAt: result.retryAt }; }
    const remaining = Math.max(0, 2200 - (Date.now() - startedAt));
    if (remaining > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
    setSession(result.session);
    setLocked(false);
    setUsers(getUsers());
    return { ok: true as const };
  };
  const logout = () => { clearSession(); setSession(null); setLocked(false); };

  if (!languageReady || (!hasUsers() && !onboardingLanguageChosen)) {
    return (
      <LanguageSelectionScreen
        isFirstRunOnboarding={!hasUsers()}
        onSelected={() => {
          setLanguageReady(true);
          setOnboardingLanguageChosen(true);
        }}
      />
    );
  }
  if (!hasUsers()) {
    return (
      <FirstAccount
        text={text}
        initialCompany={company}
        onCreated={(username) => {
          setUsers(getUsers());
          setPreselectedUsername(username);
          setCreatedNotice(t('auth.accountCreatedSuccess', lang));
        }}
      />
    );
  }
  if (!session || !currentUser) {
    return (
      <LoginScreen
        text={text}
        users={users}
        company={company}
        onLogin={login}
        initialSuccessMessage={createdNotice}
        initialUsername={preselectedUsername}
        onDismissSuccess={() => setCreatedNotice(null)}
      />
    );
  }
  if (currentUser.mustChangePassword) return <ForcedPasswordScreen text={text} user={currentUser} onDone={refresh} onLogout={logout} />;
  if (locked) return <LockScreen text={text} user={currentUser} users={users} company={company} onUnlock={login} onSwitch={logout} />;
  return <div className="relative w-full h-full">{children}</div>;
}

function LanguageSelectionScreen({
  onSelected,
  isFirstRunOnboarding = false,
}: {
  onSelected: () => void;
  isFirstRunOnboarding?: boolean;
}) {
  const lang = useLanguage();
  const [desktopFiles, setDesktopFiles] = useState<DesktopLanguageFileInfo[]>(() => getDesktopLanguageFiles());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(() => getActiveCustomPackId() || lang || 'en');

  useEffect(() => {
    // Initial sync check
    syncDesktopLanguageFiles();
    const unsub = subscribeDesktopLanguageFiles((files) => {
      setDesktopFiles(files);
    });
    return unsub;
  }, []);

  const availableLanguages = useMemo(() => {
    const list: Array<{
      id: string;
      code: string;
      codeBadge: string;
      name: string;
      subtitle: string;
      isCustom?: boolean;
      flagImage?: string | null;
      emoji?: string | null;
    }> = [
      { id: 'en', code: 'en', codeBadge: 'US', name: 'English', subtitle: 'English (US/UK)' },
      { id: 'de', code: 'de', codeBadge: 'DE', name: 'Deutsch', subtitle: 'German' },
      { id: 'fr', code: 'fr', codeBadge: 'FR', name: 'Français', subtitle: 'French' },
      { id: 'es', code: 'es', codeBadge: 'ES', name: 'Español', subtitle: 'Spanish' }
    ];

    // Add discovered files from languages/ directory
    desktopFiles.forEach(file => {
      // Exclude template files
      if (file.filename.toLowerCase().startsWith('template')) return;
      // Exclude if already in built-in
      const rawCode = (file.language_code || file.id || '').toLowerCase();
      if (['en', 'de', 'fr', 'es'].includes(rawCode) && file.id === rawCode) return;

      const codeBadge = (file.language_code || file.id || 'LG').slice(0, 3).toUpperCase();
      const displayName = file.title || file.language_name || file.filename.replace(/\.json$/i, '');
      const subtitle = file.filename;

      list.push({
        id: `desktop_file_${file.id}`,
        code: file.language_code || file.id,
        codeBadge,
        name: displayName,
        subtitle: `${subtitle} (${file.count.toLocaleString()} keys)`,
        isCustom: true,
        flagImage: file.flagImage,
        emoji: file.emoji
      });
    });

    // Also include any custom packs stored in localStorage that aren't already included
    const customPacks = getCustomLanguagePacks();
    customPacks.forEach(pack => {
      if (list.some(item => item.id === pack.id || item.id === `desktop_file_${pack.id}`)) return;
      list.push({
        id: pack.id,
        code: pack.code,
        codeBadge: pack.code.slice(0, 3).toUpperCase(),
        name: pack.name,
        subtitle: `${pack.count.toLocaleString()} keys`,
        isCustom: true,
        flagImage: pack.flagImage,
        emoji: pack.emoji
      });
    });

    return list;
  }, [desktopFiles]);

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableLanguages;
    return availableLanguages.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.codeBadge.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [availableLanguages, searchQuery]);

  const handleSelect = (itemId: string) => {
    setSelectedId(itemId);
    sounds.playClick();
    if (itemId.startsWith('desktop_file_') || itemId.startsWith('custom_')) {
      setActiveCustomPack(itemId);
    } else {
      setActiveCustomPack(null);
      setLanguage(itemId as LanguageCode);
    }
  };

  const handleContinue = () => {
    sounds.playSuccess();
    if (selectedId.startsWith('desktop_file_') || selectedId.startsWith('custom_')) {
      setActiveCustomPack(selectedId);
    } else {
      setActiveCustomPack(null);
      setLanguage(selectedId as LanguageCode);
    }
    try {
      localStorage.setItem('socdof_language_initialized', 'true');
    } catch {}
    onSelected();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/70 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/70 p-4 sm:p-6 flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md my-auto rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white backdrop-blur-2xl shadow-2xl p-6 sm:p-7 flex flex-col h-[610px] max-h-[calc(100vh-2rem)]">
        {/* Header with icon and step badge */}
        <div className="shrink-0 mb-3.5">
          <div className="flex items-center justify-between mb-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Globe size={24} />
            </div>
            {isFirstRunOnboarding && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/20 shrink-0">
                {t('auth.stepLanguage', lang)}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
            {t('lang_modal.title', lang)}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed h-11 flex items-start overflow-hidden">
            {t('lang_modal.subtitle', lang)}
          </p>
        </div>

        {/* Search bar when over 10 languages are present */}
        {availableLanguages.length > 10 && (
          <div className="relative mb-3 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('lang_modal.search_placeholder', lang, 'Sprache suchen (Name oder Code)...')}
              className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                title="Clear"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Language List */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
          {filteredLanguages.map((language) => {
            const isSelected = selectedId === language.id;
            return (
              <button
                key={language.id}
                type="button"
                onClick={() => handleSelect(language.id)}
                className={`w-full flex items-center gap-3 rounded-2xl border px-3.5 h-[68px] min-h-[68px] max-h-[68px] text-left transition-all cursor-pointer select-none shrink-0 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-500/15 ring-2 ring-indigo-500/25 shadow-xs'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="w-12 h-11 rounded-xl bg-slate-100 dark:bg-white/10 font-bold text-sm tracking-wider flex items-center justify-center text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-white/10 shrink-0 select-none overflow-hidden">
                  {language.flagImage ? (
                    <img src={language.flagImage} alt="" className="w-7 h-5 object-cover rounded shadow-xs" />
                  ) : language.emoji && language.emoji.length > 0 && language.emoji !== '🏳️' ? (
                    <span className="text-xl leading-none">{language.emoji}</span>
                  ) : (
                    <span>{language.codeBadge}</span>
                  )}
                </div>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-slate-900 dark:text-white truncate">
                    {language.name}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                    {language.subtitle}
                  </span>
                </span>
                {isSelected && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-600 text-white shadow-xs shrink-0 whitespace-nowrap animate-fade-in">
                    {t('lang_modal.current_selected', lang, 'Active Selection')}
                  </span>
                )}
              </button>
            );
          })}
          {filteredLanguages.length === 0 && (
            <div className="text-center py-6 px-3 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
              <Globe className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t('lang_modal.no_search_results', lang, 'Keine passende Sprache gefunden')}
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
              >
                {t('lang_modal.reset_search', lang, 'Suche zurücksetzen')}
              </button>
            </div>
          )}
        </div>

        {/* Continue Button */}
        <button
          type="button"
          onClick={handleContinue}
          className="w-full mt-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white h-12 font-bold transition shadow-lg shadow-indigo-600/25 cursor-pointer text-sm sm:text-base active:scale-[0.99] shrink-0 flex items-center justify-center"
        >
          {t('auth.continue', lang)}
        </button>
      </div>
    </div>
  );
}

function FirstAccount({
  text,
  initialCompany,
  onCreated,
}: {
  text: AuthText;
  initialCompany?: CompanyProfile;
  onCreated: (createdUsername: string) => void;
}) {
  const lang = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
    confirm: '',
    accountType: 'personal' as AccountType,
    avatar: '',
    questionMode: RECOVERY_QUESTIONS[0] as string,
    customQuestion: '',
    recoveryAnswer: '',
  });

  const [businessDetails, setBusinessDetails] = useState({
    companyName: initialCompany?.name && initialCompany?.name !== 'Ihr Firmenname' && initialCompany?.name !== 'SOCDOF' ? initialCompany.name : '',
    street: initialCompany?.street || '',
    zipCity: initialCompany?.zip_city || '',
    currency: initialCompany?.currency || '€',
    email: initialCompany?.email || '',
    phone: initialCompany?.phone || '',
    managingDirector: initialCompany?.letterhead_managing_director || '',
    taxId: initialCompany?.tax_id || '',
  });
  const [isBusinessSetupSkipped, setIsBusinessSetupSkipped] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = computePasswordStrength(form.password);

  const handleAvatarFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setForm((prev) => ({ ...prev, avatar: canvas.toDataURL('image/jpeg', 0.85) }));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.username.trim() || !form.displayName.trim() || !form.password) {
      return setError(text.required);
    }
    if (form.password.length < 8) {
      return setError(text.short);
    }
    if (form.password !== form.confirm) {
      return setError(text.mismatch);
    }

    let recoveryQuestion: string | undefined = undefined;
    let recoveryAnswer: string | undefined = undefined;

    if (form.questionMode !== 'none') {
      if (form.questionMode === 'custom') {
        if (!form.customQuestion.trim()) {
          return setError(t('auth.recoveryRequired', lang));
        }
        recoveryQuestion = form.customQuestion.trim();
      } else {
        recoveryQuestion = form.questionMode;
      }

      if (!form.recoveryAnswer.trim()) {
        return setError(t('auth.recoveryRequired', lang));
      }
      recoveryAnswer = form.recoveryAnswer.trim();
    }

    setIsSubmitting(true);
    setError('');

    try {
      await createUser({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
        accountType: form.accountType,
        avatar: form.avatar ? form.avatar : undefined,
        recoveryQuestion,
        recoveryAnswer,
        autoLogin: false,
      });

      if (form.accountType === 'business' && !isBusinessSetupSkipped) {
        try {
          const settingRecord = await db.settings.get('company_profile');
          const currentCompany: CompanyProfile = (settingRecord?.value as CompanyProfile) || initialCompany || ({} as CompanyProfile);
          const updatedCompany: CompanyProfile = {
            ...currentCompany,
            name: businessDetails.companyName.trim() || currentCompany.name || '',
            street: businessDetails.street.trim() || currentCompany.street || '',
            zip_city: businessDetails.zipCity.trim() || currentCompany.zip_city || '',
            currency: businessDetails.currency.trim() || currentCompany.currency || '€',
            email: businessDetails.email.trim() || currentCompany.email || '',
            phone: businessDetails.phone.trim() || currentCompany.phone || '',
            letterhead_managing_director: businessDetails.managingDirector.trim() || currentCompany.letterhead_managing_director || '',
            tax_id: businessDetails.taxId.trim() || currentCompany.tax_id || '',
          };
          await db.settings.put({ key: 'company_profile', value: updatedCompany });
          window.dispatchEvent(new CustomEvent('socdof-company-updated', { detail: updatedCompany }));
        } catch (compErr) {
          console.error('Failed to update company profile from onboarding:', compErr);
        }
      }

      clearSession();
      onCreated(form.username.trim());
    } catch (err) {
      setIsSubmitting(false);
      const reason = String((err as Error).message);
      setError(
        reason === 'password_too_short'
          ? text.short
          : reason === 'username_exists'
          ? text.exists
          : reason === 'recovery_answer_required'
          ? text.recoveryRequired
          : text.required
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/70 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/70 p-3 sm:p-6 flex min-h-screen items-center justify-center">
      <div className="w-full max-w-lg my-auto rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white backdrop-blur-2xl shadow-2xl p-5 sm:p-7 max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] overflow-y-auto">
        {/* Header with step indicator and language selector */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/20">
              {t('auth.stepAccount', lang)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              title={t('auth.changeLanguage', lang)}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-lg shadow-indigo-600/20">
            <ShieldCheck size={23} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{text.welcome}</h1>
          <div className="flex items-center justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{text.setup}</span>
            <span className="text-rose-500 font-medium">{t('auth.requiredNotice', lang)}</span>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {text.displayName} <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              autoFocus
              className={fieldClass}
              placeholder={text.displayName}
              value={form.displayName}
              onChange={(e) => {
                setForm({ ...form, displayName: e.target.value });
                setError('');
              }}
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {text.username} <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              className={fieldClass}
              placeholder={text.username}
              value={form.username}
              onChange={(e) => {
                setForm({ ...form, username: e.target.value });
                setError('');
              }}
            />
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {text.account}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, accountType: 'personal' })}
                className={`rounded-xl border p-2.5 text-left text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  form.accountType === 'personal'
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/15 ring-2 ring-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {text.personal}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, accountType: 'business' })}
                className={`rounded-xl border p-2.5 text-left text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  form.accountType === 'business'
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/15 ring-2 ring-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {text.business}
              </button>
            </div>

            {/* Optional Business Details & Letterhead Questionnaire */}
            {form.accountType === 'business' && (
              <div className="mt-3 rounded-2xl border border-indigo-200/80 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3.5 transition-all animate-fade-in shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {t('auth.business_setup_title', lang, 'Firmendaten & Briefkopf (Optional)')}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {t('auth.business_setup_desc', lang, 'Geben Sie Ihre Firmendaten für Anschriften, Rechnungen und Währung an – oder überspringen Sie diesen Schritt und passen Sie alles später in den Einstellungen an.')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBusinessSetupSkipped(!isBusinessSetupSkipped)}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer pt-0.5"
                  >
                    {isBusinessSetupSkipped
                      ? t('auth.btn_fill_business_setup', lang, 'Firmendaten jetzt angeben')
                      : t('auth.btn_skip_business_setup', lang, 'Überspringen & später einstellen')}
                  </button>
                </div>

                {isBusinessSetupSkipped ? (
                  <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between gap-3">
                    <span className="leading-tight">
                      {t('auth.business_setup_skipped_notice', lang, 'Firmendaten übersprungen. Sie können Firmenkopf, Anschrift und Währung jederzeit unter Einstellungen > Stammdaten festlegen.')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBusinessSetupSkipped(false)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 hover:underline cursor-pointer"
                    >
                      {t('auth.btn_fill_business_setup', lang, 'Jetzt ausfüllen')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t('auth.company_name', lang, 'Wie heißt die Firma / Ihr Unternehmen?')}
                      </label>
                      <input
                        className={fieldClass}
                        placeholder="z. B. Mustermann IT & Consulting GmbH"
                        value={businessDetails.companyName}
                        onChange={(e) => setBusinessDetails({ ...businessDetails, companyName: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('auth.company_address', lang, 'Straße & Hausnummer')}
                        </label>
                        <input
                          className={fieldClass}
                          placeholder="z. B. Hauptstraße 12"
                          value={businessDetails.street}
                          onChange={(e) => setBusinessDetails({ ...businessDetails, street: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('auth.company_zip_city', lang, 'PLZ & Ort')}
                        </label>
                        <input
                          className={fieldClass}
                          placeholder="z. B. 10115 Berlin"
                          value={businessDetails.zipCity}
                          onChange={(e) => setBusinessDetails({ ...businessDetails, zipCity: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('auth.company_currency', lang, 'Standard-Währung')}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            className={`${fieldClass} flex-1`}
                            placeholder="€"
                            value={businessDetails.currency}
                            onChange={(e) => setBusinessDetails({ ...businessDetails, currency: e.target.value })}
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            {['€', '$', 'CHF', '£'].map((curr) => (
                              <button
                                key={curr}
                                type="button"
                                onClick={() => setBusinessDetails({ ...businessDetails, currency: curr })}
                                className={`px-2 py-2 rounded-lg text-xs font-bold border transition ${
                                  businessDetails.currency === curr
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                              >
                                {curr}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('auth.company_owner', lang, 'Inhaber / Geschäftsführung')}
                        </label>
                        <input
                          className={fieldClass}
                          placeholder="z. B. Max Mustermann"
                          value={businessDetails.managingDirector}
                          onChange={(e) => setBusinessDetails({ ...businessDetails, managingDirector: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('auth.company_email', lang, 'Firmen-E-Mail (für Anschriften / Rechnungen)')}
                        </label>
                        <input
                          type="email"
                          className={fieldClass}
                          placeholder="rechnung@firma.de"
                          value={businessDetails.email}
                          onChange={(e) => setBusinessDetails({ ...businessDetails, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('auth.company_tax_id', lang, 'Steuernummer / USt-IdNr.')}
                        </label>
                        <input
                          className={fieldClass}
                          placeholder="z. B. DE123456789"
                          value={businessDetails.taxId}
                          onChange={(e) => setBusinessDetails({ ...businessDetails, taxId: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setIsBusinessSetupSkipped(true)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                      >
                        {t('auth.btn_skip_business_setup', lang, 'Angaben überspringen & später einrichten')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile Picture (Optional, gray silhouette default, upload/remove) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.profilePhoto', lang)}
            </label>
            <div className="flex items-center gap-3.5 p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-white/5">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-200/90 dark:bg-white/10 border border-slate-300 dark:border-white/15 flex items-center justify-center shrink-0 shadow-xs">
                {form.avatar ? (
                  <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserRound size={26} strokeWidth={1.6} className="text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarFile(file);
                    e.target.value = '';
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-xs transition-colors cursor-pointer"
                  >
                    <Upload size={13} />
                    <span>{t('auth.uploadPhoto', lang)}</span>
                  </button>
                  {form.avatar && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, avatar: '' }))}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>{t('auth.removePhoto', lang)}</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                  {t('auth.defaultAvatarNote', lang)}
                </p>
              </div>
            </div>
          </div>

          {/* Password with Strength Meter */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {text.password} <span className="text-rose-500 font-bold">*</span>
              </label>
              {strength.labelKey && (
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {t('auth.passwordStrength', lang)}: <span className="text-indigo-600 dark:text-indigo-400">{t(strength.labelKey, lang)}</span>
                </span>
              )}
            </div>
            <div className="relative">
              <input
                className={`${fieldClass} pr-10`}
                type={showPassword ? 'text' : 'password'}
                placeholder={text.password}
                value={form.password}
                onChange={(e) => {
                  setForm({ ...form, password: e.target.value });
                  setError('');
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength Bar */}
            {form.password && (
              <div className="mt-2 space-y-1">
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${strength.colorClass}`}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  {t('auth.passwordTips', lang)}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {text.confirm} <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              className={fieldClass}
              type={showPassword ? 'text' : 'password'}
              placeholder={text.confirm}
              value={form.confirm}
              onChange={(e) => {
                setForm({ ...form, confirm: e.target.value });
                setError('');
              }}
            />
            {form.confirm && form.password !== form.confirm && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">{text.mismatch}</p>
            )}
          </div>

          {/* Security Question Section */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
            <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2.5 leading-relaxed">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>{t('auth.offlineNotice', lang)}</span>
            </div>

            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('auth.securityQuestionsTitle', lang)}
            </label>

            <select
              className={fieldClass}
              value={form.questionMode}
              onChange={(e) => {
                setForm({ ...form, questionMode: e.target.value });
                setError('');
              }}
            >
              {RECOVERY_QUESTIONS.map((q) => (
                <option key={q} value={q}>
                  {getRecoveryQuestionLabel(q, lang)}
                </option>
              ))}
              <option value="custom">{t('auth.customQuestionOption', lang)}</option>
              <option value="none">{t('auth.noSecurityQuestion', lang)}</option>
            </select>

            {form.questionMode === 'custom' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.customQuestionPlaceholder', lang)} <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  className={fieldClass}
                  placeholder={t('auth.customQuestionPlaceholder', lang)}
                  value={form.customQuestion}
                  onChange={(e) => {
                    setForm({ ...form, customQuestion: e.target.value });
                    setError('');
                  }}
                />
              </div>
            )}

            {form.questionMode !== 'none' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {text.recoveryAnswer} <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  className={fieldClass}
                  placeholder={text.recoveryAnswer}
                  value={form.recoveryAnswer}
                  onChange={(e) => {
                    setForm({ ...form, recoveryAnswer: e.target.value });
                    setError('');
                  }}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs sm:text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <button
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 font-semibold shadow-lg shadow-indigo-600/25 transition-colors cursor-pointer"
          >
            {isSubmitting ? text.create + '...' : text.create}
          </button>
        </form>
      </div>
    </div>
  );
}

function AuthAvatar({ user, size = 'md' }: { user: UserAccount; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-24 h-24' : size === 'sm' ? 'w-11 h-11' : 'w-16 h-16';
  const iconSize = size === 'lg' ? 38 : size === 'sm' ? 19 : 28;
  const isImageAvatar = Boolean(
    user.avatar && (
      user.avatar.startsWith('data:image/') ||
      user.avatar.startsWith('blob:') ||
      user.avatar.startsWith('http') ||
      user.avatar.startsWith('/')
    )
  );

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-slate-200/80 dark:bg-white/10 border border-white/50 dark:border-white/10 flex items-center justify-center shrink-0 shadow-lg mx-auto select-none`}>
      {isImageAvatar ? (
        <img src={user.avatar} alt="" className="w-full h-full object-cover object-center block shrink-0" />
      ) : user.avatar && user.avatar.length <= 2 ? (
        <span className="font-bold text-slate-700 dark:text-white" style={{ fontSize: `${iconSize * 0.85}px` }}>
          {user.avatar}
        </span>
      ) : (
        <UserRound size={iconSize} strokeWidth={1.6} className="text-slate-400 dark:text-slate-500 shrink-0" />
      )}
    </div>
  );
}

function LoginBackdrop({
  company,
  wallpaper,
  children,
}: {
  company: CompanyProfile;
  wallpaper?: string;
  children: React.ReactNode;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const background = wallpaper || company.desktop_wallpaper_url;
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white">
      {background ? (
        <>
          <div
            aria-hidden="true"
            className="absolute -inset-6 bg-cover bg-center scale-105 blur-[18px]"
            style={{ backgroundImage: `url("${background}")` }}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-black/35" />
          <div aria-hidden="true" className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]" />
        </>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
      )}

      <div className="absolute top-8 left-0 right-0 text-center pointer-events-none select-none">
        <div className="text-5xl sm:text-6xl font-light tracking-tight drop-shadow-2xl">
          {formatSystemTime(now, company.time_show_seconds === true, company.timezone)}
        </div>
        <div className="mt-2 text-sm sm:text-base text-white/80 drop-shadow-lg">
          {formatSystemDate(now, company.date_format || 'DD.MM.YYYY', company.timezone)}
        </div>
      </div>

      {children}
    </div>
  );
}

function LoginScreen({
  text,
  users,
  company,
  onLogin,
  initialSuccessMessage,
  initialUsername,
  onDismissSuccess,
}: {
  text: AuthText;
  users: UserAccount[];
  company: CompanyProfile;
  onLogin: (u: string, p: string) => Promise<{ ok: boolean; reason?: string; retryAt?: number }>;
  initialSuccessMessage?: string | null;
  initialUsername?: string | null;
  onDismissSuccess?: () => void;
}) {
  const lang = useLanguage();
  const activeUsers = users.filter((user) => user.active);
  const defaultUsername = initialUsername && activeUsers.some((u) => u.username === initialUsername)
    ? initialUsername
    : activeUsers[0]?.username ?? '';

  const [selected, setSelected] = useState(defaultUsername);
  const [otherUser, setOtherUser] = useState(false);
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(initialSuccessMessage ?? null);
  const [lockedUntil, setLockedUntil] = useState<number | undefined>();
  const [recover, setRecover] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (initialSuccessMessage) {
      setSuccessNotice(initialSuccessMessage);
    }
  }, [initialSuccessMessage]);

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => {
      setSuccessNotice(null);
      if (onDismissSuccess) onDismissSuccess();
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [successNotice, onDismissSuccess]);

  useEffect(() => {
    if (initialUsername && activeUsers.some((u) => u.username === initialUsername)) {
      setSelected(initialUsername);
      setUsername(initialUsername);
      setOtherUser(false);
    }
  }, [initialUsername, users]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const user = otherUser ? null : getUserByUsername(selected);
      setLockedUntil(user?.lockedUntil);
    }, 500);
    return () => window.clearInterval(timer);
  }, [selected, otherUser]);

  if (recover) return <RecoveryScreen text={text} users={users} onBack={() => setRecover(false)} />;

  const selectedUser = otherUser ? null : getUserByUsername(selected);
  const remaining = lockedUntil ? getLockoutRemaining(selectedUser) : 0;
  const loginUsername = otherUser ? username.trim() : selected;

  const chooseUser = (nextUsername: string) => {
    setOtherUser(false);
    setSelected(nextUsername);
    setUsername(nextUsername);
    setPassword('');
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!loginUsername || isSigningIn) return setError(text.required);
    setIsSigningIn(true);
    setError('');
    const result = await onLogin(loginUsername, password);
    if (!result.ok) {
      setIsSigningIn(false);
      setLockedUntil(result.retryAt);
      setError(result.reason === 'inactive' ? text.inactive : result.reason === 'locked' ? text.locked : text.invalid);
    }
  };

  if (isSigningIn) return <AuthLoadingScreen text={text} user={selectedUser} />;

  return (
    <LoginBackdrop company={company} wallpaper={selectedUser?.preferences.wallpaper}>
      <div className="absolute top-4 right-5 z-20">
        <select
          value={lang}
          onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          className="text-xs font-medium rounded-xl border border-white/20 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 outline-none focus:ring-2 focus:ring-white/40 cursor-pointer shadow-lg transition hover:bg-black/50"
          title={t('auth.changeLanguage', lang)}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="bg-slate-900 text-white">
              {l.nativeLabel}
            </option>
          ))}
        </select>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-5 pt-16 pb-24">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          {selectedUser ? (
            <AuthAvatar user={selectedUser} size="lg" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-200/80 dark:bg-white/10 border border-white/50 dark:border-white/10 flex items-center justify-center shadow-lg mx-auto shrink-0">
              <UserRound size={38} strokeWidth={1.6} className="text-slate-400 dark:text-slate-500" />
            </div>
          )}

          <h1 className="mt-5 text-2xl font-medium drop-shadow-xl text-white">
            {selectedUser?.displayName || text.otherUser}
          </h1>
          {otherUser && <p className="mt-1 text-sm text-white/65">{text.otherUserDesc}</p>}

          <form onSubmit={submit} className="w-full mt-5 space-y-3">
              {otherUser && (
                <input
                  autoFocus
                  className="w-full rounded-2xl border border-white/20 bg-black/30 hover:bg-black/40 focus:bg-black/45 text-white placeholder:text-white/50 backdrop-blur-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white/40 text-sm sm:text-base transition shadow-lg"
                  placeholder={text.username}
                  value={username}
                  onChange={(event) => { setUsername(event.target.value); setError(''); }}
                />
              )}

              <div className="relative w-full">
                <input
                  autoFocus={!otherUser}
                  className="w-full rounded-2xl border border-white/20 bg-black/30 hover:bg-black/40 focus:bg-black/45 text-white placeholder:text-white/50 backdrop-blur-xl pl-4.5 pr-12 py-3 outline-none focus:ring-2 focus:ring-white/40 text-sm sm:text-base transition shadow-lg"
                  type="password"
                  placeholder={text.password}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }}
                  disabled={remaining > 0}
                />
                <button
                  type="submit"
                  disabled={remaining > 0}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 active:bg-white/40 text-white flex items-center justify-center transition shadow-xs disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title={text.login}
                  aria-label={text.login}
                >
                  <ArrowRight size={18} />
                </button>
              </div>

              {remaining > 0 && <p className="text-sm text-amber-300 drop-shadow">{text.retry} {Math.ceil(remaining / 1000)}s</p>}
              {error && <p className="text-sm text-red-300 drop-shadow">{error}</p>}
              <button type="button" onClick={() => setRecover(true)} className="text-sm text-white/75 hover:text-white hover:underline drop-shadow cursor-pointer">
                {text.forgot}
              </button>
            </form>
          </div>
        </div>

      <div className="absolute left-5 bottom-5 flex items-end gap-2.5 max-w-[calc(100vw-2.5rem)] overflow-x-auto pb-1">
        {activeUsers.map((user) => {
          const isSelected = selected === user.username && !otherUser;
          return (
            <button
              key={user.id}
              type="button"
              onClick={() => chooseUser(user.username)}
              className={`group flex flex-col items-center gap-1.5 rounded-2xl px-3 py-2 transition-all cursor-pointer select-none ${
                isSelected 
                  ? 'bg-white/20 backdrop-blur-xl shadow-lg border border-white/30 text-white' 
                  : 'hover:bg-white/10 opacity-75 hover:opacity-100 text-white/90 border border-transparent'
              }`}
              title={user.displayName}
            >
              <AuthAvatar user={user} size="sm" />
              <span className="max-w-[120px] truncate text-xs font-medium text-white drop-shadow-sm text-center">{user.displayName}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => { setOtherUser(true); setSelected(''); setUsername(''); setPassword(''); setError(''); }}
          className={`group flex flex-col items-center gap-1.5 rounded-2xl px-3 py-2 transition-all cursor-pointer select-none ${
            otherUser 
              ? 'bg-white/20 backdrop-blur-xl shadow-lg border border-white/30 text-white' 
              : 'hover:bg-white/10 opacity-75 hover:opacity-100 text-white/90 border border-transparent'
          }`}
          title={text.otherUser}
        >
          <div className="w-11 h-11 rounded-full border border-white/30 bg-black/20 backdrop-blur-xl flex items-center justify-center">
            <UserRound size={19} className="text-white/85" />
          </div>
          <span className="max-w-[130px] truncate text-xs font-medium text-white drop-shadow-sm text-center">{text.otherUser}</span>
        </button>
      </div>

      {/* Windows 11 Style Bottom-Right Notification Toast (Auto-dismisses after max 10s) */}
      {successNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm sm:max-w-md w-[calc(100%-2.5rem)] rounded-2xl border border-emerald-400/40 bg-emerald-950/90 backdrop-blur-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-emerald-100 shadow-2xl shadow-emerald-950/50 flex items-start justify-between gap-3 ring-1 ring-emerald-400/30 animate-fade-in transition-all"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 mt-0.5 text-emerald-400 shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-left">
              <div className="font-semibold text-emerald-300 text-[11px] uppercase tracking-wider mb-0.5">
                {t('auth.accountCreatedToastTitle', lang, 'Account Created')}
              </div>
              <p className="leading-snug text-emerald-100/90 text-xs sm:text-sm">{successNotice}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSuccessNotice(null);
              if (onDismissSuccess) onDismissSuccess();
            }}
            className="text-emerald-300 hover:text-white shrink-0 p-1 rounded-lg hover:bg-emerald-900/50 transition cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </LoginBackdrop>
  );
}

function AuthLoadingScreen({ text, user }: { text: AuthText; user: UserAccount | null }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setDots((current) => current.length >= 3 ? '' : current + '.'), 350);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
      <div className="relative flex flex-col items-center text-center px-6">
        {user ? <AuthAvatar user={user} size="lg" /> : <div className="w-24 h-24 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shadow-2xl mx-auto shrink-0"><UserRound size={38} strokeWidth={1.6} className="text-white/55" /></div>}
        <div className="mt-7 text-xl font-medium tracking-tight">{text.login}{dots}</div>
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => <span key={index} className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />)}
        </div>
      </div>
    </div>
  );
}

function ForcedPasswordScreen({ text, user, onDone, onLogout }: { text: AuthText; user: UserAccount; onDone: () => void; onLogout: () => void }) {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (password !== confirm) return setError(text.mismatch); try { await changePassword(user.id, password); onDone(); } catch { setError(text.short); } };
  return <AuthShell title={text.newPasswordTitle} subtitle={text.forcePassword}><form onSubmit={submit} className="space-y-4"><input autoFocus className={fieldClass} type="password" placeholder={text.newPassword} value={password} onChange={(e) => setPassword(e.target.value)} /><input className={fieldClass} type="password" placeholder={text.confirm} value={confirm} onChange={(e) => setConfirm(e.target.value)} />{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold">{text.save}</button><button type="button" onClick={onLogout} className="w-full rounded-xl border py-3">{text.logout}</button></form></AuthShell>;
}

function RecoveryScreen({ text, users, onBack }: { text: AuthText; users: UserAccount[]; onBack: () => void }) {
  const lang = useLanguage();
  const [username, setUsername] = useState(users.find((user) => user.active)?.username ?? ''); const [answer, setAnswer] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const user = getUserByUsername(username);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!user) return setError(text.invalid); if (!user.recovery) return setError(text.recoveryUnavailable); if (password !== confirm) return setError(text.mismatch); try { await resetPasswordWithRecovery(user.id, answer, password); onBack(); } catch (err) { const reason = String((err as Error).message); setError(reason === 'recovery_invalid' ? text.recoveryInvalid : reason === 'password_too_short' ? text.short : text.required); } };
  return <AuthShell title={text.recover} subtitle={text.newPasswordTitle}><form onSubmit={submit} className="space-y-4"><select className={fieldClass} value={username} onChange={(e) => { setUsername(e.target.value); setAnswer(''); setError(''); }}>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.username}>{u.displayName} · {u.username}</option>)}</select>{user?.recovery && <><p className="text-sm text-slate-500">{getRecoveryQuestionLabel(user.recovery.question, lang)}</p><input className={fieldClass} placeholder={text.recoveryAnswer} value={answer} onChange={(e) => setAnswer(e.target.value)} /><input className={fieldClass} type="password" placeholder={text.newPassword} value={password} onChange={(e) => setPassword(e.target.value)} /><input className={fieldClass} type="password" placeholder={text.confirm} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></>}{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold">{text.save}</button><button type="button" onClick={onBack} className="w-full rounded-xl border py-3">{text.backLogin}</button></form></AuthShell>;
}

function LockScreen({
  text,
  user,
  users,
  company,
  onUnlock,
  onSwitch,
}: {
  text: AuthText;
  user: UserAccount;
  users: UserAccount[];
  company: CompanyProfile;
  onUnlock: (u: string, p: string) => Promise<{ ok: boolean; reason?: string; retryAt?: number }>;
  onSwitch: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(user.username);
  const [now, setNow] = useState(new Date());
  const activeUsers = users.filter((account) => account.active);
  const selectedUser = getUserByUsername(selected) ?? user;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await onUnlock(selectedUser.username, password);
    if (!result.ok) setError(result.reason === 'locked' ? text.locked : text.invalid);
    else setError('');
  };

  const chooseUser = (username: string) => {
    setSelected(username);
    setPassword('');
    setError('');
  };

  const currentLang = useLanguage();

  return (
    <LoginBackdrop company={company} wallpaper={selectedUser.preferences.wallpaper}>
      <div className="absolute top-4 right-5 z-20">
        <select
          value={currentLang}
          onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          className="text-xs font-medium rounded-xl border border-white/20 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 outline-none focus:ring-2 focus:ring-white/40 cursor-pointer shadow-lg transition hover:bg-black/50"
          title={t('auth.changeLanguage', currentLang)}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="bg-slate-900 text-white">
              {l.nativeLabel}
            </option>
          ))}
        </select>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-5 pt-16 pb-24">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          <AuthAvatar user={selectedUser} size="lg" />
          <h1 className="mt-5 text-2xl font-medium drop-shadow-xl text-white">{selectedUser.displayName}</h1>
          <p className="mt-1 text-sm text-white/65">{text.lockedTitle}</p>

          <form onSubmit={submit} className="w-full mt-5 space-y-3">
            <div className="relative w-full">
              <input
                autoFocus
                className="w-full rounded-2xl border border-white/20 bg-black/30 hover:bg-black/40 focus:bg-black/45 text-white placeholder:text-white/50 backdrop-blur-xl pl-4.5 pr-12 py-3 outline-none focus:ring-2 focus:ring-white/40 text-sm sm:text-base transition shadow-lg"
                type="password"
                placeholder={text.password}
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(''); }}
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 active:bg-white/40 text-white flex items-center justify-center transition shadow-xs cursor-pointer"
                title={text.unlock}
                aria-label={text.unlock}
              >
                <ArrowRight size={18} />
              </button>
            </div>
            {error && <p className="text-sm text-red-300 drop-shadow">{error}</p>}
          </form>
        </div>
      </div>

      <div className="absolute left-5 bottom-5 flex items-end gap-2.5 max-w-[calc(100vw-2.5rem)] overflow-x-auto pb-1">
        {activeUsers.map((account) => {
          const isSelected = selected === account.username;
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => chooseUser(account.username)}
              className={`group flex flex-col items-center gap-1.5 rounded-2xl px-3 py-2 transition-all cursor-pointer select-none ${
                isSelected 
                  ? 'bg-white/20 backdrop-blur-xl shadow-lg border border-white/30 text-white' 
                  : 'hover:bg-white/10 opacity-75 hover:opacity-100 text-white/90 border border-transparent'
              }`}
              title={account.displayName}
            >
              <AuthAvatar user={account} size="sm" />
              <span className="max-w-[120px] truncate text-xs font-medium text-white drop-shadow-sm text-center">{account.displayName}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onSwitch}
          className="group flex flex-col items-center gap-1.5 rounded-2xl px-3 py-2 hover:bg-white/10 opacity-75 hover:opacity-100 text-white/90 border border-transparent transition-all cursor-pointer select-none"
          title={text.switchUser}
        >
          <div className="w-11 h-11 rounded-full border border-white/30 bg-black/20 backdrop-blur-xl flex items-center justify-center">
            <UserRound size={19} className="text-white/85" />
          </div>
          <span className="max-w-[130px] truncate text-xs font-medium text-white drop-shadow-sm text-center">{text.switchUser}</span>
        </button>
      </div>
    </LoginBackdrop>
  );
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-slate-100 via-white to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4 sm:p-6 flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md my-auto rounded-2xl sm:rounded-3xl border border-white/60 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white backdrop-blur-2xl shadow-2xl p-6 sm:p-8 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-indigo-600/20">
          <ShieldCheck size={25} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-7">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export function UserManager({ text, currentUser, users, onClose, onRefresh, onLogout }: { text: AuthText; currentUser: UserAccount; users: UserAccount[]; onClose: () => void; onRefresh: () => void; onLogout: () => void }) {
  const [selectedId, setSelectedId] = useState(currentUser.id);
  const [newUser, setNewUser] = useState({ username: '', displayName: '', password: '', accountType: 'business' as AccountType, role: 'user' as UserRole, avatar: avatars[0], recoveryQuestion: RECOVERY_QUESTIONS[0], recoveryAnswer: '' });
  const [newPassword, setNewPassword] = useState(''); const [message, setMessage] = useState(''); const [security, setSecurity] = useState<SecuritySettings>(() => getSecuritySettings());
  const selected = users.find((user) => user.id === selectedId) ?? currentUser; const canManage = currentUser.role === 'admin';
  const create = async () => { try { await createUser(newUser); setNewUser({ username: '', displayName: '', password: '', accountType: 'business', role: 'user', avatar: avatars[0], recoveryQuestion: RECOVERY_QUESTIONS[0], recoveryAnswer: '' }); setMessage(''); onRefresh(); } catch (err) { const reason = String((err as Error).message); setMessage(reason === 'password_too_short' ? text.short : reason === 'recovery_answer_required' ? text.recoveryRequired : text.exists); } };
  const saveProfile = () => { try { updateUser(selected.id, { displayName: selected.displayName, role: selected.role, accountType: selected.accountType, avatar: selected.avatar }); onRefresh(); setMessage(text.profileSaved); } catch { setMessage(text.lastAdmin); } };
  const toggle = () => { if (selected.id === currentUser.id) return; try { updateUser(selected.id, { active: !selected.active }); onRefresh(); } catch { setMessage(text.lastAdmin); } };
  const remove = () => { if (selected.id === currentUser.id) return; try { deleteUser(selected.id); onRefresh(); setSelectedId(currentUser.id); } catch { setMessage(text.lastAdmin); } };
  const savePassword = async () => { try { await adminResetPassword(selected.id, newPassword); setNewPassword(''); setMessage(text.resetDone); onRefresh(); } catch { setMessage(text.short); } };
  const setAutoLock = (minutes: number) => { try { updateUser(selected.id, { preferences: { ...selected.preferences, autoLockMinutes: minutes } }); onRefresh(); } catch { setMessage(text.lastAdmin); } };
  const saveSecurity = () => { setSecurity(updateSecuritySettings(security)); setMessage(text.securitySaved); };
  return <div className="fixed inset-0 z-[10000] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6"><div className="w-full max-w-5xl max-h-[92vh] overflow-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-white/10 p-6"><div className="flex items-center justify-between mb-5"><div><h2 className="text-xl font-bold">{text.users}</h2><p className="text-sm text-slate-500">{text.current}: {currentUser.displayName}</p></div><button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button></div><div className="grid lg:grid-cols-[280px_1fr] gap-5"><div className="space-y-2">{users.map((user) => <button key={user.id} onClick={() => setSelectedId(user.id)} className={`w-full text-left p-3 rounded-2xl border ${selected.id === user.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-white/10'}`}><div>{user.avatar ?? '●'} <span className="font-medium">{user.displayName}</span></div><div className="text-xs text-slate-500">@{user.username} · {user.role === 'admin' ? text.admin : text.user} · {user.active ? text.active : text.disabled}</div></button>)}</div><div className="space-y-4"><div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-4">{canManage && <><div className="flex gap-2">{avatars.map((avatar) => <button key={avatar} onClick={() => updateUser(selected.id, { avatar })} className={`w-9 h-9 rounded-xl border ${selected.avatar === avatar ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-white/10'}`}>{avatar}</button>)}</div><div className="grid md:grid-cols-2 gap-2"><input className={fieldClass} value={selected.displayName} onChange={(e) => updateUser(selected.id, { displayName: e.target.value })} /><select className={fieldClass} value={selected.role} onChange={(e) => { try { updateUser(selected.id, { role: e.target.value as UserRole }); onRefresh(); } catch { setMessage(text.lastAdmin); } }}><option value="user">{text.user}</option><option value="admin">{text.admin}</option></select><select className={fieldClass} value={selected.accountType} onChange={(e) => { updateUser(selected.id, { accountType: e.target.value as AccountType }); onRefresh(); }}><option value="personal">{text.personal}</option><option value="business">{text.business}</option></select><select className={fieldClass} value={selected.preferences.autoLockMinutes ?? 15} onChange={(e) => setAutoLock(Number(e.target.value))}><option value={0}>{text.autoLock}: {text.off}</option><option value={5}>5 {text.minutes}</option><option value={10}>10 {text.minutes}</option><option value={15}>15 {text.minutes}</option><option value={30}>30 {text.minutes}</option><option value={60}>60 {text.minutes}</option></select></div><div className="flex gap-2"><button onClick={saveProfile} className="rounded-xl bg-indigo-600 text-white px-4 py-2">{text.save}</button><button onClick={toggle} className="rounded-xl border px-4 py-2">{selected.active ? text.deactivate : text.activate}</button><button onClick={remove} className="rounded-xl border border-red-200 text-red-600 px-4 py-2">{text.remove}</button></div></>}<div className="pt-3 border-t dark:border-white/10"><label className="text-xs text-slate-500">{text.passwordChange}</label><div className="flex gap-2 mt-2"><input className={fieldClass} type="password" placeholder={text.newPassword} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button onClick={savePassword} className="rounded-xl bg-indigo-600 text-white px-4">{text.save}</button></div><p className="text-xs text-slate-500 mt-2">{text.forcePassword}</p></div></div>
{canManage && <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-3"><h3 className="font-semibold">{text.security}</h3><div className="grid md:grid-cols-3 gap-2"><label className="text-sm"><span className="block text-xs text-slate-500 mb-1">{text.threshold}</span><select className={fieldClass} value={security.failedAttemptThreshold} onChange={(e) => setSecurity({ ...security, failedAttemptThreshold: Number(e.target.value) as SecuritySettings['failedAttemptThreshold'] })}><option value={3}>3</option><option value={5}>5</option><option value={10}>10</option></select></label><label className="text-sm"><span className="block text-xs text-slate-500 mb-1">{text.lockoutDuration}</span><select className={fieldClass} value={security.lockoutMinutes} onChange={(e) => setSecurity({ ...security, lockoutMinutes: Number(e.target.value) as SecuritySettings['lockoutMinutes'] })}><option value={5}>5 {text.minutes}</option><option value={10}>10 {text.minutes}</option><option value={15}>15 {text.minutes}</option></select></label><label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-3 mt-5"><input type="checkbox" checked={security.exponentialBackoff} onChange={(e) => setSecurity({ ...security, exponentialBackoff: e.target.checked })} /><span>{text.backoff}: {security.exponentialBackoff ? text.enabled : text.off}</span></label></div><button onClick={saveSecurity} className="rounded-xl bg-indigo-600 text-white px-4 py-2">{text.save}</button></div>}
{message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}</div></div><div className="mt-5 flex justify-between"><button onClick={onLogout} className="rounded-xl border px-4 py-2">{text.logout}</button>{canManage && <div className="grid grid-cols-5 gap-2 w-full max-w-3xl ml-4"><input className={fieldClass} placeholder={text.displayName} value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} /><input className={fieldClass} placeholder={text.username} value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} /><input className={fieldClass} type="password" placeholder={text.password} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /><input className={fieldClass} placeholder={text.recoveryAnswer} value={newUser.recoveryAnswer} onChange={(e) => setNewUser({ ...newUser, recoveryAnswer: e.target.value })} /><button onClick={create} className="rounded-xl bg-indigo-600 text-white flex items-center justify-center" title={text.add}><Plus size={17} /></button></div>}</div></div></div>;
}
