export type UserRole = 'admin' | 'user';
export type AccountType = 'personal' | 'business';

export interface UserPreferences {
  language?: 'en' | 'de' | 'fr' | 'es';
  theme?: 'light' | 'dark';
  accentColor?: string;
  autoLockMinutes?: number;
}

export interface RecoverySettings {
  question: string;
  answerHash: string;
  answerSalt: string;
  answerIterations: number;
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
  'What nickname did you use as a child?'
] as const;

const USERS_KEY = 'socdof.auth.users.v1';
const SESSION_KEY = 'socdof.auth.session.v1';
const PBKDF2_ITERATIONS = 210_000;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 5 * 60_000;

const hasStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const readUsers = (): UserAccount[] => {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeUsers = (users: UserAccount[]) => {
  if (hasStorage()) localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const randomBytes = (length: number) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

export const normalizeUsername = (username: string) => username.trim().toLocaleLowerCase();
export const normalizeRecoveryAnswer = (answer: string) => answer.trim().toLocaleLowerCase();

export const validatePassword = (password: string) => password.length < 8 ? 'password_too_short' : null;

export async function hashPassword(password: string, saltBase64?: string, iterations = PBKDF2_ITERATIONS) {
  const salt = saltBase64 ? fromBase64(saltBase64) : randomBytes(16);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return { hash: toBase64(new Uint8Array(bits)), salt: toBase64(salt), iterations };
}

export async function verifyPassword(password: string, user: UserAccount) {
  const result = await hashPassword(password, user.passwordSalt, user.passwordIterations);
  return result.hash === user.passwordHash;
}

export async function hashRecoveryAnswer(answer: string, saltBase64?: string, iterations = PBKDF2_ITERATIONS) {
  return hashPassword(normalizeRecoveryAnswer(answer), saltBase64, iterations);
}

export async function verifyRecoveryAnswer(answer: string, recovery: RecoverySettings) {
  const result = await hashRecoveryAnswer(answer, recovery.answerSalt, recovery.answerIterations);
  return result.hash === recovery.answerHash;
}

export function getUsers() { return readUsers(); }
export function hasUsers() { return readUsers().length > 0; }
export function getUserById(id: string) { return readUsers().find((user) => user.id === id) ?? null; }
export function getUserByUsername(username: string) {
  const normalized = normalizeUsername(username);
  return readUsers().find((user) => normalizeUsername(user.username) === normalized) ?? null;
}
export function getActiveAdminCount() { return readUsers().filter((user) => user.role === 'admin' && user.active).length; }
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
}) {
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  if (!username || !displayName) throw new Error('missing_fields');
  if (validatePassword(input.password)) throw new Error('password_too_short');
  if (getUserByUsername(username)) throw new Error('username_exists');
  if (input.recoveryQuestion && !input.recoveryAnswer?.trim()) throw new Error('recovery_answer_required');
  if (input.recoveryQuestion && !RECOVERY_QUESTIONS.includes(input.recoveryQuestion as typeof RECOVERY_QUESTIONS[number])) throw new Error('invalid_recovery_question');

  const users = readUsers();
  const now = new Date().toISOString();
  const password = await hashPassword(input.password);
  const recoveryHash = input.recoveryQuestion && input.recoveryAnswer ? await hashRecoveryAnswer(input.recoveryAnswer) : null;
  const user: UserAccount = {
    id: crypto.randomUUID(),
    username,
    displayName,
    role: users.length === 0 ? 'admin' : (input.role ?? 'user'),
    accountType: input.accountType,
    avatar: input.avatar,
    active: true,
    passwordHash: password.hash,
    passwordSalt: password.salt,
    passwordIterations: password.iterations,
    failedLoginAttempts: 0,
    mustChangePassword: false,
    recovery: recoveryHash && input.recoveryQuestion ? {
      question: input.recoveryQuestion,
      answerHash: recoveryHash.hash,
      answerSalt: recoveryHash.salt,
      answerIterations: recoveryHash.iterations
    } : undefined,
    createdAt: now,
    updatedAt: now,
    preferences: input.preferences ?? {}
  };
  users.push(user);
  writeUsers(users);
  return user;
}

export async function changePassword(userId: string, password: string) {
  if (validatePassword(password)) throw new Error('password_too_short');
  const users = readUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) throw new Error('user_not_found');
  const hashed = await hashPassword(password);
  users[index] = { ...users[index], passwordHash: hashed.hash, passwordSalt: hashed.salt, passwordIterations: hashed.iterations, failedLoginAttempts: 0, lockedUntil: undefined, mustChangePassword: false, updatedAt: new Date().toISOString() };
  writeUsers(users);
}

export async function resetPasswordWithRecovery(userId: string, answer: string, newPassword: string) {
  if (validatePassword(newPassword)) throw new Error('password_too_short');
  const users = readUsers();
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) throw new Error('user_not_found');
  const user = users[index];
  if (!user.recovery) throw new Error('recovery_not_configured');
  if (!(await verifyRecoveryAnswer(answer, user.recovery))) throw new Error('recovery_invalid');
  const hashed = await hashPassword(newPassword);
  users[index] = { ...user, passwordHash: hashed.hash, passwordSalt: hashed.salt, passwordIterations: hashed.iterations, failedLoginAttempts: 0, lockedUntil: undefined, mustChangePassword: false, updatedAt: new Date().toISOString() };
  writeUsers(users);
}

export async function authenticate(username: string, password: string) {
  const users = readUsers();
  const index = users.findIndex((user) => normalizeUsername(user.username) === normalizeUsername(username));
  if (index < 0) return { ok: false as const, reason: 'invalid_credentials' as const };
  const user = users[index];
  if (!user.active) return { ok: false as const, reason: 'inactive' as const };
  const remaining = getLockoutRemaining(user);
  if (remaining > 0) return { ok: false as const, reason: 'locked' as const, retryAt: user.lockedUntil };

  const valid = await verifyPassword(password, user);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const locked = attempts >= LOCKOUT_THRESHOLD;
    users[index] = { ...user, failedLoginAttempts: locked ? 0 : attempts, lockedUntil: locked ? Date.now() + LOCKOUT_MS : undefined, updatedAt: new Date().toISOString() };
    writeUsers(users);
    return { ok: false as const, reason: locked ? 'locked' as const : 'invalid_credentials' as const, retryAt: locked ? users[index].lockedUntil : undefined };
  }

  const now = Date.now();
  users[index] = { ...user, failedLoginAttempts: 0, lockedUntil: undefined, lastLoginAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
  writeUsers(users);
  const updatedUser = users[index];
  const session: AuthSession = { userId: updatedUser.id, sessionId: toBase64(randomBytes(24)), createdAt: now, lastActivityAt: now, locked: false };
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true as const, user: updatedUser, session };
}

export function getSession(): AuthSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as AuthSession : null;
  } catch { return null; }
}
export function saveSession(session: AuthSession) { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function clearSession() { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SESSION_KEY); }

export function updateUser(id: string, patch: Partial<Pick<UserAccount, 'displayName' | 'role' | 'accountType' | 'avatar' | 'active' | 'preferences' | 'mustChangePassword'>>) {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) throw new Error('user_not_found');
  const next = { ...users[index], ...patch };
  if (users[index].role === 'admin' && users[index].active && (next.role !== 'admin' || !next.active) && getActiveAdminCount() <= 1) throw new Error('last_admin');
  users[index] = { ...next, updatedAt: new Date().toISOString() };
  writeUsers(users);
  return users[index];
}

export function deleteUser(id: string) {
  const users = readUsers();
  const target = users.find((user) => user.id === id);
  if (!target) throw new Error('user_not_found');
  if (target.role === 'admin' && target.active && users.filter((user) => user.role === 'admin' && user.active).length <= 1) throw new Error('last_admin');
  writeUsers(users.filter((user) => user.id !== id));
}

export function touchSession(locked = false) {
  const session = getSession();
  if (!session) return null;
  const next = { ...session, lastActivityAt: Date.now(), locked };
  saveSession(next);
  return next;
}
export function lockSession() { return touchSession(true); }
export function unlockSession() { return touchSession(false); }
export function updateUserPreferences(id: string, preferences: UserPreferences) { return updateUser(id, { preferences }); }
