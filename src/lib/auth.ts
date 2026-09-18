import { db } from './db';

export type UserRole = 'admin' | 'user';
export type AccountType = 'personal' | 'business';

export interface UserPreferences {
  language?: 'en' | 'de' | 'fr' | 'es';
  theme?: 'light' | 'dark';
  accentColor?: string;
  autoLockMinutes?: number;
  wallpaper?: string;
}

export interface RecoverySettings {
  question: string;
  answerHash: string;
  answerSalt: string;
  answerIterations: number;
}

export interface SecuritySettings {
  failedAttemptThreshold: 3 | 5 | 10;
  lockoutMinutes: 5 | 10 | 15;
  exponentialBackoff: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  accountType: AccountType;
  avatar?: string;
  active: boolean;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  failedLoginAttempts: number;
  lockedUntil?: number;
  lockoutLevel: number;
  mustChangePassword: boolean;
  recovery?: RecoverySettings;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences: UserPreferences;
}

export interface AuthSession {
  userId: string;
  sessionId: string;
  createdAt: number;
  lastActivityAt: number;
  locked: boolean;
}

export const RECOVERY_QUESTIONS = [
  'What was the name of your first pet?',
  'What was the name of your childhood school?',
  'What is your favorite book?',
  'What nickname did you use as a child?',
] as const;

const USERS_KEY = 'socdof.auth.users.v1';
const SESSION_KEY = 'socdof.auth.session.v1';
const SECURITY_KEY = 'socdof.auth.security.v1';
const AUTH_DB_USERS_KEY = 'auth.users.v2';
const AUTH_DB_SECURITY_KEY = 'auth.security.v2';
const PBKDF2_ITERATIONS = 210_000;
const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  failedAttemptThreshold: 5,
  lockoutMinutes: 5,
  exponentialBackoff: true,
};
const AUTH_CHANGE_EVENT = 'socdof-auth-changed';

let usersCache: UserAccount[] = [];
let securityCache: SecuritySettings = DEFAULT_SECURITY_SETTINGS;
let authStoreReady = false;
let authStorePromise: Promise<void> | null = null;

const hasWindow = () => typeof window !== 'undefined';
const hasStorage = () => hasWindow() && typeof localStorage !== 'undefined';
const hasIndexedDb = () => hasWindow() && typeof indexedDB !== 'undefined';

const notifyAuthChanged = () => {
  if (hasWindow()) window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
};

const notifySameWindowStorageChange = () => {
  if (hasWindow()) window.dispatchEvent(new Event('storage'));
};

export const AUTH_CHANGE_EVENT_NAME = AUTH_CHANGE_EVENT;

function parseUsers(raw: unknown): UserAccount[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((user: UserAccount) => ({
    ...user,
    lockoutLevel: typeof user.lockoutLevel === 'number' ? user.lockoutLevel : 0,
    failedLoginAttempts: typeof user.failedLoginAttempts === 'number' ? user.failedLoginAttempts : 0,
    mustChangePassword: Boolean(user.mustChangePassword),
    preferences: user.preferences ?? {},
  }));
}

function parseSecurity(raw: unknown): SecuritySettings {
  const parsed = (raw ?? {}) as Partial<SecuritySettings>;
  return {
    failedAttemptThreshold:
      parsed.failedAttemptThreshold === 3 || parsed.failedAttemptThreshold === 10 ? parsed.failedAttemptThreshold : 5,
    lockoutMinutes:
      parsed.lockoutMinutes === 10 || parsed.lockoutMinutes === 15 ? parsed.lockoutMinutes : 5,
    exponentialBackoff: parsed.exponentialBackoff !== false,
  };
}

function readLegacyUsers(): UserAccount[] {
  if (!hasStorage()) return [];
  try {
    return parseUsers(JSON.parse(localStorage.getItem(USERS_KEY) ?? 'null'));
  } catch {
    return [];
  }
}

function readLegacySecurity(): SecuritySettings {
  if (!hasStorage()) return DEFAULT_SECURITY_SETTINGS;
  try {
    return parseSecurity(JSON.parse(localStorage.getItem(SECURITY_KEY) ?? 'null'));
  } catch {
    return DEFAULT_SECURITY_SETTINGS;
  }
}

function cacheUsers(users: UserAccount[]) {
  usersCache = users;
}

function cacheSecurity(settings: SecuritySettings) {
  securityCache = settings;
}

async function persistUsers(users: UserAccount[]) {
  cacheUsers(users);
  if (hasIndexedDb()) {
    await db.settings.put({ key: AUTH_DB_USERS_KEY, value: users });
  }
  notifyAuthChanged();
  notifySameWindowStorageChange();
}

async function persistSecurity(settings: SecuritySettings) {
  cacheSecurity(settings);
  if (hasIndexedDb()) {
    await db.settings.put({ key: AUTH_DB_SECURITY_KEY, value: settings });
  }
  notifyAuthChanged();
  notifySameWindowStorageChange();
}

/**
 * Initializes the IndexedDB-backed authentication store.
 *
 * Existing v1 LocalStorage accounts/settings are migrated once into Dexie.
 * LocalStorage is intentionally retained only as a migration source so that
 * existing installations do not lose their local accounts.
 */
export function initializeAuthStore(): Promise<void> {
  if (authStorePromise) return authStorePromise;

  authStorePromise = (async () => {
    const legacyUsers = readLegacyUsers();
    const legacySecurity = readLegacySecurity();

    if (!hasIndexedDb()) {
      cacheUsers(legacyUsers);
      cacheSecurity(legacySecurity);
      authStoreReady = true;
      notifyAuthChanged();
      return;
    }

    try {
      const [userRecord, securityRecord] = await Promise.all([
        db.settings.get(AUTH_DB_USERS_KEY),
        db.settings.get(AUTH_DB_SECURITY_KEY),
      ]);

      const indexedUsers = parseUsers(userRecord?.value);
      const indexedSecurity = userRecord ? parseSecurity(securityRecord?.value) : legacySecurity;

      if (indexedUsers.length > 0 || legacyUsers.length === 0) {
        cacheUsers(indexedUsers);
      } else {
        cacheUsers(legacyUsers);
        await db.settings.put({ key: AUTH_DB_USERS_KEY, value: legacyUsers });
      }

      cacheSecurity(indexedSecurity);

      if (!securityRecord && hasStorage()) {
        await db.settings.put({ key: AUTH_DB_SECURITY_KEY, value: legacySecurity });
      }

      authStoreReady = true;
      notifyAuthChanged();
    } catch {
      // IndexedDB can be unavailable in restricted/private browser contexts.
      // Keep the in-memory cache populated from the legacy store for compatibility.
      cacheUsers(legacyUsers);
      cacheSecurity(legacySecurity);
      authStoreReady = true;
      notifyAuthChanged();
    }
  })();

  return authStorePromise;
}

// Start migration immediately, while callers can explicitly await initialization.
void initializeAuthStore();

export function isAuthStoreReady() {
  return authStoreReady;
}

export function normalizeUsername(username: string) {
  return username.trim().toLocaleLowerCase();
}

export function normalizeRecoveryAnswer(answer: string) {
  return answer.trim().toLocaleLowerCase();
}

export function validatePassword(password: string) {
  return password.length < 8 ? 'password_too_short' : null;
}

export function getSession(): AuthSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  const session = getSession();
  return session ? getUserById(session.userId) : null;
}

const requireAdmin = () => {
  const actor = getCurrentUser();
  if (!actor || actor.role !== 'admin' || !actor.active) throw new Error('admin_required');
  return actor;
};

export function getSecuritySettings(): SecuritySettings {
  return securityCache;
}

export function updateSecuritySettings(patch: Partial<SecuritySettings>): SecuritySettings {
  requireAdmin();
  const current = getSecuritySettings();
  const next: SecuritySettings = {
    failedAttemptThreshold:
      patch.failedAttemptThreshold === 3 || patch.failedAttemptThreshold === 10
        ? patch.failedAttemptThreshold
        : patch.failedAttemptThreshold === 5
          ? 5
          : current.failedAttemptThreshold,
    lockoutMinutes:
      patch.lockoutMinutes === 10 || patch.lockoutMinutes === 15
        ? patch.lockoutMinutes
        : patch.lockoutMinutes === 5
          ? 5
          : current.lockoutMinutes,
    exponentialBackoff: patch.exponentialBackoff ?? current.exponentialBackoff,
  };

  void persistSecurity(next);
  return next;
}

const randomBytes = (length: number) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

export async function hashPassword(password: string, saltBase64?: string, iterations = PBKDF2_ITERATIONS) {
  const salt = saltBase64 ? fromBase64(saltBase64) : randomBytes(16);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return {
    hash: toBase64(new Uint8Array(bits)),
    salt: toBase64(salt),
    iterations,
  };
}

export async function verifyPassword(password: string, user: UserAccount) {
  const result = await hashPassword(password, user.passwordSalt, user.passwordIterations);
  return result.hash === user.passwordHash;
}

export async function hashRecoveryAnswer(
  answer: string,
  saltBase64?: string,
  iterations = PBKDF2_ITERATIONS,
) {
  return hashPassword(normalizeRecoveryAnswer(answer), saltBase64, iterations);
}

export async function verifyRecoveryAnswer(answer: string, recovery: RecoverySettings) {
  const result = await hashRecoveryAnswer(answer, recovery.answerSalt, recovery.answerIterations);
  return result.hash === recovery.answerHash;
}

export function getUsers() {
  return usersCache;
}

export function hasUsers() {
  return usersCache.length > 0;
}

export function getUserById(id: string) {
  return usersCache.find((user) => user.id === id) ?? null;
}

export function getUserByUsername(username: string) {
  const normalized = normalizeUsername(username);
  return usersCache.find((user) => normalizeUsername(user.username) === normalized) ?? null;
}

export function getActiveAdminCount() {
  return usersCache.filter((user) => user.role === 'admin' && user.active).length;
}

export function getLockoutRemaining(user: UserAccount | null | undefined) {
  if (!user?.lockedUntil) return 0;
  return Math.max(0, user.lockedUntil - Date.now());
}

export async function createUser(input: {
  username: string;
  displayName: string;
  password: string;
  role?: UserRole;
  accountType: AccountType;
  avatar?: string;
  preferences?: UserPreferences;
  recoveryQuestion?: string;
  recoveryAnswer?: string;
  autoLogin?: boolean;
}) {
  await initializeAuthStore();
  const users = [...usersCache];

  if (users.length > 0) requireAdmin();

  const username = input.username.trim();
  const displayName = input.displayName.trim();

  if (!username || !displayName) throw new Error('missing_fields');
  if (validatePassword(input.password)) throw new Error('password_too_short');
  if (getUserByUsername(username)) throw new Error('username_exists');

  if (input.recoveryQuestion && !input.recoveryAnswer?.trim()) {
    throw new Error('recovery_answer_required');
  }

  if (
    input.recoveryQuestion &&
    !RECOVERY_QUESTIONS.includes(input.recoveryQuestion as typeof RECOVERY_QUESTIONS[number]) &&
    (typeof input.recoveryQuestion !== 'string' || input.recoveryQuestion.trim().length < 3)
  ) {
    throw new Error('invalid_recovery_question');
  }

  const now = new Date().toISOString();
  const password = await hashPassword(input.password);
  const recoveryHash =
    input.recoveryQuestion && input.recoveryAnswer
      ? await hashRecoveryAnswer(input.recoveryAnswer)
      : null;

  const user: UserAccount = {
    id: crypto.randomUUID(),
    username,
    displayName,
    role: users.length === 0 ? 'admin' : input.role ?? 'user',
    accountType: input.accountType,
    avatar: input.avatar,
    active: true,
    passwordHash: password.hash,
    passwordSalt: password.salt,
    passwordIterations: password.iterations,
    failedLoginAttempts: 0,
    lockoutLevel: 0,
    mustChangePassword: false,
    recovery:
      recoveryHash && input.recoveryQuestion
        ? {
            question: input.recoveryQuestion,
            answerHash: recoveryHash.hash,
            answerSalt: recoveryHash.salt,
            answerIterations: recoveryHash.iterations,
          }
        : undefined,
    createdAt: now,
    updatedAt: now,
    preferences: input.preferences ?? {},
  };

  users.push(user);
  await persistUsers(users);

  if (input.autoLogin !== false && users.length === 1 && typeof sessionStorage !== 'undefined') {
    const timestamp = Date.now();
    const session: AuthSession = {
      userId: user.id,
      sessionId: toBase64(randomBytes(24)),
      createdAt: timestamp,
      lastActivityAt: timestamp,
      locked: false,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    notifyAuthChanged();
  }

  return user;
}

async function setPassword(userId: string, password: string, mustChangePassword: boolean) {
  if (validatePassword(password)) throw new Error('password_too_short');

  const users = [...usersCache];
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) throw new Error('user_not_found');

  const hashed = await hashPassword(password);
  users[index] = {
    ...users[index],
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    passwordIterations: hashed.iterations,
    failedLoginAttempts: 0,
    lockedUntil: undefined,
    lockoutLevel: 0,
    mustChangePassword,
    updatedAt: new Date().toISOString(),
  };

  await persistUsers(users);
}

export async function changePassword(userId: string, password: string) {
  const actor = getCurrentUser();
  if (!actor || actor.id !== userId) throw new Error('auth_required');
  await setPassword(userId, password, false);
}

export async function adminResetPassword(userId: string, password: string) {
  requireAdmin();
  await setPassword(userId, password, true);
}

export async function resetPasswordWithRecovery(
  userId: string,
  answer: string,
  newPassword: string,
) {
  if (validatePassword(newPassword)) throw new Error('password_too_short');

  const users = [...usersCache];
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) throw new Error('user_not_found');

  const user = users[index];
  if (!user.recovery) throw new Error('recovery_not_configured');
  if (!(await verifyRecoveryAnswer(answer, user.recovery))) {
    throw new Error('recovery_invalid');
  }

  const hashed = await hashPassword(newPassword);
  users[index] = {
    ...user,
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    passwordIterations: hashed.iterations,
    failedLoginAttempts: 0,
    lockedUntil: undefined,
    lockoutLevel: 0,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  };

  await persistUsers(users);
}

export async function authenticate(username: string, password: string) {
  await initializeAuthStore();

  const users = [...usersCache];
  const index = users.findIndex(
    (user) => normalizeUsername(user.username) === normalizeUsername(username),
  );

  if (index < 0) return { ok: false as const, reason: 'invalid_credentials' as const };

  const user = users[index];

  if (!user.active) return { ok: false as const, reason: 'inactive' as const };

  const remaining = getLockoutRemaining(user);
  if (remaining > 0) {
    return { ok: false as const, reason: 'locked' as const, retryAt: user.lockedUntil };
  }

  const valid = await verifyPassword(password, user);

  if (!valid) {
    const settings = getSecuritySettings();
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= settings.failedAttemptThreshold;

    if (shouldLock) {
      const level = Math.max(0, user.lockoutLevel ?? 0);
      const multiplier = settings.exponentialBackoff ? Math.pow(2, Math.min(level, 4)) : 1;
      const duration = settings.lockoutMinutes * 60_000 * multiplier;

      users[index] = {
        ...user,
        failedLoginAttempts: 0,
        lockedUntil: Date.now() + duration,
        lockoutLevel: level + 1,
        updatedAt: new Date().toISOString(),
      };
    } else {
      users[index] = {
        ...user,
        failedLoginAttempts: attempts,
        updatedAt: new Date().toISOString(),
      };
    }

    await persistUsers(users);

    return {
      ok: false as const,
      reason: shouldLock ? ('locked' as const) : ('invalid_credentials' as const),
      retryAt: shouldLock ? users[index].lockedUntil : undefined,
    };
  }

  const now = Date.now();
  users[index] = {
    ...user,
    failedLoginAttempts: 0,
    lockedUntil: undefined,
    lockoutLevel: 0,
    lastLoginAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  await persistUsers(users);

  const updatedUser = users[index];
  const session: AuthSession = {
    userId: updatedUser.id,
    sessionId: toBase64(randomBytes(24)),
    createdAt: now,
    lastActivityAt: now,
    locked: false,
  };

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  notifyAuthChanged();
  return { ok: true as const, user: updatedUser, session };
}

export function saveSession(session: AuthSession) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    notifyAuthChanged();
  }
}

export function recordSessionActivity() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw) as AuthSession;
    if (session.locked) return;
    const now = Date.now();
    // Throttle timestamp updates to at most once every 10 seconds
    if (now - session.lastActivityAt < 10_000) return;
    session.lastActivityAt = now;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    // Intentionally do NOT call notifyAuthChanged(): internal heartbeat does not alter auth state.
  } catch {
    // ignore
  }
}

export function clearSession() {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY);
    notifyAuthChanged();
  }
}

export function touchSession(locked = false) {
  const session = getSession();
  if (!session) return null;
  const next = { ...session, lastActivityAt: Date.now(), locked };
  saveSession(next);
  return next;
}

export function lockSession() {
  return touchSession(true);
}

export function unlockSession() {
  return touchSession(false);
}

export function updateUser(
  id: string,
  patch: Partial<
    Pick<
      UserAccount,
      'displayName' | 'role' | 'accountType' | 'avatar' | 'active' | 'preferences' | 'mustChangePassword'
    >
  >,
) {
  const actor = getCurrentUser();
  if (!actor || actor.id !== id) requireAdmin();

  const users = [...usersCache];
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) throw new Error('user_not_found');

  const next = { ...users[index], ...patch };

  if (
    users[index].role === 'admin' &&
    users[index].active &&
    (next.role !== 'admin' || !next.active) &&
    getActiveAdminCount() <= 1
  ) {
    throw new Error('last_admin');
  }

  users[index] = {
    ...next,
    updatedAt: new Date().toISOString(),
  };

  cacheUsers(users);
  void persistUsers(users);
  return users[index];
}

export function changeAccountType(userId: string, accountType: AccountType) {
  const user = getUserById(userId);
  if (!user) throw new Error('user_not_found');
  if (user.accountType === accountType) return user;
  return updateUser(userId, { accountType });
}

export function deleteUser(id: string) {
  requireAdmin();

  const users = [...usersCache];
  const target = users.find((user) => user.id === id);
  if (!target) throw new Error('user_not_found');

  if (
    target.role === 'admin' &&
    target.active &&
    users.filter((user) => user.role === 'admin' && user.active).length <= 1
  ) {
    throw new Error('last_admin');
  }

  const next = users.filter((user) => user.id !== id);
  cacheUsers(next);
  void persistUsers(next);
}

export function updateUserPreferences(id: string, preferences: UserPreferences) {
  const actor = getCurrentUser();
  if (!actor || actor.id !== id) requireAdmin();
  return updateUser(id, { preferences });
}
