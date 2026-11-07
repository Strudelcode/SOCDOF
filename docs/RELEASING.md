# Releasing SOCDOF

The release pipeline is in [`.github/workflows/release.yml`](../.github/workflows/release.yml).
It is deliberately strict: a release does not start until the version, changelog
section, updater signing key and Discord credentials are all present.

## What a release produces

- Linux: `SOCDOF-<version>-linux-x86_64.AppImage` (signed updater bundle) and
  `SOCDOF-<version>-linux-amd64.deb`.
- Windows: `SOCDOF-<version>-windows-x64-setup.exe` (signed NSIS updater
  bundle) and `SOCDOF-<version>-windows-x64.msi`.
- macOS: `SOCDOF-<version>-macos-universal.dmg` and the signed universal
  `SOCDOF-<version>-macos-universal.app.tar.gz` updater archive.
- Per-platform SHA-256 checksum files, `latest.json`, and a GitHub Release whose
  body is the matching `CHANGELOG.md` section.
- A Discord announcement sent after the release is published.

## Version and changelog

1. Set the same version in `crates/app/package.json`,
   `crates/app/src-tauri/tauri.conf.json` and `crates/app/src-tauri/Cargo.toml`.
2. Add a non-empty section to [`CHANGELOG.md`](../CHANGELOG.md):
   `## [0.1.0] - 2026-11-07`.
3. Commit the changes and push the tag `v0.1.0`. The tag must match the app
   version exactly; `release-notes.mjs` rejects a mismatch.
4. The workflow can also be started manually with **Release → Run workflow** and
   an existing release tag. Do not dispatch it for a tag whose changelog section
   is missing.

## Required GitHub configuration

### Updater signing key

Generate the key once on a trusted machine:

```bash
cd crates/app
npm run tauri -- signer generate -w "$HOME/.tauri/socdof.key"
```

This creates `socdof.key` (private) and `socdof.key.pub` (public). Never commit
either file.

- Repository **variable** `TAURI_UPDATER_PUBKEY`: the single-line contents of
  `socdof.key.pub`.
- Repository **secret** `TAURI_SIGNING_PRIVATE_KEY`: the contents of
  `socdof.key`.
- Optional repository **secret** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the
  password chosen for the key.

The release build writes the public key into the generated
`crates/app/src-tauri/tauri.release.conf.json` and signs the updater archives
with the private key. The generated config is ignored by Git and is not part of
normal development builds.

### Discord

The pipeline reuses the names from the legacy release workflow:

- Secret `DISCORD_BOT_TOKEN`
- Secret `DISCORD_THREAD_ID` (a numeric thread/channel ID or Discord URL)

The bot must be able to post in that thread. The release workflow sends the
announcement only after the GitHub Release is published. A separate
`.github/workflows/discord-release.yml` handles releases published by hand.

## Supported updater targets

| Platform | Updater asset | Notes |
|---|---|---|
| Linux x86_64 | AppImage | `.deb` installations do not self-update; download the new package. |
| Windows x64 | NSIS setup | The MSI is a manual installer and is not used by the updater. |
| macOS universal | `.app.tar.gz` | The same archive serves Apple Silicon and Intel; it must be signed/notarized for normal distribution. |

The updater endpoint is
`https://github.com/Strudelcode/SOCDOF/releases/latest/download/latest.json`.
`latest.json` is generated from the signed assets and uploaded to the release.

## Signing and macOS

The updater signature is independent of operating-system code signing. Tauri
requires a signed updater archive; the private key above provides that.

macOS builds in CI are currently unsigned. They can be built and smoke-tested,
but Gatekeeper will warn on first launch and macOS auto-update installation
needs a properly signed and notarized `.app`. Add an Apple Developer ID
certificate and notarization credentials before treating the macOS artifact as
a normal end-user release. Windows SmartScreen similarly benefits from an
Authenticode certificate, although it is not required for the Tauri updater.

## Local verification

These commands do not need the signing key and do not publish anything:

```bash
node scripts/release-notes.mjs v0.1.0
TAURI_UPDATER_PUBKEY="$(cat "$HOME/.tauri/socdof.key.pub")" \
  node scripts/write-tauri-release-config.mjs
node scripts/stage-release-artifacts.mjs --platform linux --version 0.1.0 \
  --bundle-dir crates/app/src-tauri/target/release/bundle
```

Run `npm run build` in `crates/app` after changing the updater UI. The Tauri
build itself needs the platform WebView/GTK prerequisites listed in the main
README.
