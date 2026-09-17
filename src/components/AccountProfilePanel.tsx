import React, { useEffect, useRef, useState } from 'react';
import { BriefcaseBusiness, Check, ImagePlus, Palette, UserRound, X } from 'lucide-react';
import { applyAccentColor } from '../lib/accent';
import { getLanguage, setLanguage, SUPPORTED_LANGUAGES, useLanguage, t, type LanguageCode } from '../lib/i18n';
import { changeAccountType, updateUserPreferences, updateUser, type AccountType, type UserAccount } from '../lib/auth';

interface AccountProfilePanelProps {
  user: UserAccount;
  onClose: () => void;
  onUpdated: (user: UserAccount) => void;
}

const PRESET_ACCENTS = ['indigo', 'purple', 'blue', 'emerald', 'sky', 'amber', 'rose', 'teal', 'violet'];

function applyTheme(theme: 'light' | 'dark') {
  try {
    localStorage.setItem('odoo_theme_dark', String(theme === 'dark'));
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {
    // ignore storage errors
  }
}

function resizeAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('avatar_read_failed'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('avatar_decode_failed'));
      image.onload = () => {
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        const sx = (image.naturalWidth - size) / 2;
        const sy = (image.naturalHeight - size) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('avatar_canvas_failed'));
        context.drawImage(image, sx, sy, size, size, 0, 0, 128, 128);
        resolve(canvas.toDataURL('image/webp', 0.86));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const AccountProfilePanel: React.FC<AccountProfilePanelProps> = ({ user, onClose, onUpdated }) => {
  const language = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatar, setAvatar] = useState(user.avatar ?? '●');
  const [accountType, setAccountType] = useState<AccountType>(user.accountType);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('odoo_theme_dark') === 'true' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const [accentColor, setAccentColor] = useState(user.preferences.accentColor ?? 'indigo');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(user.preferences.language ?? getLanguage());
  const [autoLockMinutes, setAutoLockMinutes] = useState(user.preferences.autoLockMinutes ?? 15);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName);
    setAvatar(user.avatar ?? '●');
    setAccountType(user.accountType);
    setAccentColor(user.preferences.accentColor ?? 'indigo');
    setSelectedLanguage(user.preferences.language ?? getLanguage());
    setAutoLockMinutes(user.preferences.autoLockMinutes ?? 15);
  }, [user]);

  const save = () => {
    const nextPreferences = {
      ...user.preferences,
      language: selectedLanguage,
      theme,
      accentColor,
      autoLockMinutes: Math.max(0, Math.min(240, autoLockMinutes))
    };
    let nextUser = updateUser(user.id, { displayName: displayName.trim() || user.displayName, avatar, accountType });
    nextUser = updateUserPreferences(nextUser.id, nextPreferences);
    setLanguage(selectedLanguage);
    applyAccentColor(accentColor);
    applyTheme(theme);
    setSaved(true);
    onUpdated(nextUser);
    window.setTimeout(() => setSaved(false), 1400);
  };

  const handleAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      setAvatar(await resizeAvatar(file));
    } catch {
      // keep the previous avatar when an image cannot be processed
    } finally {
      event.target.value = '';
    }
  };

  const switchAccountType = (next: AccountType) => {
    setAccountType(next);
    changeAccountType(user.id, next);
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-start justify-end p-4 bg-black/20 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-[380px] max-w-full rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200/70 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-slate-100 dark:bg-white/10 flex items-center justify-center text-lg font-semibold shrink-0">
              {avatar.startsWith('data:image/') ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : avatar}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{displayName}</h2>
              <p className="text-xs text-slate-500 truncate">@{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10" title={t('action.close')}><X size={17} /></button>
        </header>

        <div className="p-5 space-y-5 max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">{t('settings.owner_name')}</label>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">{t('settings.personalization')}</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5" title={t('settings.wallpaper_upload')}>
                <ImagePlus size={16} />{t('action.upload')}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">{t('settings.general')}</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => switchAccountType('personal')} className={`rounded-xl border px-3 py-3 flex items-center justify-center gap-2 ${accountType === 'personal' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-white/10'}`} title={t('settings.personalization')} aria-pressed={accountType === 'personal'}>
                <UserRound size={16} />
              </button>
              <button type="button" onClick={() => switchAccountType('business')} className={`rounded-xl border px-3 py-3 flex items-center justify-center gap-2 ${accountType === 'business' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-white/10'}`} title={t('settings.company_data_title')} aria-pressed={accountType === 'business'}>
                <BriefcaseBusiness size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Palette size={14} />{t('settings.accent_system_title')}</div>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_ACCENTS.map((accent) => (
                <button key={accent} type="button" onClick={() => setAccentColor(accent)} className={`h-9 rounded-xl border ${accentColor === accent ? 'ring-2 ring-indigo-500 border-transparent' : 'border-slate-200 dark:border-white/10'}`} style={{ background: `var(--accent-${accent}, ${accent})` }} aria-label={accent} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setTheme('light')} className={`rounded-xl border px-3 py-2.5 text-sm ${theme === 'light' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-white/10'}`}>{t('settings.light_mode')}</button>
            <button type="button" onClick={() => setTheme('dark')} className={`rounded-xl border px-3 py-2.5 text-sm ${theme === 'dark' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-white/10'}`}>{t('settings.dark_mode')}</button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">{t('settings.display_language')}</label>
            <select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value as LanguageCode)} className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5 outline-none">
              {SUPPORTED_LANGUAGES.map((option) => <option key={option.code} value={option.code}>{option.nativeLabel}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500">{t('settings.windows')}</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={240} value={autoLockMinutes} onChange={(event) => setAutoLockMinutes(Number(event.target.value) || 0)} className="w-24 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2.5" />
              <span className="text-sm text-slate-500">{t('settings.timezone_label')}</span>
            </div>
          </div>

          <button type="button" onClick={save} className="w-full rounded-xl bg-indigo-600 text-white px-4 py-3 font-medium flex items-center justify-center gap-2 hover:bg-indigo-700">
            {saved ? <Check size={17} /> : null}{saved ? t('settings.save_success') : t('action.save')}
          </button>
        </div>
      </section>
    </div>
  );
};
