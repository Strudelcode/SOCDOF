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
import { SUPPORTED_LANGUAGES, setLanguage, t, useLanguage, type LanguageCode } from '../lib/i18n';

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

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<UserAccount[]>(() => getUsers());
  const [languageReady, setLanguageReady] = useState(() => typeof localStorage === 'undefined' || localStorage.getItem('socdof_language_initialized') === 'true');
  const [session, setSession] = useState(() => getSession());
  const lang = useLanguage();
  const [locked, setLocked] = useState(() => Boolean(getSession()?.locked));
  const [showManager, setShowManager] = useState(false);
  const refresh = useCallback(() => { setUsers(getUsers()); const current = getSession(); setSession(current); setLocked(Boolean(current?.locked)); }, []);
  const currentUser = session ? getUserById(session.userId) : null;
  const text = getAuthCopy(lang);

  useEffect(() => { const onStorage = () => refresh(); window.addEventListener('storage', onStorage); window.addEventListener('socdof-auth-changed', onStorage); return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('socdof-auth-changed', onStorage); }; }, [refresh]);
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
  if (!session || !currentUser) return <LoginScreen text={text} users={users} onLogin={login} />;
  if (currentUser.mustChangePassword) return <ForcedPasswordScreen text={text} user={currentUser} onDone={refresh} onLogout={logout} />;
  if (locked) return <LockScreen text={text} user={currentUser} users={users} onUnlock={login} onSwitch={logout} />;
  return <div className="relative w-full h-full">{children}<div className="fixed top-3 right-3 z-[9999] flex items-center gap-1 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl shadow-lg px-2 py-1.5"><button title={text.lock} onClick={() => { lockSession(); setLocked(true); }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><LockKeyhole size={16} /></button><button title={text.manage} onClick={() => setShowManager(true)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><UserRoundCog size={16} /></button><button title={text.logout} onClick={logout} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><LogOut size={16} /></button><div className="px-2 text-xs font-medium max-w-32 truncate">{currentUser.avatar?.startsWith('data:image/') ? <img src={currentUser.avatar} alt="" className="inline w-4 h-4 rounded-full object-cover mr-1" /> : `${currentUser.avatar ?? '●'} `}{currentUser.displayName}</div></div>{showManager && <UserManager text={text} currentUser={currentUser} users={users} onClose={() => setShowManager(false)} onRefresh={refresh} onLogout={logout} />}</div>;
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
  const [form, setForm] = useState({ username: '', displayName: '', password: '', confirm: '', accountType: 'personal' as AccountType, avatar: avatars[0], recoveryQuestion: RECOVERY_QUESTIONS[0], recoveryAnswer: '' });
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!form.username || !form.displayName || !form.password) return setError(text.required); if (form.password !== form.confirm) return setError(text.mismatch); try { await createUser(form); onCreated(); } catch (err) { const reason = String((err as Error).message); setError(reason === 'password_too_short' ? text.short : reason === 'username_exists' ? text.exists : reason === 'recovery_answer_required' ? text.recoveryRequired : text.required); } };
  return <AuthShell title={text.welcome} subtitle={text.setup}><form onSubmit={submit} className="space-y-4"><input autoFocus className={fieldClass} placeholder={text.displayName} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /><input className={fieldClass} placeholder={text.username} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /><input className={fieldClass} type="password" placeholder={text.password} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><input className={fieldClass} type="password" placeholder={text.confirm} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm({ ...form, accountType: 'personal' })} className={`rounded-xl border p-3 text-left ${form.accountType === 'personal' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'}`}>{text.personal}</button><button type="button" onClick={() => setForm({ ...form, accountType: 'business' })} className={`rounded-xl border p-3 text-left ${form.accountType === 'business' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'}`}>{text.business}</button></div><div className="flex gap-2">{avatars.map((avatar) => <button key={avatar} type="button" onClick={() => setForm({ ...form, avatar })} className={`w-9 h-9 rounded-xl border ${form.avatar === avatar ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-white/10'}`}>{avatar}</button>)}</div><select className={fieldClass} value={form.recoveryQuestion} onChange={(e) => setForm({ ...form, recoveryQuestion: e.target.value })}>{RECOVERY_QUESTIONS.map((question) => <option key={question}>{question}</option>)}</select><input className={fieldClass} placeholder={text.recoveryAnswer} value={form.recoveryAnswer} onChange={(e) => setForm({ ...form, recoveryAnswer: e.target.value })} />{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold">{text.create}</button></form></AuthShell>;
}

function LoginScreen({ text, users, onLogin }: { text: AuthText; users: UserAccount[]; onLogin: (u: string, p: string) => Promise<{ ok: boolean; reason?: string; retryAt?: number }> }) {
  const [selected, setSelected] = useState(users.find((user) => user.active)?.username ?? users[0]?.username ?? '');
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [lockedUntil, setLockedUntil] = useState<number | undefined>(); const [recover, setRecover] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => { const user = getUserByUsername(selected); setLockedUntil(user?.lockedUntil); }, 500); return () => window.clearInterval(timer); }, [selected]);
  if (recover) return <RecoveryScreen text={text} users={users} onBack={() => setRecover(false)} />;
  const remaining = lockedUntil ? getLockoutRemaining(getUserByUsername(selected)) : 0;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const result = await onLogin(selected, password); if (!result.ok) { setLockedUntil(result.retryAt); setError(result.reason === 'inactive' ? text.inactive : result.reason === 'locked' ? text.locked : text.invalid); } else setError(''); };
  return <AuthShell title={text.login} subtitle="SOCDOF"><form onSubmit={submit} className="space-y-4"><select className={fieldClass} value={selected} onChange={(e) => { setSelected(e.target.value); setPassword(''); setError(''); }}>{users.map((user) => <option key={user.id} value={user.username} disabled={!user.active}>{user.avatar ?? '●'} {user.displayName} · {user.username}{!user.active ? ` · ${text.disabled}` : ''}</option>)}</select><input autoFocus className={fieldClass} type="password" placeholder={text.password} value={password} onChange={(e) => setPassword(e.target.value)} disabled={remaining > 0} />{remaining > 0 && <p className="text-sm text-amber-600">{text.retry} {Math.ceil(remaining / 1000)}s</p>}{error && <p className="text-sm text-red-600">{error}</p>}<button disabled={remaining > 0} className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"><LogIn size={17} />{text.login}</button><button type="button" onClick={() => setRecover(true)} className="w-full text-sm text-indigo-600 hover:underline">{text.forgot}</button></form></AuthShell>;
}

function ForcedPasswordScreen({ text, user, onDone, onLogout }: { text: AuthText; user: UserAccount; onDone: () => void; onLogout: () => void }) {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (password !== confirm) return setError(text.mismatch); try { await changePassword(user.id, password); onDone(); } catch { setError(text.short); } };
  return <AuthShell title={text.newPasswordTitle} subtitle={text.forcePassword}><form onSubmit={submit} className="space-y-4"><input autoFocus className={fieldClass} type="password" placeholder={text.newPassword} value={password} onChange={(e) => setPassword(e.target.value)} /><input className={fieldClass} type="password" placeholder={text.confirm} value={confirm} onChange={(e) => setConfirm(e.target.value)} />{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold">{text.save}</button><button type="button" onClick={onLogout} className="w-full rounded-xl border py-3">{text.logout}</button></form></AuthShell>;
}

function RecoveryScreen({ text, users, onBack }: { text: AuthText; users: UserAccount[]; onBack: () => void }) {
  const [username, setUsername] = useState(users.find((user) => user.active)?.username ?? ''); const [answer, setAnswer] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const user = getUserByUsername(username);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!user) return setError(text.invalid); if (!user.recovery) return setError(text.recoveryUnavailable); if (password !== confirm) return setError(text.mismatch); try { await resetPasswordWithRecovery(user.id, answer, password); onBack(); } catch (err) { const reason = String((err as Error).message); setError(reason === 'recovery_invalid' ? text.recoveryInvalid : reason === 'password_too_short' ? text.short : text.required); } };
  return <AuthShell title={text.recover} subtitle={text.newPasswordTitle}><form onSubmit={submit} className="space-y-4"><select className={fieldClass} value={username} onChange={(e) => { setUsername(e.target.value); setAnswer(''); setError(''); }}>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.username}>{u.displayName} · {u.username}</option>)}</select>{user?.recovery && <><p className="text-sm text-slate-500">{user.recovery.question}</p><input className={fieldClass} placeholder={text.recoveryAnswer} value={answer} onChange={(e) => setAnswer(e.target.value)} /><input className={fieldClass} type="password" placeholder={text.newPassword} value={password} onChange={(e) => setPassword(e.target.value)} /><input className={fieldClass} type="password" placeholder={text.confirm} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></>}{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold">{text.save}</button><button type="button" onClick={onBack} className="w-full rounded-xl border py-3">{text.backLogin}</button></form></AuthShell>;
}

function LockScreen({ text, user, users, onUnlock, onSwitch }: { text: AuthText; user: UserAccount; users: UserAccount[]; onUnlock: (u: string, p: string) => Promise<{ ok: boolean; reason?: string; retryAt?: number }>; onSwitch: () => void }) {
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [selected, setSelected] = useState(user.username); const [now, setNow] = useState(new Date());
  const selectedUser = getUserByUsername(selected) ?? user;
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const result = await onUnlock(selectedUser.username, password); if (!result.ok) setError(result.reason === 'locked' ? text.locked : text.invalid); else setError(''); };
  const wallpaper = selectedUser.preferences.wallpaper;
  return <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center p-6">{wallpaper && <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: `url(${wallpaper})` }} />}{wallpaper && <div className="absolute inset-0 bg-black/20" />}<div className="relative w-full max-w-md rounded-3xl border border-white/60 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl shadow-2xl p-8"><div className="text-center mb-6"><div className="text-4xl font-semibold tracking-tight">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div className="text-xs text-slate-500 mt-1">{now.toLocaleDateString()} · {text.clock}</div></div><div className="flex justify-center gap-2 mb-5">{users.filter((u) => u.active).map((u) => <button key={u.id} type="button" onClick={() => { setSelected(u.username); setPassword(''); setError(''); }} className={`w-14 h-14 rounded-2xl border overflow-hidden ${selected === u.username ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'}`}>{u.avatar?.startsWith('data:image/') ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-xl">{u.avatar ?? '●'}</span>}<span className="block text-[8px] truncate px-1">{u.displayName}</span></button>)}</div><form onSubmit={submit} className="space-y-4"><p className="text-center font-medium">{selectedUser.displayName}</p><input autoFocus className={fieldClass} type="password" placeholder={text.password} value={password} onChange={(e) => setPassword(e.target.value)} />{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold">{text.unlock}</button><button type="button" onClick={onSwitch} className="w-full rounded-xl border py-3">{text.switchUser}</button></form><p className="text-center text-[11px] text-slate-400 mt-4">{text.shortcut}</p></div></div>;
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-6"><div className="w-full max-w-md rounded-3xl border border-white/60 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 text-slate-900 dark:text-white backdrop-blur-2xl shadow-2xl p-8"><div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-5"><ShieldCheck size={25} /></div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-7">{subtitle}</p>{children}</div></div>; }

function UserManager({ text, currentUser, users, onClose, onRefresh, onLogout }: { text: AuthText; currentUser: UserAccount; users: UserAccount[]; onClose: () => void; onRefresh: () => void; onLogout: () => void }) {
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
