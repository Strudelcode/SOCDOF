import React, { useMemo, useState } from 'react';
import {
  Check,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundPlus,
  UserRoundX,
  X
} from 'lucide-react';
import {
  adminResetPassword,
  createUser,
  deleteUser,
  getActiveAdminCount,
  getCurrentUser,
  getSecuritySettings,
  getUsers,
  updateSecuritySettings,
  updateUser,
  type AccountType,
  type SecuritySettings,
  type UserAccount,
  type UserRole,
  RECOVERY_QUESTIONS
} from '../lib/auth';
import { getRecoveryQuestionLabel, t, useLanguage } from '../lib/i18n';

const avatars = ['●', '◆', '▲', '■', '✦', '✚', '◉', '⬢'];

const fieldClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white scheme-light dark:scheme-dark px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const UserManagementSettings: React.FC = () => {
  const lang = useLanguage();
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState<UserAccount[]>(() => getUsers());
  const [selectedId, setSelectedId] = useState<string>(() => currentUser?.id ?? getUsers()[0]?.id ?? '');
  const [showCreate, setShowCreate] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [security, setSecurity] = useState<SecuritySettings>(() => getSecuritySettings());
  const [newUser, setNewUser] = useState({
    username: '',
    displayName: '',
    password: '',
    role: 'user' as UserRole,
    accountType: 'business' as AccountType,
    avatar: avatars[0],
    recoveryQuestion: RECOVERY_QUESTIONS[0],
    recoveryAnswer: ''
  });

  const refresh = () => setUsers([...getUsers()]);
  const selected = users.find(user => user.id === selectedId) ?? currentUser ?? null;
  const isAdmin = currentUser?.role === 'admin' && currentUser.active;

  const labels = useMemo(() => ({
    title: t('users.title', lang),
    subtitle: t('users.subtitle', lang),
    administratorOnly: t('users.admin_only', lang),
    accountList: t('users.account_list', lang),
    add: t('users.add', lang),
    create: t('users.create', lang),
    displayName: t('users.display_name', lang),
    username: t('users.username', lang),
    password: t('users.password', lang),
    confirm: t('users.confirm_password', lang),
    role: t('users.role', lang),
    accountType: t('users.account_type', lang),
    personal: t('users.personal', lang),
    business: t('users.business', lang),
    admin: t('users.admin', lang),
    user: t('users.user', lang),
    active: t('users.active', lang),
    disabled: t('users.disabled', lang),
    enable: t('users.enable', lang),
    disable: t('users.disable', lang),
    delete: t('users.delete', lang),
    save: t('users.save', lang),
    resetPassword: t('users.reset_password', lang),
    newPassword: t('users.new_password', lang),
    recoveryQuestion: t('users.recovery_question', lang),
    recoveryAnswer: t('users.recovery_answer', lang),
    autoLock: t('users.auto_lock', lang),
    security: t('users.security', lang),
    failedAttempts: t('users.failed_attempts', lang),
    lockout: t('users.lockout', lang),
    backoff: t('users.backoff', lang),
    enabled: t('users.enabled', lang),
    off: t('users.off', lang),
    minutes: t('users.minutes', lang),
    current: t('users.current', lang),
    noUsers: t('users.no_users', lang),
    adminRequired: t('users.admin_required', lang),
    lastAdmin: t('users.last_admin', lang),
    passwordTooShort: t('users.password_too_short', lang),
    passwordMismatch: t('users.password_mismatch', lang),
    usernameExists: t('users.username_exists', lang),
    required: t('users.required', lang),
    saved: t('users.saved', lang),
    created: t('users.created', lang),
    deleted: t('users.deleted', lang),
    passwordReset: t('users.password_reset', lang),
    securitySaved: t('users.security_saved', lang)
  }), [lang]);

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{labels.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{labels.adminRequired}</p>
          </div>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.displayName.trim() || !newUser.password) {
      setMessage(labels.required);
      return;
    }
    if (newUser.password.length < 8) {
      setMessage(labels.passwordTooShort);
      return;
    }
    try {
      await createUser(newUser);
      setNewUser({
        username: '',
        displayName: '',
        password: '',
        role: 'user',
        accountType: 'business',
        avatar: avatars[0],
        recoveryQuestion: RECOVERY_QUESTIONS[0],
        recoveryAnswer: ''
      });
      setShowCreate(false);
      setMessage(labels.created);
      refresh();
    } catch (error) {
      const reason = String((error as Error).message);
      setMessage(
        reason === 'username_exists'
          ? labels.usernameExists
          : reason === 'password_too_short'
            ? labels.passwordTooShort
            : reason === 'recovery_answer_required'
              ? labels.required
              : labels.required
      );
    }
  };

  const saveSelected = () => {
    if (!selected) return;
    try {
      updateUser(selected.id, {
        displayName: selected.displayName,
        role: selected.role,
        accountType: selected.accountType,
        avatar: selected.avatar,
        preferences: selected.preferences
      });
      setMessage(labels.saved);
      refresh();
    } catch {
      setMessage(labels.lastAdmin);
    }
  };

  const toggleSelected = () => {
    if (!selected || selected.id === currentUser?.id) return;
    try {
      updateUser(selected.id, { active: !selected.active });
      setMessage(labels.saved);
      refresh();
    } catch {
      setMessage(labels.lastAdmin);
    }
  };

  const removeSelected = () => {
    if (!selected || selected.id === currentUser?.id) return;
    try {
      deleteUser(selected.id);
      setSelectedId(currentUser?.id ?? '');
      setMessage(labels.deleted);
      refresh();
    } catch {
      setMessage(labels.lastAdmin);
    }
  };

  const resetSelectedPassword = async () => {
    if (!selected || !newPassword) return;
    try {
      await adminResetPassword(selected.id, newPassword);
      setNewPassword('');
      setMessage(labels.passwordReset);
      refresh();
    } catch {
      setMessage(labels.passwordTooShort);
    }
  };

  const saveSecurity = () => {
    try {
      updateSecuritySettings(security);
      setSecurity(getSecuritySettings());
      setMessage(labels.securitySaved);
    } catch {
      setMessage(labels.adminRequired);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{labels.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">{labels.subtitle}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/50">
            <ShieldCheck className="w-3.5 h-3.5" />
            {labels.administratorOnly}
          </span>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-5 p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{labels.accountList}</span>
              <button
                type="button"
                onClick={() => setShowCreate(value => !value)}
                className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition"
                title={labels.add}
              >
                {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>
            {users.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">{labels.noUsers}</div>
            ) : users.map(user => (
              <button
                type="button"
                key={user.id}
                onClick={() => setSelectedId(user.id)}
                className={`w-full text-left p-3 rounded-2xl border transition ${selected?.id === user.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70'}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">
                    {user.avatar?.startsWith('data:image/') ? <img src={user.avatar} alt="" className="w-full h-full rounded-xl object-cover" /> : user.avatar ?? '●'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">{user.displayName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">@{user.username}</div>
                  </div>
                  <span className={`ml-auto w-2 h-2 rounded-full ${user.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                </div>
                <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                  {user.role === 'admin' ? labels.admin : labels.user} · {user.active ? labels.active : labels.disabled}
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {showCreate && (
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                  <UserRoundPlus className="w-4 h-4 text-indigo-500" />
                  {labels.create}
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  <input className={fieldClass} placeholder={labels.displayName} value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} />
                  <input className={fieldClass} placeholder={labels.username} value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                  <input className={fieldClass} type="password" placeholder={labels.password} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                  <select className={fieldClass} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}>
                    <option value="user">{labels.user}</option>
                    <option value="admin">{labels.admin}</option>
                  </select>
                  <select className={fieldClass} value={newUser.accountType} onChange={e => setNewUser({ ...newUser, accountType: e.target.value as AccountType })}>
                    <option value="personal">{labels.personal}</option>
                    <option value="business">{labels.business}</option>
                  </select>
                  <select className={fieldClass} value={newUser.recoveryQuestion} onChange={e => setNewUser({ ...newUser, recoveryQuestion: e.target.value })}>
                    {RECOVERY_QUESTIONS.map(question => <option key={question} value={question}>{getRecoveryQuestionLabel(question, lang)}</option>)}
                  </select>
                  <input className={fieldClass} placeholder={labels.recoveryAnswer} value={newUser.recoveryAnswer} onChange={e => setNewUser({ ...newUser, recoveryAnswer: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {avatars.map(avatar => (
                    <button type="button" key={avatar} onClick={() => setNewUser({ ...newUser, avatar })} className={`w-9 h-9 rounded-xl border text-sm ${newUser.avatar === avatar ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}>{avatar}</button>
                  ))}
                </div>
                <button type="button" onClick={handleCreate} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />{labels.create}
                </button>
              </div>
            )}

            {selected && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg">
                    {selected.avatar?.startsWith('data:image/') ? <img src={selected.avatar} alt="" className="w-full h-full rounded-2xl object-cover" /> : selected.avatar ?? '●'}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{selected.displayName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">@{selected.username} · {selected.id === currentUser?.id ? labels.current : ''}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {avatars.map(avatar => (
                    <button type="button" key={avatar} onClick={() => { updateUser(selected.id, { avatar }); refresh(); }} className={`w-9 h-9 rounded-xl border text-sm ${selected.avatar === avatar ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}>{avatar}</button>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                  <input className={fieldClass} value={selected.displayName} onChange={e => { updateUser(selected.id, { displayName: e.target.value }); refresh(); }} />
                  <select className={fieldClass} value={selected.role} onChange={e => { try { updateUser(selected.id, { role: e.target.value as UserRole }); refresh(); } catch { setMessage(labels.lastAdmin); } }}>
                    <option value="user">{labels.user}</option>
                    <option value="admin">{labels.admin}</option>
                  </select>
                  <select className={fieldClass} value={selected.accountType} onChange={e => { updateUser(selected.id, { accountType: e.target.value as AccountType }); refresh(); }}>
                    <option value="personal">{labels.personal}</option>
                    <option value="business">{labels.business}</option>
                  </select>
                  <select className={fieldClass} value={selected.preferences.autoLockMinutes ?? 15} onChange={e => { updateUser(selected.id, { preferences: { ...selected.preferences, autoLockMinutes: Number(e.target.value) } }); refresh(); }}>
                    <option value={0}>{labels.autoLock}: {labels.off}</option>
                    <option value={5}>5 {labels.minutes}</option>
                    <option value={10}>10 {labels.minutes}</option>
                    <option value={15}>15 {labels.minutes}</option>
                    <option value={30}>30 {labels.minutes}</option>
                    <option value={60}>60 {labels.minutes}</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={saveSelected} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">{labels.save}</button>
                  <button type="button" onClick={toggleSelected} disabled={selected.id === currentUser?.id} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40">{selected.active ? labels.disable : labels.enable}</button>
                  <button type="button" onClick={removeSelected} disabled={selected.id === currentUser?.id || (selected.role === 'admin' && getActiveAdminCount() <= 1)} className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold disabled:opacity-40"><UserRoundX className="w-3.5 h-3.5 inline mr-1" />{labels.delete}</button>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white"><KeyRound className="w-4 h-4 text-indigo-500" />{labels.resetPassword}</div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <input className={fieldClass} type="password" placeholder={labels.newPassword} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <button type="button" onClick={resetSelectedPassword} className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold">{labels.save}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{labels.security}</h4>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            <span className="block mb-1 text-slate-500">{labels.failedAttempts}</span>
            <select className={fieldClass} value={security.failedAttemptThreshold} onChange={e => setSecurity({ ...security, failedAttemptThreshold: Number(e.target.value) as SecuritySettings['failedAttemptThreshold'] })}>
              <option value={3}>3</option><option value={5}>5</option><option value={10}>10</option>
            </select>
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            <span className="block mb-1 text-slate-500">{labels.lockout}</span>
            <select className={fieldClass} value={security.lockoutMinutes} onChange={e => setSecurity({ ...security, lockoutMinutes: Number(e.target.value) as SecuritySettings['lockoutMinutes'] })}>
              <option value={5}>5 {labels.minutes}</option><option value={10}>10 {labels.minutes}</option><option value={15}>15 {labels.minutes}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3 mt-5 text-xs text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={security.exponentialBackoff} onChange={e => setSecurity({ ...security, exponentialBackoff: e.target.checked })} />
            <span>{labels.backoff}: {security.exponentialBackoff ? labels.enabled : labels.off}</span>
          </label>
        </div>
        <button type="button" onClick={saveSecurity} className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">{labels.save}</button>
      </div>

      {message && (
        <div className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300">{message}</div>
      )}
    </div>
  );
};
