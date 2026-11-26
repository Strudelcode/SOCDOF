# SOCDOF v22.10.0 Release Notes

**Release date:** 2026-09-18  
**Version:** v22.10.0  
**Channel:** Minor feature release  
**Platform:** Windows Desktop (Electron) and offline web workspace

## Authentication & Multi-User Security

- Local multi-user accounts are persisted in Dexie / IndexedDB with automatic migration from legacy LocalStorage authentication data.
- Passwords and recovery answers use PBKDF2-HMAC-SHA256 with per-record salts; plaintext passwords are never persisted.
- Added configurable failed-login thresholds, timed lockout, exponential backoff, lockout countdowns, and forced password changes.
- Added administrator authorization, last-active-admin protection, account switching, account activation, role/account-type management, avatars, and per-user preferences.
- Added Windows-style workstation locking, automatic lock behavior, and the browser-safe Ctrl+Shift+L shortcut.
- Added automated regression coverage for password hashing, recovery, lockout/backoff, authorization, switching, forced password changes, and last-admin protection.

## Documentation & Release Metadata

- Added a dedicated in-app Authentication & Multi-User chapter covering workflows, controls, security behavior, integrations, and shortcuts.
- Synchronized package version, in-app version history, Version 22 release history, changelog, and completed TODO archive to v22.10.0.

## Compatibility & Scope

This is a minor release within Version 22. No major-version increment was introduced.
