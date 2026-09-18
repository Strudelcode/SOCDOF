# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## v22.10.0 — Authentication & Multi-User Security

- Added local multi-user authentication backed by Dexie / IndexedDB with legacy LocalStorage migration.
- Added secure PBKDF2-HMAC-SHA256 password and recovery hashing, account recovery, lockout/backoff, forced password changes, and admin authorization.
- Added account switching and Windows-style workstation locking with auto-lock and Ctrl+Shift+L shortcut support.
- Expanded authentication regression coverage for hashing, recovery, lockout, switching, authorization, and password reset flows.
- Added dedicated authentication and multi-user documentation coverage.
