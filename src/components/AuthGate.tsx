import React, { useCallback, useEffect, useState } from 'react';
import { LockKeyhole, LogIn, LogOut, Plus, ShieldCheck, UserRound, UserRoundCog, X } from 'lucide-react';
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
  resetPasswordWithRecovery,
  saveSession,
  updateSecuritySettings,
  updateUser,
  type SecuritySettings,
  type UserAccount,
  type UserRole,
  RECOVERY_QUESTIONS
} from '../lib/auth';
import { SUPPORTED_LANGUAGES, formatSystemDate, formatSystemTime, getRecoveryQuestionLabel, setLanguage, t, useLanguage, type LanguageCode } from '../lib/i18n';
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

export function AuthGate({ children, company }: { children: React.ReactNode; company: CompanyProfile }) {
  const [users, setUsers] = useState<UserAccount[]>(() => getUsers());
  const [languageReady, setLanguageReady] = useState(() => typeof localStorage === 'undefined' || localStorage.getItem('socdof_language_initialized') === 'true');
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
    const activity = () => { const current = getSession(); if (current && !current.locked) saveSession({ ...current, lastActivityAt: Date.now() }); };
    const events = ['mousedown', 'keydown', 'pointerdown', 'touchstart']; events.forEach((event) => window.addEventListener(event, activity));
    const timer = window.setInterval(() => { const current = getSession(); const user = current ? getUserById(current.userId) : null; const minutes = user?.preferences.autoLockMinutes ?? 15; if (current && !current.locked && minutes > 0 && Date.now() - current.lastActivityAt >= minutes * 60_000) { lockSession(); setLocked(true); } }, 10_000);
    return () => { events.forEach((event) => window.removeEventListener(event, activity)); window.clearInterval(timer); };
  }, [session, locked]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l' && getSession() && !locked) { event.preventDefault(); lockSession(); setLocked(true); } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [locked]);

  const login = async (username: string, password: string) => { const result = await authenticate(username, password); if (!result.ok) { refresh(); return { ok: false as const, reason: result.reason, retryAt: result.retryAt }; } setSession(result.session); setLocked(false); setUsers(getUsers()); return { ok: true as const }; };
  const logout = () => { clearSession(); setSession(null); setLocked(false); };

  if (!languageReady) return <LanguageSelectionScreen onSelected={() => setLanguageReady(true)} />;
  if (!hasUsers()) return <FirstAccount text={text} onCreated={refresh} />;
  if (!session || !currentUser) return <LoginScreen text={text} users={users} company={company} onLogin={login} />;
  if (currentUser.mustChangePassword) return <ForcedPasswordScreen text={text} user={currentUser} onDone={refresh} onLogout={logout} />;
  if (locked) return <LockScreen text={text} user={currentUser} users={users} company={company} onUnlock={login} onSwitch={logout} />;
  return <div className="relative w-full h-full">{children}</div>;
}

function LanguageSelectionScreen({ onSelected }: { onSelected: () => void }) {
  const lang = useLanguage();

  const selectLanguage = (code: LanguageCode) => {
    setLanguage(code);
    onSelected();
  };

  return <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-6">
    <div className="w-full max-w-md rounded-3xl border border-white/60 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 text-slate-900 dark:text-white backdrop-blur-2xl shadow-2xl p-8">
      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-5"><ShieldCheck size={25} /></div>
      <h1 className="text-2xl font-bold tracking-tight">{t('lang_modal.title', lang)}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-7">{t('lang_modal.subtitle', lang)}</p>
      <div className="space-y-2">
        {SUPPORTED_LANGUAGES.map((language) => <button
          key={language.code}
          type="button"
          onClick={() => selectLanguage(language.code)}
          className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
            lang === language.code
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
              : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
          }`}
        >
          <span className="text-xl">{language.flag}</span>
          <span className="flex-1">
            <span className="block font-medium">{language.nativeLabel}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{language.label}</span>
          </span>
          {lang === language.code && <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{t('lang_modal.current_selected', lang)}</span>}
        </button>)}
      </div>
    </div>
  </div>;
}

function FirstAccount({ text, onCreated }: { text: AuthText; onCreated: () => void }) {
  const lang = useLanguage();
  const [form, setForm] = useState({ username: '', displayName: '', password: '', confirm: '', accountType: 'personal' as AccountType, avatar: avatars[0], recoveryQuestion: RECOVERY_QUESTIONS[0], recoveryAnswer: '' });
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!form.username || !form.displayName || !form.password) return setError(text.required); if (form.password !== form.confirm) return setError(text.mismatch); try { await createUser(form); onCreated(); } catch (err) { const reason = String((err as Error).message); setError(reason === 'password_too_short' ? text.short : reason === 'username_exists' ? text.exists : reason === 'recovery_answer_required' ? text.recoveryRequired : text.required); } };
  return <AuthShell title={text.welcome} subtitle={text.setup}><form onSubmit={submit} className="space-y-4"><input autoFocus className={fieldClass} placeholder={text.displayName} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /><input className={fieldClass} placeholder={text.username} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /><input className={fieldClass} type="password" placeholder={text.password} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><input className={fieldClass} type="password" placeholder={text.confirm} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm({ ...form, accountType: 'personal' })} className={`rounded-xl border p-3 text-left ${form.accountType === 'personal' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'}`}>{text.personal}</button><button type="button" onClick={() => setForm({ ...form, accountType: 'business' })} className={`rounded-xl border p-3 text-left ${form.accountType === 'business' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'}`}>{text.business}</button></div><div className="flex gap-2">{avatars.map((avatar) => <button key={avatar} type="button" onClick={() => setForm({ ...form, avatar })} className={`w-9 h-9 rounded-xl border ${form.avatar === avatar ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-white/10'}`}>{avatar}</button>)}</div><select className={fieldClass} value={form.recoveryQuestion} onChange={(e) => setForm({ ...form, recoveryQuestion: e.target.value })}>{RECOVERY_QUESTIONS.map((question) => <option key={question} value={question}>{getRecoveryQuestionLabel(question, lang)}</option>)}</select><input className={fieldClass} placeholder={text.recoveryAnswer} value={form.recoveryAnswer} onChange={(e) => setForm({ ...form, recoveryAnswer: e.target.value })} />{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold">{text.create}</button></form></AuthShell>;
}

function AuthAvatar({ user, size = 'md' }: { user: UserAccount; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-24 h-24' : size === 'sm' ? 'w-11 h-11' : 'w-16 h-16';
  const iconSize = size === 'lg' ? 38 : size === 'sm' ? 19 : 28;
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-slate-200/80 dark:bg-white/10 border border-white/50 dark:border-white/10 flex items-center justify-center shrink-0 shadow-lg`}>
      {user.avatar?.startsWith('data:image/') ? (
        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
      ) : (
        <UserRound size={iconSize} strokeWidth={1.6} className="text-slate-400 dark:text-slate-500" />
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
  const now = new Date();
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
}: {
  text: AuthText;
  users: UserAccount[];
  company: CompanyProfile;
  onLogin: (u: string, p: string) => Promise<{ ok: boolean; reason?: string; retryAt?: number }>;
}) {
  const activeUsers = users.filter((user) => user.active);
  const [selected, setSelected] = useState(activeUsers[0]?.username ?? '');
  const [otherUser, setOtherUser] = useState(false);
  const [username, setUsername] = useState(activeUsers[0]?.username ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState<number | undefined>();
  const [recover, setRecover] = useState(false);

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
    if (!loginUsername) return setError(text.required);
    const result = await onLogin(loginUsername, password);
    if (!result.ok) {
      setLockedUntil(result.retryAt);
      setError(result.reason === 'inactive' ? text.inactive : result.reason === 'locked' ? text.locked : text.invalid);
    } else {
      setError('');
    }
  };

  return (
    <LoginBackdrop company={company} wallpaper={selectedUser?.preferences.wallpaper}>
      <div className="absolute inset-0 flex items-center justify-center px-5 pt-16 pb-24">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            {selectedUser ? (
              <AuthAvatar user={selectedUser} size="lg" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-200/80 dark:bg-white/10 border border-white/50 dark:border-white/10 flex items-center justify-center shadow-lg">
                <UserRound size={38} strokeWidth={1.6} className="text-slate-400 dark:text-slate-500" />
              </div>
            )}

            <h1 className="mt-5 text-2xl font-medium drop-shadow-xl">
              {selectedUser?.displayName || text.otherUser}
            </h1>
            {otherUser && <p className="mt-1 text-sm text-white/65">{text.otherUserDesc}</p>}

            <form onSubmit={submit} className="w-full mt-5 space-y-3">
              {otherUser && (
                <input
                  autoFocus
                  className="w-full rounded-xl border border-white/20 bg-black/25 text-white placeholder:text-white/50 backdrop-blur-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white/40"
                  placeholder={text.username}
                  value={username}
                  onChange={(event) => { setUsername(event.target.value); setError(''); }}
                />
              )}

              <div className="flex gap-2">
                <input
                  autoFocus={!otherUser}
                  className="flex-1 rounded-xl border border-white/20 bg-black/25 text-white placeholder:text-white/50 backdrop-blur-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white/40"
                  type="password"
                  placeholder={text.password}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }}
                  disabled={remaining > 0}
                />
                <button
                  disabled={remaining > 0}
                  className="w-12 rounded-xl bg-white text-slate-900 flex items-center justify-center shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  title={text.login}
                  aria-label={text.login}
                >
                  <LogIn size={19} />
                </button>
              </div>

              {remaining > 0 && <p className="text-sm text-amber-300 drop-shadow">{text.retry} {Math.ceil(remaining / 1000)}s</p>}
              {error && <p className="text-sm text-red-300 drop-shadow">{error}</p>}
              <button type="button" onClick={() => setRecover(true)} className="text-sm text-white/75 hover:text-white hover:underline drop-shadow">
                {text.forgot}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="absolute left-5 bottom-5 flex items-end gap-3 max-w-[calc(100vw-2.5rem)] overflow-x-auto pb-1">
        {activeUsers.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => chooseUser(user.username)}
            className={`group flex flex-col items-center gap-1.5 rounded-2xl px-2.5 py-2 transition-all ${selected === user.username && !otherUser ? 'bg-white/15 ring-1 ring-white/30' : 'hover:bg-white/10'}`}
            title={user.displayName}
          >
            <AuthAvatar user={user} size="sm" />
            <span className="max-w-24 truncate text-xs text-white/85 drop-shadow">{user.displayName}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setOtherUser(true); setSelected(''); setUsername(''); setPassword(''); setError(''); }}
          className={`group flex flex-col items-center gap-1.5 rounded-2xl px-2.5 py-2 transition-all ${otherUser ? 'bg-white/15 ring-1 ring-white/30' : 'hover:bg-white/10'}`}
          title={text.otherUser}
        >
          <div className="w-11 h-11 rounded-full border border-white/30 bg-black/20 backdrop-blur-xl flex items-center justify-center">
            <UserRound size={19} className="text-white/75" />
          </div>
          <span className="max-w-24 truncate text-xs text-white/85 drop-shadow">{text.otherUser}</span>
        </button>
      </div>
    </LoginBackdrop>
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

  return (
    <LoginBackdrop company={company} wallpaper={selectedUser.preferences.wallpaper}>
      <div className="absolute inset-0 flex items-center justify-center px-5 pt-16 pb-24">
        <div className="w-full max-w-sm text-center">
          <AuthAvatar user={selectedUser} size="lg" />
          <h1 className="mt-5 text-2xl font-medium drop-shadow-xl">{selectedUser.displayName}</h1>
          <p className="mt-1 text-sm text-white/65">{text.lockedTitle}</p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div className="flex gap-2">
              <input
                autoFocus
                className="flex-1 rounded-xl border border-white/20 bg-black/25 text-white placeholder:text-white/50 backdrop-blur-xl px-4 py-3 outline-none focus:ring-2 focus:ring-white/40"
                type="password"
                placeholder={text.password}
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(''); }}
              />
              <button className="w-12 rounded-xl bg-white text-slate-900 flex items-center justify-center shadow-xl" title={text.unlock} aria-label={text.unlock}>
                <LogIn size={19} />
              </button>
            </div>
            {error && <p className="text-sm text-red-300 drop-shadow">{error}</p>}
          </form>
        </div>
      </div>

      <div className="absolute left-5 bottom-5 flex items-end gap-3 max-w-[calc(100vw-2.5rem)] overflow-x-auto pb-1">
        {activeUsers.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => chooseUser(account.username)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl px-2.5 py-2 transition-all ${selected === account.username ? 'bg-white/15 ring-1 ring-white/30' : 'hover:bg-white/10'}`}
            title={account.displayName}
          >
            <AuthAvatar user={account} size="sm" />
            <span className="max-w-24 truncate text-xs text-white/85 drop-shadow">{account.displayName}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={onSwitch}
          className="flex flex-col items-center gap-1.5 rounded-2xl px-2.5 py-2 hover:bg-white/10 transition-all"
          title={text.switchUser}
        >
          <div className="w-11 h-11 rounded-full border border-white/30 bg-black/20 backdrop-blur-xl flex items-center justify-center">
            <UserRound size={19} className="text-white/75" />
          </div>
          <span className="max-w-24 truncate text-xs text-white/85 drop-shadow">{text.switchUser}</span>
        </button>
      </div>
    </LoginBackdrop>
  );
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-6"><div className="w-full max-w-md rounded-3xl border border-white/60 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 text-slate-900 dark:text-white backdrop-blur-2xl shadow-2xl p-8"><div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-5"><ShieldCheck size={25} /></div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-7">{subtitle}</p>{children}</div></div>; }

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
