import React, { useEffect, useState } from 'react';
import { applyAccentColor } from '../lib/accent';
import { getSession, getUserById, type AccountType, AUTH_CHANGE_EVENT_NAME, type UserAccount } from '../lib/auth';

/**
 * Applies the active local account's workspace scope before the desktop workspace mounts.
 * Personal accounts deliberately exclude business-only modules. User-specific desktop state,
 * appearance, pins and window geometry are restored whenever the active account changes.
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
  // User-scoped values are the source of truth.
  for (const key of USER_SCOPED_KEYS) {
    const userKey = scopedKey(key, userId);
    const existingUserValue = localStorage.getItem(userKey);

    if (existingUserValue !== null) {
      // If desktop positions in userKey are empty/invalid but active key has valid positions, recover them
      if (key === 'odoo_desktop_icon_positions') {
        const unscopedPositions = localStorage.getItem(key);
        if ((!existingUserValue || existingUserValue === '{}') && unscopedPositions && unscopedPositions !== '{}') {
          localStorage.setItem(userKey, unscopedPositions);
          continue;
        }
      }

      // If userKey for modules is empty but active key has saved modules, recover them
      if (MODULE_STATE_BACKUP_KEYS.includes(key as typeof MODULE_STATE_BACKUP_KEYS[number])) {
        const userArr = readArray(userKey);
        const unscopedArr = readArray(key);
        if ((!userArr || userArr.length === 0) && (unscopedArr && unscopedArr.length > 0)) {
          const serialized = JSON.stringify(unscopedArr);
          localStorage.setItem(userKey, serialized);
          localStorage.setItem(key, serialized);
          localStorage.setItem(backupKey(key, userId), serialized);
          continue;
        }
      }

      // Restore user-saved values without deleting apps the user installed or pinned
      localStorage.setItem(key, existingUserValue);
      if (MODULE_STATE_BACKUP_KEYS.includes(key as typeof MODULE_STATE_BACKUP_KEYS[number])) {
        localStorage.setItem(backupKey(key, userId), existingUserValue);
      }
      continue;
    }

    // First initialization for this account: migrate the current unscoped value once.
    const currentValue = localStorage.getItem(key);
    if (currentValue !== null) {
      if (accountType === 'personal' && MODULE_STATE_BACKUP_KEYS.includes(key as typeof MODULE_STATE_BACKUP_KEYS[number])) {
        const values = readArray(key);
        // Only on initial account creation: provide default non-business template
        const visible = values ? values.filter(module => !BUSINESS_ONLY_MODULES.has(module)) : [];
        const serialized = JSON.stringify(visible);
        localStorage.setItem(userKey, serialized);
        localStorage.setItem(key, serialized);
        localStorage.setItem(backupKey(key, userId), serialized);
      } else {
        localStorage.setItem(userKey, currentValue);
        if (MODULE_STATE_BACKUP_KEYS.includes(key as typeof MODULE_STATE_BACKUP_KEYS[number])) {
          localStorage.setItem(backupKey(key, userId), currentValue);
        }
      }
    }
  }
}

function applyUserAppearance(user: UserAccount | null): void {
  if (!user) return;
  const root = document.documentElement;
  // If user explicitly has a preference, use it; otherwise DO NOT force 'light'!
  // Let the system / company theme from App.tsx take precedence if user has no explicit preference.
  if (user.preferences.theme === 'dark' || user.preferences.theme === 'light') {
    const isDark = user.preferences.theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    try {
      localStorage.setItem('odoo_theme_dark', String(isDark));
    } catch {
      // ignore
    }
  }
  applyAccentColor(user.preferences.accentColor ?? 'indigo');
  if (user.preferences.wallpaper) {
    root.style.setProperty('--socdof-user-wallpaper', `url("${user.preferences.wallpaper}")`);
    root.style.setProperty('--socdof-user-wallpaper-visible', '1');
  } else {
    root.style.removeProperty('--socdof-user-wallpaper');
    root.style.setProperty('--socdof-user-wallpaper-visible', '0');
  }
}

export const AccountScopedWorkspace: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [activeAccount, setActiveAccount] = useState<UserAccount | null>(() => {
    const session = getSession();
    return session && !session.locked ? getUserById(session.userId) : null;
  });
  const [scopeKey, setScopeKey] = useState<string | null>(() => {
    const session = getSession();
    const account = session && !session.locked ? getUserById(session.userId) : null;
    if (account) {
      try {
        prepareUserWorkspace(account.id, account.accountType);
        applyUserAppearance(account);
        return `${account.id}:${account.accountType}`;
      } catch (e) {
        console.error('Failed to prepare account scope on init:', e);
      }
    }
    return null;
  });

  useEffect(() => {
    const refreshAccount = () => {
      const session = getSession();
      const account = session && !session.locked ? getUserById(session.userId) : null;
      setActiveAccount(account);
      applyUserAppearance(account);
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
      applyUserAppearance(activeAccount);
      setScopeKey(`${activeAccount.id}:${activeAccount.accountType}`);
    } catch (error) {
      console.error('Failed to prepare account-scoped workspace:', error);
      setScopeKey(null);
    }
  }, [activeAccount]);

  if (!activeAccount || !scopeKey) return null;

  return (
    <React.Fragment key={scopeKey}>
      <div className="relative w-full h-full">
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 pointer-events-none bg-cover bg-center bg-no-repeat transition-opacity duration-300"
          style={{ backgroundImage: 'var(--socdof-user-wallpaper)', opacity: 'var(--socdof-user-wallpaper-visible)' }}
        />
        {children}
      </div>
    </React.Fragment>
  );
};
