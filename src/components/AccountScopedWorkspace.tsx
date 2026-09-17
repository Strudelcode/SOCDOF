import React, { useEffect, useState } from 'react';
import { UserRoundCog } from 'lucide-react';
import { getSession, getUserById, type AccountType, AUTH_CHANGE_EVENT_NAME, type UserAccount } from '../lib/auth';
import { AccountProfilePanel } from './AccountProfilePanel';

/**
 * Applies the active local account's workspace scope before the desktop workspace mounts.
 * Personal accounts deliberately exclude business-only modules; business accounts restore the
 * user's full module catalog. Desktop pins and window geometry are isolated per local user.
 */
const BUSINESS_ONLY_MODULES = new Set([
  'invoices',
  'accounting',
  'purchases',
  'pos',
  'restaurant',
  'support_services',
  'fleet',
  'projects',
  'ios_billing'
]);

const USER_SCOPED_KEYS = [
  'odoo_installed_modules',
  'odoo_pinned_desktop',
  'odoo_pinned_taskbar',
  'odoo_window_geometry_states',
  'odoo_desktop_icon_positions',
  'socdof_desktop_folders'
] as const;

const MODULE_STATE_BACKUP_KEYS = [
  'odoo_installed_modules',
  'odoo_pinned_desktop',
  'odoo_pinned_taskbar'
] as const;

function scopedKey(key: string, userId: string): string {
  return `socdof.user.${userId}.${key}`;
}

function backupKey(key: string, userId: string): string {
  return scopedKey(`all.${key}`, userId);
}

function readArray(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : null;
  } catch {
    return null;
  }
}

function prepareUserWorkspace(userId: string, accountType: AccountType): void {
  for (const key of USER_SCOPED_KEYS) {
    const userKey = scopedKey(key, userId);
    const existingUserValue = localStorage.getItem(userKey);
    if (existingUserValue !== null) localStorage.setItem(key, existingUserValue);
    else {
      const currentValue = localStorage.getItem(key);
      if (currentValue !== null) localStorage.setItem(userKey, currentValue);
    }
  }

  for (const key of MODULE_STATE_BACKUP_KEYS) {
    const allKey = backupKey(key, userId);
    if (localStorage.getItem(allKey) === null) {
      const current = localStorage.getItem(key);
      if (current !== null) localStorage.setItem(allKey, current);
    }
  }

  for (const key of MODULE_STATE_BACKUP_KEYS) {
    const values = readArray(backupKey(key, userId));
    if (!values) continue;
    const visible = accountType === 'personal' ? values.filter(module => !BUSINESS_ONLY_MODULES.has(module)) : values;
    const serialized = JSON.stringify(visible);
    localStorage.setItem(key, serialized);
    localStorage.setItem(scopedKey(key, userId), serialized);
  }
}

export const AccountScopedWorkspace: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [activeAccount, setActiveAccount] = useState<UserAccount | null>(() => {
    const session = getSession();
    return session && !session.locked ? getUserById(session.userId) : null;
  });
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const refreshAccount = () => {
      const session = getSession();
      setActiveAccount(session && !session.locked ? getUserById(session.userId) : null);
      setProfileOpen(false);
    };
    window.addEventListener(AUTH_CHANGE_EVENT_NAME, refreshAccount);
    window.addEventListener('storage', refreshAccount);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT_NAME, refreshAccount);
      window.removeEventListener('storage', refreshAccount);
    };
  }, []);

  useEffect(() => {
    if (!activeAccount) {
      setScopeKey(null);
      return;
    }
    try {
      prepareUserWorkspace(activeAccount.id, activeAccount.accountType);
      setScopeKey(`${activeAccount.id}:${activeAccount.accountType}`);
    } catch (error) {
      console.error('Failed to prepare account-scoped workspace:', error);
      setScopeKey(null);
    }
  }, [activeAccount]);

  if (!activeAccount || !scopeKey) return null;

  return (
    <React.Fragment key={scopeKey}>
      {children}
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="fixed top-3 right-44 z-[9998] p-2.5 rounded-xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl shadow-lg hover:bg-slate-100 dark:hover:bg-white/10"
        title={activeAccount.displayName}
        aria-label={activeAccount.displayName}
      >
        {activeAccount.avatar?.startsWith('data:image/') ? <img src={activeAccount.avatar} alt="" className="w-4 h-4 rounded-full object-cover" /> : <UserRoundCog size={16} />}
      </button>
      {profileOpen && <AccountProfilePanel user={activeAccount} onClose={() => setProfileOpen(false)} onUpdated={(user) => setActiveAccount(user)} />}
    </React.Fragment>
  );
};
