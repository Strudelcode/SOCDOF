import assert from 'node:assert/strict';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

const local = new MemoryStorage();
const session = new MemoryStorage();
Object.assign(globalThis, {
  localStorage: local,
  sessionStorage: session,
  btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
  atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
  CustomEvent: class CustomEvent<T = unknown> { constructor(public type: string, public detail?: T) {} },
  Event: class Event { constructor(public type: string) {} },
  window: {
    dispatchEvent() {},
    localStorage: local,
    sessionStorage: session,
  },
});

const auth = await import('../src/lib/auth.ts');

const first = await auth.createUser({
  username: 'Admin',
  displayName: 'Local Admin',
  password: 'correct-horse-battery',
  accountType: 'business',
  recoveryQuestion: auth.RECOVERY_QUESTIONS[0],
  recoveryAnswer: 'Milo',
});

assert.equal(first.role, 'admin');
assert.equal(first.passwordIterations, 210_000);
assert.notEqual(first.passwordHash, 'correct-horse-battery');
assert.notEqual(first.passwordSalt, '');
assert.equal(auth.getCurrentUser()?.id, first.id);

const login = await auth.authenticate('ADMIN', 'correct-horse-battery');
assert.equal(login.ok, true);

const second = await auth.createUser({
  username: 'Second',
  displayName: 'Second User',
  password: 'another-secure-password',
  role: 'user',
  accountType: 'personal',
});
assert.equal(second.role, 'user');

const secondLogin = await auth.authenticate('Second', 'another-secure-password');
assert.equal(secondLogin.ok, true);
assert.equal(auth.getCurrentUser()?.id, second.id);

await assert.rejects(
  async () => auth.createUser({ username: 'Third', displayName: 'Third User', password: 'third-secure-password', accountType: 'personal' }),
  /admin_required/,
);

const adminLogin = await auth.authenticate('Admin', 'correct-horse-battery');
assert.equal(adminLogin.ok, true);

await auth.updateSecuritySettings({ failedAttemptThreshold: 3, lockoutMinutes: 5, exponentialBackoff: true });
const firstFailure = await auth.authenticate('Second', 'wrong-password');
assert.equal(firstFailure.reason, 'invalid_credentials');
const secondFailure = await auth.authenticate('Second', 'wrong-password');
assert.equal(secondFailure.reason, 'invalid_credentials');
const locked = await auth.authenticate('Second', 'wrong-password');
assert.equal(locked.reason, 'locked');

const resetPassword = 'temporary-secure-password';
await auth.adminResetPassword(second.id, resetPassword);
assert.equal(auth.getUserById(second.id)?.mustChangePassword, true);
const resetLogin = await auth.authenticate('Second', resetPassword);
assert.equal(resetLogin.ok, true);
assert.equal(auth.getCurrentUser()?.id, second.id);

const finalAdminLogin = await auth.authenticate('Admin', 'correct-horse-battery');
assert.equal(finalAdminLogin.ok, true);

await assert.rejects(
  async () => auth.deleteUser(first.id),
  /last_admin/,
);

console.log('Auth regression tests passed.');
