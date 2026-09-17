import React, { useEffect, useMemo, useState } from 'react';
import { getSession, getUserById, type AccountType } from '../lib/auth';

/**
 * Applies the active local account's workspace scope before the desktop workspace mounts.
 * Personal accounts deliberately exclude business-only modules; business accounts retain the
 * full module catalog. Desktop pins and window geometry are isolated per local user.
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

function scopedKey(key: string, userId: string): string {
  return `socdof.user.${userId}.${key}`;
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

    if (existingUserValue !== null) {
      localStorage.setItem(key, existingUserValue);
      continue;
    }

    const currentValue = localStorage.getItem(key);
    if (currentValue !== null) {
      localStorage.setItem(userKey, currentValue);
    }
  }

  if (accountType === 'personal') {
    for (const key of ['odoo_installed_modules', 'odoo_pinned_desktop', 'odoo_pinned_taskbar']) {
      const values = readArray(key);
      if (values) {
        const filtered = values.filter(module => !BUSINESS_ONLY_MODULES.has(module));
        const serialized = JSON.stringify(filtered);
        localStorage.setItem(key, serialized);
        localStorage.setItem(scopedKey(key, userId), serialized);
      }
    }
  }
}

export const AccountScopedWorkspace: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [scopeKey, setScopeKey] = useState<string | null>(null);

  const activeAccount = useMemo(() => {
    const session = getSession();
    if (!session || session.locked) return null;
    return getUserById(session.userId);
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

  return <React.Fragment key={scopeKey}>{children}</React.Fragment>;
};
