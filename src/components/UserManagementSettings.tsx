import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Check,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundPlus,
  UserRoundX,
  X,
  ImagePlus,
  Lock,
  UserCheck,
  AlertCircle,
  BriefcaseBusiness
} from 'lucide-react';
import {
  adminResetPassword,
  changePassword,
  createUser,
  deleteUser,
  getActiveAdminCount,
  getCurrentUser,
  getSecuritySettings,
  getUsers,
  updateSecuritySettings,
  updateUser,
  updateUserPreferences,
  verifyPassword,
  type AccountType,
  type SecuritySettings,
  type UserAccount,
  type UserRole,
  RECOVERY_QUESTIONS,
  AUTH_CHANGE_EVENT_NAME
} from '../lib/auth';
import { getRecoveryQuestionLabel, t, useLanguage } from '../lib/i18n';
import { sounds } from '../lib/sound';

const avatars = ['●', '◆', '▲', '■', '✦', '✚', '◉', '⬢'];

const fieldClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white scheme-light dark:scheme-dark px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

function resizeAvatar(file: File, size = 128, quality = 0.86): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('image_read_failed'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('image_decode_failed'));
      image.onload = () => {
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sx = (image.naturalWidth - sourceSize) / 2;
        const sy = (image.naturalHeight - sourceSize) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('image_canvas_failed'));
        context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function resizeWallpaper(file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('image_read_failed'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('image_decode_failed'));
      image.onload = () => {
        let { width, height } = image;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('image_canvas_failed'));
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const UserManagementSettings: React.FC = () => {
  const lang = useLanguage();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getCurrentUser());
  const isAdmin = currentUser?.role === 'admin' && currentUser.active;

  // Active sub-tab: 'profile' (own profile), 'accounts' (all users), 'security' (policies)
  const [activeTab, setActiveTab] = useState<'profile' | 'accounts' | 'security'>('profile');

  // Profile editing state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [avatar, setAvatar] = useState(currentUser?.avatar ?? '');
  const [wallpaper, setWallpaper] = useState(currentUser?.preferences.wallpaper ?? '');
  const [accountType, setAccountType] = useState<AccountType>(currentUser?.accountType ?? 'business');
  const [autoLockMinutes, setAutoLockMinutes] = useState(currentUser?.preferences.autoLockMinutes ?? 15);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Own password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newSelfPassword, setNewSelfPassword] = useState('');
  const [confirmSelfPassword, setConfirmSelfPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // All Accounts State (for Admin)
  const [users, setUsers] = useState<UserAccount[]>(() => getUsers());
  const [selectedId, setSelectedId] = useState<string>(() => currentUser?.id ?? getUsers()[0]?.id ?? '');
  const [showCreate, setShowCreate] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
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

  const refreshUsers = () => {
    const freshUsers = getUsers();
    setUsers([...freshUsers]);
    const freshCurrent = getCurrentUser();
    if (freshCurrent) setCurrentUser(freshCurrent);
  };

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName);
      setAvatar(currentUser.avatar ?? '');
      setWallpaper(currentUser.preferences.wallpaper ?? '');
      setAccountType(currentUser.accountType);
      setAutoLockMinutes(currentUser.preferences.autoLockMinutes ?? 15);
    }
  }, [currentUser]);

  const selected = users.find(u => u.id === selectedId) ?? currentUser ?? null;

  const labels = useMemo(() => ({
    title: t('users.title', lang, 'Benutzer & Konten'),
    subtitle: t('users.subtitle', lang, 'Lokale Konten, Rollen, eigenes Profil, Passwörter und Desktop-Personalisierung verwalten.'),
    tabProfile: t('users.tab_profile', lang, 'Mein Profil & Personalisierung'),
    tabAccounts: t('users.tab_accounts', lang, 'Benutzerverwaltung'),
    tabSecurity: t('users.tab_security', lang, 'Sicherheitsrichtlinien'),
    administratorOnly: t('users.admin_only', lang, 'Nur Administrator'),
    accountList: t('users.account_list', lang, 'Lokale Konten'),
    add: t('users.add', lang, 'Konto hinzufügen'),
    create: t('users.create', lang, 'Konto erstellen'),
    displayName: t('users.display_name', lang, 'Anzeigename'),
    username: t('users.username', lang, 'Benutzername'),
    password: t('users.password', lang, 'Passwort'),
    confirm: t('users.confirm_password', lang, 'Passwort bestätigen'),
    role: t('users.role', lang, 'Rolle'),
    accountType: t('users.account_type', lang, 'Kontotyp'),
    personal: t('users.personal', lang, 'Privat'),
    business: t('users.business', lang, 'Geschäftlich'),
    admin: t('users.admin', lang, 'Administrator'),
    user: t('users.user', lang, 'Benutzer'),
    active: t('users.active', lang, 'Aktiv'),
    disabled: t('users.disabled', lang, 'Deaktiviert'),
    enable: t('users.enable', lang, 'Aktivieren'),
    disable: t('users.disable', lang, 'Deaktivieren'),
    delete: t('users.delete', lang, 'Löschen'),
    save: t('users.save', lang, 'Speichern'),
    resetPassword: t('users.reset_password', lang, 'Passwort zurücksetzen'),
    newPassword: t('users.new_password', lang, 'Neues temporäres Passwort'),
    recoveryQuestion: t('users.recovery_question', lang, 'Sicherheitsfrage'),
    recoveryAnswer: t('users.recovery_answer', lang, 'Sicherheitsantwort'),
    autoLock: t('users.auto_lock', lang, 'Automatische Sperre'),
    security: t('users.security', lang, 'Anmeldesicherheit'),
    failedAttempts: t('users.failed_attempts', lang, 'Fehlversuche'),
    lockout: t('users.lockout', lang, 'Sperrdauer'),
    backoff: t('users.backoff', lang, 'Exponentielles Backoff'),
    enabled: t('users.enabled', lang, 'Aktiviert'),
    off: t('users.off', lang, 'Aus'),
    minutes: t('users.minutes', lang, 'Minuten'),
    current: t('users.current', lang, 'Aktueller Benutzer'),
    noUsers: t('users.no_users', lang, 'Keine lokalen Konten vorhanden.'),
    adminRequired: t('users.admin_required', lang, 'Nur aktive Administratoren können Benutzer verwalten.'),
    lastAdmin: t('users.last_admin', lang, 'Der letzte aktive Administrator kann nicht deaktiviert oder gelöscht werden.'),
    passwordTooShort: t('users.password_too_short', lang, 'Das Passwort muss mindestens 8 Zeichen lang sein.'),
    passwordMismatch: t('users.password_mismatch', lang, 'Die Passwörter stimmen nicht überein.'),
    usernameExists: t('users.username_exists', lang, 'Dieser Benutzername existiert bereits.'),
    required: t('users.required', lang, 'Bitte füllen Sie alle erforderlichen Felder aus.'),
    saved: t('users.saved', lang, 'Einstellungen gespeichert.'),
    created: t('users.created', lang, 'Konto erstellt.'),
    deleted: t('users.deleted', lang, 'Konto gelöscht.'),
    passwordReset: t('users.password_reset', lang, 'Neues temporäres Passwort gesetzt.'),
    securitySaved: t('users.security_saved', lang, 'Sicherheitsrichtlinien gespeichert.'),
    changePhoto: t('users.change_photo', lang, 'Foto ändern'),
    removePhoto: t('users.remove_photo', lang, 'Foto entfernen'),
    wallpaper: t('users.wallpaper', lang, 'Desktop-Hintergrundbild'),
    wallpaperDesc: t('users.wallpaper_desc', lang, 'Personalisieren Sie das Hintergrundbild Ihres Desktops.'),
    uploadWallpaper: t('users.upload_wallpaper', lang, 'Hintergrundbild hochladen'),
    removeWallpaper: t('users.remove_wallpaper', lang, 'Hintergrundbild entfernen'),
    changePasswordTitle: t('users.change_password', lang, 'Passwort ändern'),
    oldPassword: t('users.old_password', lang, 'Aktuelles Passwort'),
    newPasswordLabel: t('users.new_password_label', lang, 'Neues Passwort (mind. 8 Zeichen)'),
    confirmNewPassword: t('users.confirm_new_password', lang, 'Neues Passwort bestätigen'),
    passwordSuccess: t('users.password_success', lang, 'Passwort erfolgreich geändert.'),
    wrongOldPassword: t('users.wrong_old_password', lang, 'Das aktuelle Passwort ist nicht korrekt.'),
    autoLockDesc: t('users.auto_lock_desc', lang, 'Minuten Inaktivität bis zur automatischen Bildschirmsperre (0 = Aus).'),
    accountTypeDesc: t('users.account_type_desc', lang, 'Geschäftskonten zeigen kaufmännische Module. Persönliche Konten fokussieren auf private Organisation.')
  }), [lang]);

  // Handlers for Avatar & Wallpaper
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const resized = await resizeAvatar(file, 128, 0.86);
      setAvatar(resized);
    } catch {
      // ignore errors
    } finally {
      e.target.value = '';
    }
  };

  const handleWallpaperFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const resized = await resizeWallpaper(file, 1920, 1080, 0.82);
      setWallpaper(resized);
    } catch {
      // ignore errors
    } finally {
      e.target.value = '';
    }
  };

  // Save current user's profile
  const handleSaveProfile = () => {
    if (!currentUser) return;
    try {
      const nextPreferences = {
        ...currentUser.preferences,
        wallpaper: wallpaper.trim() || undefined,
        autoLockMinutes: Math.max(0, Math.min(240, autoLockMinutes))
      };
      let updated = updateUser(currentUser.id, {
        displayName: displayName.trim() || currentUser.displayName,
        avatar: avatar.trim() || undefined,
        accountType
      });
      updated = updateUserPreferences(updated.id, nextPreferences);
      setCurrentUser(updated);

      // Dispatch auth change event to notify workspace & taskbars immediately
      window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT_NAME));
      sounds.playSuccess();
      setProfileMessage({ text: labels.saved, type: 'success' });
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err) {
      sounds.playError();
      setProfileMessage({ text: String((err as Error).message || labels.required), type: 'error' });
    }
  };

  // Change own password
  const handleChangeOwnPassword = async () => {
    if (!currentUser) return;
    if (!newSelfPassword || newSelfPassword.length < 8) {
      sounds.playError();
      setPasswordMessage({ text: labels.passwordTooShort, type: 'error' });
      return;
    }
    if (newSelfPassword !== confirmSelfPassword) {
      sounds.playError();
      setPasswordMessage({ text: labels.passwordMismatch, type: 'error' });
      return;
    }
    // Verify old password if provided
    if (currentPassword) {
      const isCorrect = await verifyPassword(currentPassword, currentUser);
      if (!isCorrect) {
        sounds.playError();
        setPasswordMessage({ text: labels.wrongOldPassword, type: 'error' });
        return;
      }
    }
    try {
      await changePassword(currentUser.id, newSelfPassword);
      setCurrentPassword('');
      setNewSelfPassword('');
      setConfirmSelfPassword('');
      sounds.playSuccess();
      setPasswordMessage({ text: labels.passwordSuccess, type: 'success' });
      setTimeout(() => setPasswordMessage(null), 3000);
    } catch (err) {
      sounds.playError();
      setPasswordMessage({ text: String((err as Error).message || 'Error'), type: 'error' });
    }
  };

  // Admin: Create user
  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.displayName.trim() || !newUser.password) {
      setAdminMessage(labels.required);
      return;
    }
    if (newUser.password.length < 8) {
      setAdminMessage(labels.passwordTooShort);
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
      setAdminMessage(labels.created);
      refreshUsers();
      sounds.playSuccess();
    } catch (error) {
      const reason = String((error as Error).message);
      setAdminMessage(
        reason === 'username_exists'
          ? labels.usernameExists
          : reason === 'password_too_short'
            ? labels.passwordTooShort
            : labels.required
      );
      sounds.playError();
    }
  };

  // Admin: Save selected user
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
      setAdminMessage(labels.saved);
      refreshUsers();
      sounds.playSuccess();
    } catch {
      setAdminMessage(labels.lastAdmin);
      sounds.playError();
    }
  };

  // Admin: Toggle selected user active state
  const toggleSelected = () => {
    if (!selected || selected.id === currentUser?.id) return;
    try {
      updateUser(selected.id, { active: !selected.active });
      setAdminMessage(labels.saved);
      refreshUsers();
      sounds.playSuccess();
    } catch {
      setAdminMessage(labels.lastAdmin);
      sounds.playError();
    }
  };

  // Admin: Delete selected user
  const removeSelected = () => {
    if (!selected || selected.id === currentUser?.id) return;
    try {
      deleteUser(selected.id);
      setSelectedId(currentUser?.id ?? '');
      setAdminMessage(labels.deleted);
      refreshUsers();
      sounds.playSuccess();
    } catch {
      setAdminMessage(labels.lastAdmin);
      sounds.playError();
    }
  };

  // Admin: Reset selected user password
  const resetSelectedPassword = async () => {
    if (!selected || !newAdminPassword) return;
    try {
      await adminResetPassword(selected.id, newAdminPassword);
      setNewAdminPassword('');
      setAdminMessage(labels.passwordReset);
      refreshUsers();
      sounds.playSuccess();
    } catch {
      setAdminMessage(labels.passwordTooShort);
      sounds.playError();
    }
  };

  // Admin: Save security settings
  const saveSecurity = () => {
    try {
      updateSecuritySettings(security);
      setSecurity(getSecuritySettings());
      setAdminMessage(labels.securitySaved);
      sounds.playSuccess();
    } catch {
      setAdminMessage(labels.adminRequired);
      sounds.playError();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
              <UserRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">{labels.title}</h3>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800/60">
                    <ShieldCheck className="w-3 h-3" />
                    {labels.admin}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
                    <UserCheck className="w-3 h-3" />
                    {labels.user}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">{labels.subtitle}</p>
            </div>
          </div>

          {/* Tab Selection Navigation (if Admin) */}
          {isAdmin && (
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              <button
                type="button"
                onClick={() => { setActiveTab('profile'); sounds.playClick(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${activeTab === 'profile' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {labels.tabProfile}
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('accounts'); sounds.playClick(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${activeTab === 'accounts' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {labels.tabAccounts}
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('security'); sounds.playClick(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${activeTab === 'security' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {labels.tabSecurity}
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: MEIN PROFIL & PERSONALISIERUNG (Für jeden Benutzer zugänglich)      */}
        {/* ========================================================================= */}
        {(activeTab === 'profile' || !isAdmin) && (
          <div className="p-6 space-y-6">
            {/* User identity card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 border-2 border-indigo-200 dark:border-indigo-800 flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                    {avatar.startsWith('data:image/') ? (
                      <img src={avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {displayName.charAt(0) || currentUser?.username.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-indigo-600 text-white shadow-md hover:bg-indigo-500 transition cursor-pointer"
                    title={labels.changePhoto}
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">{displayName || currentUser?.username}</h4>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono">
                      @{currentUser?.username}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>{currentUser?.role === 'admin' ? labels.admin : labels.user}</span>
                    <span>•</span>
                    <span>{accountType === 'business' ? labels.business : labels.personal}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4 text-indigo-500" />
                  {labels.changePhoto}
                </button>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                    title={labels.removePhoto}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Profile fields: Display Name & Account Type */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{labels.displayName}</label>
                <input
                  className={fieldClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={currentUser?.displayName || 'Anzeigename'}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{labels.accountType}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountType('business')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                      accountType === 'business'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <BriefcaseBusiness className="w-4 h-4" />
                    {labels.business}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('personal')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                      accountType === 'personal'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <UserRound className="w-4 h-4" />
                    {labels.personal}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{labels.accountTypeDesc}</p>
              </div>
            </div>

            {/* Desktop Wallpaper Section */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">{labels.wallpaper}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{labels.wallpaperDesc}</p>
              </div>

              {wallpaper ? (
                <div className="relative h-32 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 shadow-inner group">
                  <img src={wallpaper} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => wallpaperInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-semibold shadow-lg hover:bg-slate-100 transition"
                    >
                      {labels.uploadWallpaper}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWallpaper('')}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-lg hover:bg-rose-500 transition"
                    >
                      {labels.removeWallpaper}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Standard-Systemhintergrund aktiv</span>
                  <button
                    type="button"
                    onClick={() => wallpaperInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4 text-indigo-500" />
                    {labels.uploadWallpaper}
                  </button>
                </div>
              )}
              <input ref={wallpaperInputRef} type="file" accept="image/*" onChange={handleWallpaperFile} className="hidden" />
            </div>

            {/* Auto-Lock Settings */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{labels.autoLock}</label>
              <div className="flex items-center gap-3">
                <select
                  className={`${fieldClass} max-w-xs`}
                  value={autoLockMinutes}
                  onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                >
                  <option value={0}>{labels.off}</option>
                  <option value={5}>5 {labels.minutes}</option>
                  <option value={10}>10 {labels.minutes}</option>
                  <option value={15}>15 {labels.minutes}</option>
                  <option value={30}>30 {labels.minutes}</option>
                  <option value={60}>60 {labels.minutes}</option>
                  <option value={120}>120 {labels.minutes}</option>
                </select>
                <span className="text-xs text-slate-500">{labels.autoLockDesc}</span>
              </div>
            </div>

            {/* Save Profile Button */}
            <div className="pt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveProfile}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {labels.save}
              </button>
              {profileMessage && (
                <div
                  className={`text-xs font-semibold flex items-center gap-1.5 ${
                    profileMessage.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {profileMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {profileMessage.text}
                </div>
              )}
            </div>

            {/* Change Own Password Box */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">{labels.changePasswordTitle}</h4>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <input
                  className={fieldClass}
                  type="password"
                  placeholder={labels.oldPassword}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <input
                  className={fieldClass}
                  type="password"
                  placeholder={labels.newPasswordLabel}
                  value={newSelfPassword}
                  onChange={(e) => setNewSelfPassword(e.target.value)}
                />
                <input
                  className={fieldClass}
                  type="password"
                  placeholder={labels.confirmNewPassword}
                  value={confirmSelfPassword}
                  onChange={(e) => setConfirmSelfPassword(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleChangeOwnPassword}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition cursor-pointer"
                >
                  {labels.changePasswordTitle}
                </button>
                {passwordMessage && (
                  <div
                    className={`text-xs font-semibold flex items-center gap-1.5 ${
                      passwordMessage.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {passwordMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {passwordMessage.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BENUTZERVERWALTUNG - ALLE LOKALEN KONTEN (Nur Administrator)       */}
        {/* ========================================================================= */}
        {activeTab === 'accounts' && isAdmin && (
          <div className="grid lg:grid-cols-[300px_1fr] gap-5 p-6">
            {/* Accounts list sidebar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{labels.accountList}</span>
                <button
                  type="button"
                  onClick={() => { setShowCreate((v) => !v); sounds.playClick(); }}
                  className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition cursor-pointer"
                  title={labels.add}
                >
                  {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </button>
              </div>

              {users.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
                  {labels.noUsers}
                </div>
              ) : (
                users.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => { setSelectedId(u.id); sounds.playClick(); }}
                    className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer ${
                      selected?.id === u.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm shrink-0 overflow-hidden">
                        {u.avatar?.startsWith('data:image/') ? (
                          <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          u.avatar ?? '●'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">{u.displayName}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">@{u.username}</div>
                      </div>
                      <span className={`w-2 h-2 rounded-full ${u.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>{u.role === 'admin' ? labels.admin : labels.user}</span>
                      <span>{u.active ? labels.active : labels.disabled}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Selected User Management Panel */}
            <div className="space-y-4">
              {showCreate && (
                <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <UserRoundPlus className="w-4 h-4 text-indigo-500" />
                    {labels.create}
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <input
                      className={fieldClass}
                      placeholder={labels.displayName}
                      value={newUser.displayName}
                      onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                    />
                    <input
                      className={fieldClass}
                      placeholder={labels.username}
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    />
                    <input
                      className={fieldClass}
                      type="password"
                      placeholder={labels.password}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                    <select
                      className={fieldClass}
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    >
                      <option value="user">{labels.user}</option>
                      <option value="admin">{labels.admin}</option>
                    </select>
                    <select
                      className={fieldClass}
                      value={newUser.accountType}
                      onChange={(e) => setNewUser({ ...newUser, accountType: e.target.value as AccountType })}
                    >
                      <option value="personal">{labels.personal}</option>
                      <option value="business">{labels.business}</option>
                    </select>
                    <select
                      className={fieldClass}
                      value={newUser.recoveryQuestion}
                      onChange={(e) => setNewUser({ ...newUser, recoveryQuestion: e.target.value })}
                    >
                      {RECOVERY_QUESTIONS.map((question) => (
                        <option key={question} value={question}>
                          {getRecoveryQuestionLabel(question, lang)}
                        </option>
                      ))}
                    </select>
                    <input
                      className={fieldClass}
                      placeholder={labels.recoveryAnswer}
                      value={newUser.recoveryAnswer}
                      onChange={(e) => setNewUser({ ...newUser, recoveryAnswer: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {avatars.map((av) => (
                      <button
                        type="button"
                        key={av}
                        onClick={() => setNewUser({ ...newUser, avatar: av })}
                        className={`w-9 h-9 rounded-xl border text-sm ${
                          newUser.avatar === av
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    {labels.create}
                  </button>
                </div>
              )}

              {selected && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg overflow-hidden shrink-0">
                      {selected.avatar?.startsWith('data:image/') ? (
                        <img src={selected.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        selected.avatar ?? '●'
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{selected.displayName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        @{selected.username} {selected.id === currentUser?.id ? `· ${labels.current}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">{labels.displayName}</span>
                      <input
                        className={fieldClass}
                        value={selected.displayName}
                        onChange={(e) => {
                          updateUser(selected.id, { displayName: e.target.value });
                          refreshUsers();
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">{labels.role}</span>
                      <select
                        className={fieldClass}
                        value={selected.role}
                        onChange={(e) => {
                          try {
                            updateUser(selected.id, { role: e.target.value as UserRole });
                            refreshUsers();
                          } catch {
                            setAdminMessage(labels.lastAdmin);
                          }
                        }}
                      >
                        <option value="user">{labels.user}</option>
                        <option value="admin">{labels.admin}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">{labels.accountType}</span>
                      <select
                        className={fieldClass}
                        value={selected.accountType}
                        onChange={(e) => {
                          updateUser(selected.id, { accountType: e.target.value as AccountType });
                          refreshUsers();
                        }}
                      >
                        <option value="personal">{labels.personal}</option>
                        <option value="business">{labels.business}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">{labels.autoLock}</span>
                      <select
                        className={fieldClass}
                        value={selected.preferences.autoLockMinutes ?? 15}
                        onChange={(e) => {
                          updateUser(selected.id, {
                            preferences: { ...selected.preferences, autoLockMinutes: Number(e.target.value) }
                          });
                          refreshUsers();
                        }}
                      >
                        <option value={0}>{labels.off}</option>
                        <option value={5}>5 {labels.minutes}</option>
                        <option value={10}>10 {labels.minutes}</option>
                        <option value={15}>15 {labels.minutes}</option>
                        <option value={30}>30 {labels.minutes}</option>
                        <option value={60}>60 {labels.minutes}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={saveSelected}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                    >
                      {labels.save}
                    </button>
                    <button
                      type="button"
                      onClick={toggleSelected}
                      disabled={selected.id === currentUser?.id}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 cursor-pointer"
                    >
                      {selected.active ? labels.disable : labels.enable}
                    </button>
                    <button
                      type="button"
                      onClick={removeSelected}
                      disabled={selected.id === currentUser?.id || (selected.role === 'admin' && getActiveAdminCount() <= 1)}
                      className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition disabled:opacity-40 cursor-pointer"
                    >
                      <UserRoundX className="w-3.5 h-3.5 inline mr-1" />
                      {labels.delete}
                    </button>
                  </div>

                  {/* Reset Password by Admin */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                      <KeyRound className="w-4 h-4 text-indigo-500" />
                      {labels.resetPassword}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        className={fieldClass}
                        type="password"
                        placeholder={labels.newPassword}
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={resetSelectedPassword}
                        className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition shrink-0 cursor-pointer"
                      >
                        {labels.save}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SICHERHEITSRICHTLINIEN (Nur Administrator)                         */}
        {/* ========================================================================= */}
        {activeTab === 'security' && isAdmin && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{labels.security}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Globale Kontosperren und Schutz vor Brute-Force-Angriffen</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <label className="text-xs text-slate-600 dark:text-slate-300">
                <span className="block mb-1 font-semibold text-slate-500">{labels.failedAttempts}</span>
                <select
                  className={fieldClass}
                  value={security.failedAttemptThreshold}
                  onChange={(e) =>
                    setSecurity({
                      ...security,
                      failedAttemptThreshold: Number(e.target.value) as SecuritySettings['failedAttemptThreshold']
                    })
                  }
                >
                  <option value={3}>3 Fehlversuche</option>
                  <option value={5}>5 Fehlversuche</option>
                  <option value={10}>10 Fehlversuche</option>
                </select>
              </label>

              <label className="text-xs text-slate-600 dark:text-slate-300">
                <span className="block mb-1 font-semibold text-slate-500">{labels.lockout}</span>
                <select
                  className={fieldClass}
                  value={security.lockoutMinutes}
                  onChange={(e) =>
                    setSecurity({
                      ...security,
                      lockoutMinutes: Number(e.target.value) as SecuritySettings['lockoutMinutes']
                    })
                  }
                >
                  <option value={5}>5 {labels.minutes}</option>
                  <option value={10}>10 {labels.minutes}</option>
                  <option value={15}>15 {labels.minutes}</option>
                  <option value={30}>30 {labels.minutes}</option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-indigo-600 focus:ring-indigo-500/30"
                  checked={security.exponentialBackoff}
                  onChange={(e) => setSecurity({ ...security, exponentialBackoff: e.target.checked })}
                />
                <div>
                  <span className="font-semibold block">{labels.backoff}</span>
                  <span className="text-[11px] text-slate-400">
                    {security.exponentialBackoff ? labels.enabled : labels.off}
                  </span>
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={saveSecurity}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {labels.save}
            </button>
          </div>
        )}

        {/* Global action message banner */}
        {adminMessage && (
          <div className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span>{adminMessage}</span>
            <button type="button" onClick={() => setAdminMessage('')} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
