import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LockKeyhole, LogIn, LogOut, Plus, ShieldCheck, UserRound, UserRoundCog, Users, X } from 'lucide-react';
import {
  AccountType,
  authenticate,
  changePassword,
  clearSession,
  createUser,
  deleteUser,
  getSession,
  getUserById,
  getUsers,
  hasUsers,
  lockSession,
  saveSession,
  unlockSession,
  updateUser,
  type UserAccount,
  type UserRole
} from '../lib/auth';

const copy = {
  en: {
    welcome: 'Welcome to SOCDOF', setup: 'Create the first local administrator account.', login: 'Sign in', username: 'Username', displayName: 'Display name', password: 'Password', confirm: 'Confirm password', account: 'Account type', personal: 'Personal', business: 'Business', create: 'Create account', invalid: 'Username or password is incorrect.', inactive: 'This account is disabled.', locked: 'Too many failed attempts. Try again in a moment.', short: 'Password must contain at least 8 characters.', mismatch: 'Passwords do not match.', exists: 'That username already exists.', required: 'Please complete all required fields.', lock: 'Lock', logout: 'Sign out', switchUser: 'Switch user', unlock: 'Unlock', lockedTitle: 'Workstation locked', lockedDesc: 'Enter your password to continue.', users: 'Users & Security', add: 'Add user', role: 'Role', admin: 'Administrator', user: 'User', active: 'Active', disabled: 'Disabled', deactivate: 'Disable', activate: 'Enable', remove: 'Delete', passwordChange: 'Change password', newPassword: 'New password', save: 'Save', close: 'Close', current: 'Current user', manage: 'Manage users', lastAdmin: 'The last active administrator cannot be deleted or disabled.', resetDone: 'Password changed.'
  },
  de: {
    welcome: 'Willkommen bei SOCDOF', setup: 'Erstelle das erste lokale Administratorkonto.', login: 'Anmelden', username: 'Benutzername', displayName: 'Anzeigename', password: 'Passwort', confirm: 'Passwort bestätigen', account: 'Kontotyp', personal: 'Privat', business: 'Geschäftlich', create: 'Konto erstellen', invalid: 'Benutzername oder Passwort ist falsch.', inactive: 'Dieses Konto ist deaktiviert.', locked: 'Zu viele Fehlversuche. Versuche es gleich erneut.', short: 'Das Passwort muss mindestens 8 Zeichen enthalten.', mismatch: 'Die Passwörter stimmen nicht überein.', exists: 'Dieser Benutzername existiert bereits.', required: 'Bitte fülle alle Pflichtfelder aus.', lock: 'Sperren', logout: 'Abmelden', switchUser: 'Benutzer wechseln', unlock: 'Entsperren', lockedTitle: 'Arbeitsplatz gesperrt', lockedDesc: 'Gib dein Passwort ein, um fortzufahren.', users: 'Benutzer & Sicherheit', add: 'Benutzer hinzufügen', role: 'Rolle', admin: 'Administrator', user: 'Benutzer', active: 'Aktiv', disabled: 'Deaktiviert', deactivate: 'Deaktivieren', activate: 'Aktivieren', remove: 'Löschen', passwordChange: 'Passwort ändern', newPassword: 'Neues Passwort', save: 'Speichern', close: 'Schließen', current: 'Aktueller Benutzer', manage: 'Benutzer verwalten', lastAdmin: 'Der letzte aktive Administrator kann nicht gelöscht oder deaktiviert werden.', resetDone: 'Passwort geändert.'
  },
  fr: {
    welcome: 'Bienvenue dans SOCDOF', setup: 'Créez le premier compte administrateur local.', login: 'Se connecter', username: "Nom d'utilisateur", displayName: "Nom d'affichage", password: 'Mot de passe', confirm: 'Confirmer le mot de passe', account: 'Type de compte', personal: 'Personnel', business: 'Professionnel', create: 'Créer le compte', invalid: "Nom d'utilisateur ou mot de passe incorrect.", inactive: 'Ce compte est désactivé.', locked: 'Trop de tentatives. Réessayez dans un instant.', short: 'Le mot de passe doit contenir au moins 8 caractères.', mismatch: 'Les mots de passe ne correspondent pas.', exists: "Ce nom d'utilisateur existe déjà.", required: 'Veuillez remplir tous les champs obligatoires.', lock: 'Verrouiller', logout: 'Se déconnecter', switchUser: 'Changer d’utilisateur', unlock: 'Déverrouiller', lockedTitle: 'Poste verrouillé', lockedDesc: 'Saisissez votre mot de passe pour continuer.', users: 'Utilisateurs & sécurité', add: 'Ajouter un utilisateur', role: 'Rôle', admin: 'Administrateur', user: 'Utilisateur', active: 'Actif', disabled: 'Désactivé', deactivate: 'Désactiver', activate: 'Activer', remove: 'Supprimer', passwordChange: 'Changer le mot de passe', newPassword: 'Nouveau mot de passe', save: 'Enregistrer', close: 'Fermer', current: 'Utilisateur actuel', manage: 'Gérer les utilisateurs', lastAdmin: 'Le dernier administrateur actif ne peut pas être supprimé ou désactivé.', resetDone: 'Mot de passe modifié.'
  },
  es: {
    welcome: 'Bienvenido a SOCDOF', setup: 'Crea la primera cuenta de administrador local.', login: 'Iniciar sesión', username: 'Usuario', displayName: 'Nombre visible', password: 'Contraseña', confirm: 'Confirmar contraseña', account: 'Tipo de cuenta', personal: 'Personal', business: 'Empresa', create: 'Crear cuenta', invalid: 'El usuario o la contraseña no son correctos.', inactive: 'Esta cuenta está desactivada.', locked: 'Demasiados intentos. Inténtalo de nuevo en un momento.', short: 'La contraseña debe tener al menos 8 caracteres.', mismatch: 'Las contraseñas no coinciden.', exists: 'Ese nombre de usuario ya existe.', required: 'Completa todos los campos obligatorios.', lock: 'Bloquear', logout: 'Cerrar sesión', switchUser: 'Cambiar usuario', unlock: 'Desbloquear', lockedTitle: 'Puesto bloqueado', lockedDesc: 'Introduce tu contraseña para continuar.', users: 'Usuarios y seguridad', add: 'Añadir usuario', role: 'Rol', admin: 'Administrador', user: 'Usuario', active: 'Activo', disabled: 'Desactivado', deactivate: 'Desactivar', activate: 'Activar', remove: 'Eliminar', passwordChange: 'Cambiar contraseña', newPassword: 'Nueva contraseña', save: 'Guardar', close: 'Cerrar', current: 'Usuario actual', manage: 'Gestionar usuarios', lastAdmin: 'El último administrador activo no puede eliminarse ni desactivarse.', resetDone: 'Contraseña cambiada.'
  }
} as const;

type Lang = keyof typeof copy;

const getLang = (): Lang => {
  try {
    const value = localStorage.getItem('socdof_language');
    return value === 'de' || value === 'fr' || value === 'es' ? value : 'en';
  } catch {
    return 'en';
  }
};

const fieldClass = 'w-full rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/40';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<UserAccount[]>(() => getUsers());
  const [session, setSession] = useState(() => getSession());
  const [lang, setLang] = useState<Lang>(() => getLang());
  const [locked, setLocked] = useState(() => Boolean(getSession()?.locked));
  const [showManager, setShowManager] = useState(false);
  const [error, setError] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(15);

  const refresh = useCallback(() => {
    setUsers(getUsers());
    const current = getSession();
    setSession(current);
    setLocked(Boolean(current?.locked));
  }, []);

  useEffect(() => {
    const onStorage = () => { setLang(getLang()); refresh(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const currentUser = session ? getUserById(session.userId) : null;
  const text = copy[lang];

  const login = async (username: string, password: string) => {
    setError('');
    const result = await authenticate(username, password);
    if (!result.ok) {
      setError(result.reason === 'inactive' ? text.inactive : result.reason === 'locked' ? text.locked : text.invalid);
      refresh();
      return false;
    }
    setSession(result.session);
    setLocked(false);
    setUsers(getUsers());
    return true;
  };

  useEffect(() => {
    if (!session || locked) return;
    const activity = () => {
      const current = getSession();
      if (!current || current.locked) return;
      saveSession({ ...current, lastActivityAt: Date.now() });
    };
    const events = ['mousedown', 'keydown', 'pointerdown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, activity));
    const timer = window.setInterval(() => {
      const current = getSession();
      if (!current || current.locked) return;
      const minutes = currentUser?.preferences.autoLockMinutes ?? autoLockMinutes;
      if (minutes > 0 && Date.now() - current.lastActivityAt >= minutes * 60_000) {
        lockSession();
        setLocked(true);
      }
    }, 15_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, activity));
      window.clearInterval(timer);
    };
  }, [session, locked, currentUser, autoLockMinutes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        if (getSession() && !locked) {
          lockSession();
          setLocked(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [locked]);

  if (!hasUsers()) {
    return <FirstAccount lang={lang} text={text} onCreated={refresh} />;
  }

  if (!session || !currentUser) {
    return <LoginScreen lang={lang} text={text} onLogin={login} users={users} />;
  }

  if (locked) {
    return <LockScreen text={text} user={currentUser} onUnlock={login} onSwitch={() => { clearSession(); setSession(null); setLocked(false); }} />;
  }

  return (
    <div className="relative w-full h-full">
      {children}
      <div className="fixed top-3 right-3 z-[9999] flex items-center gap-1 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl shadow-lg px-2 py-1.5">
        <button title={text.lock} onClick={() => { lockSession(); setLocked(true); }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><LockKeyhole size={16} /></button>
        <button title={text.manage} onClick={() => setShowManager(true)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><UserRoundCog size={16} /></button>
        <button title={text.logout} onClick={() => { clearSession(); setSession(null); }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><LogOut size={16} /></button>
        <div className="px-2 text-xs font-medium max-w-32 truncate">{currentUser.displayName}</div>
      </div>
      {showManager && (
        <UserManager text={text} currentUser={currentUser} users={users} autoLockMinutes={currentUser.preferences.autoLockMinutes ?? autoLockMinutes} onAutoLockChange={(minutes) => { updateUser(currentUser.id, { preferences: { ...currentUser.preferences, autoLockMinutes: minutes } }); setAutoLockMinutes(minutes); refresh(); }} onClose={() => setShowManager(false)} onRefresh={refresh} onLogout={() => { clearSession(); setSession(null); setShowManager(false); }} />
      )}
    </div>
  );
}

function FirstAccount({ lang, text, onCreated }: { lang: Lang; text: typeof copy[Lang]; onCreated: () => void }) {
  const [form, setForm] = useState({ username: '', displayName: '', password: '', confirm: '', accountType: 'personal' as AccountType });
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.username || !form.displayName || !form.password) return setError(text.required);
    if (form.password !== form.confirm) return setError(text.mismatch);
    try {
      await createUser(form);
      onCreated();
    } catch (err) {
      const reason = String((err as Error).message);
      setError(reason === 'password_too_short' ? text.short : reason === 'username_exists' ? text.exists : text.required);
    }
  };
  return <AuthShell title={text.welcome} subtitle={text.setup}><form onSubmit={submit} className="space-y-4">
    <input autoFocus className={fieldClass} placeholder={text.displayName} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
    <input className={fieldClass} placeholder={text.username} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
    <input className={fieldClass} type="password" placeholder={text.password} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
    <input className={fieldClass} type="password" placeholder={text.confirm} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm({ ...form, accountType: 'personal' })} className={`rounded-xl border p-3 text-left ${form.accountType === 'personal' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'}`}>{text.personal}</button><button type="button" onClick={() => setForm({ ...form, accountType: 'business' })} className={`rounded-xl border p-3 text-left ${form.accountType === 'business' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'}`}>{text.business}</button></div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold hover:bg-indigo-500">{text.create}</button>
  </form></AuthShell>;
}

function LoginScreen({ text, onLogin, users }: { lang: Lang; text: typeof copy[Lang]; onLogin: (u: string, p: string) => Promise<boolean>; users: UserAccount[] }) {
  const [selected, setSelected] = useState(users.find((user) => user.active)?.username ?? users[0]?.username ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const ok = await onLogin(selected, password); if (!ok) setError(''); };
  return <AuthShell title={text.login} subtitle="SOCDOF">
    <form onSubmit={submit} className="space-y-4">
      <select className={fieldClass} value={selected} onChange={(e) => setSelected(e.target.value)}>{users.map((user) => <option key={user.id} value={user.username} disabled={!user.active}>{user.displayName} · {user.username}{!user.active ? ` · ${text.disabled}` : ''}</option>)}</select>
      <input autoFocus className={fieldClass} type="password" placeholder={text.password} value={password} onChange={(e) => setPassword(e.target.value)} />
      {(error) && <p className="text-sm text-red-600">{error}</p>}
      <button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold hover:bg-indigo-500 flex items-center justify-center gap-2"><LogIn size={17} />{text.login}</button>
    </form>
  </AuthShell>;
}

function LockScreen({ text, user, onUnlock, onSwitch }: { text: typeof copy[Lang]; user: UserAccount; onUnlock: (u: string, p: string) => Promise<boolean>; onSwitch: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const ok = await onUnlock(user.username, password); if (!ok) setError(text.invalid); };
  return <AuthShell title={text.lockedTitle} subtitle={`${user.displayName} · ${text.lockedDesc}`}><form onSubmit={submit} className="space-y-4"><input autoFocus className={fieldClass} type="password" placeholder={text.password} value={password} onChange={(e) => setPassword(e.target.value)} />{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-xl bg-indigo-600 text-white py-3 font-semibold">{text.unlock}</button><button type="button" onClick={onSwitch} className="w-full rounded-xl border py-3">{text.switchUser}</button></form></AuthShell>;
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-6"><div className="w-full max-w-md rounded-3xl border border-white/60 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl shadow-2xl p-8"><div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-5"><ShieldCheck size={25} /></div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-7">{subtitle}</p>{children}</div></div>;
}

function UserManager({ text, currentUser, users, autoLockMinutes, onAutoLockChange, onClose, onRefresh, onLogout }: { text: typeof copy[Lang]; currentUser: UserAccount; users: UserAccount[]; autoLockMinutes: number; onAutoLockChange: (minutes: number) => void; onClose: () => void; onRefresh: () => void; onLogout: () => void }) {
  const [selectedId, setSelectedId] = useState(currentUser.id);
  const [newUser, setNewUser] = useState({ username: '', displayName: '', password: '', accountType: 'business' as AccountType, role: 'user' as UserRole });
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const selected = users.find((user) => user.id === selectedId) ?? currentUser;
  const canManage = currentUser.role === 'admin';
  const create = async () => {
    try { await createUser(newUser); setNewUser({ username: '', displayName: '', password: '', accountType: 'business', role: 'user' }); setMessage(''); onRefresh(); } catch (err) { setMessage(String((err as Error).message) === 'password_too_short' ? text.short : text.exists); }
  };
  const toggle = () => {
    if (selected.id === currentUser.id) return;
    try { updateUser(selected.id, { active: !selected.active }); onRefresh(); } catch { setMessage(text.lastAdmin); }
  };
  const remove = () => {
    if (selected.id === currentUser.id) return;
    try { deleteUser(selected.id); onRefresh(); setSelectedId(currentUser.id); } catch { setMessage(text.lastAdmin); }
  };
  const savePassword = async () => {
    try { await changePassword(selected.id, newPassword); setNewPassword(''); setMessage(text.resetDone); onRefresh(); } catch { setMessage(text.short); }
  };
  return <div className="fixed inset-0 z-[10000] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6"><div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-white/10 p-6"><div className="flex items-center justify-between mb-5"><div><h2 className="text-xl font-bold">{text.users}</h2><p className="text-sm text-slate-500">{text.current}: {currentUser.displayName}</p></div><button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button></div><div className="grid md:grid-cols-2 gap-5"><div className="space-y-2">{users.map((user) => <button key={user.id} onClick={() => setSelectedId(user.id)} className={`w-full text-left p-3 rounded-2xl border ${selected.id === user.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-white/10'}`}><div className="font-medium">{user.displayName}</div><div className="text-xs text-slate-500">@{user.username} · {user.role === 'admin' ? text.admin : text.user} · {user.active ? text.active : text.disabled}</div></button>)}<div className="pt-4 border-t dark:border-white/10"><label className="text-xs text-slate-500">Auto-lock</label><select className={fieldClass} value={autoLockMinutes} onChange={(e) => onAutoLockChange(Number(e.target.value))}><option value={0}>Off</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>60 min</option></select></div></div><div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-3"><div className="flex items-center gap-2 font-semibold"><UserRound size={17} />{selected.displayName}</div>{canManage && <><div className="grid grid-cols-2 gap-2"><select className={fieldClass} value={selected.role} onChange={(e) => { if (selected.id !== currentUser.id) { updateUser(selected.id, { role: e.target.value as UserRole }); onRefresh(); } }}><option value="user">{text.user}</option><option value="admin">{text.admin}</option></select><select className={fieldClass} value={selected.accountType} onChange={(e) => { updateUser(selected.id, { accountType: e.target.value as AccountType }); onRefresh(); }}><option value="personal">{text.personal}</option><option value="business">{text.business}</option></select></div><div className="flex gap-2"><button onClick={toggle} className="flex-1 rounded-xl border py-2">{selected.active ? text.deactivate : text.activate}</button><button onClick={remove} className="rounded-xl border border-red-200 text-red-600 px-4 py-2">{text.remove}</button></div></>}<div className="pt-3 border-t dark:border-white/10"><label className="text-xs text-slate-500">{text.passwordChange}</label><div className="flex gap-2 mt-2"><input className={fieldClass} type="password" placeholder={text.newPassword} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button onClick={savePassword} className="rounded-xl bg-indigo-600 text-white px-4">{text.save}</button></div></div>{message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}</div></div><div className="mt-5 flex justify-between"><button onClick={() => { clearSession(); onLogout(); }} className="rounded-xl border px-4 py-2">{text.logout}</button>{canManage && <div className="flex gap-2"><input className="rounded-xl border px-3 py-2" placeholder={text.displayName} value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} /><input className="rounded-xl border px-3 py-2" placeholder={text.username} value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} /><input className="rounded-xl border px-3 py-2" type="password" placeholder={text.password} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /><button onClick={create} className="rounded-xl bg-indigo-600 text-white px-3" title={text.add}><Plus size={17} /></button></div>}</div></div></div>;
}
