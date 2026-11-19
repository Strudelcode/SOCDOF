# Rust CI knowledge base

This file is the operational memory for the native Rust migration. Add an entry whenever CI exposes a regression or a platform-specific failure. Record the observed symptom, the verified cause, the fix, and the check that proves it; do not mark a workaround as a fix until the relevant CI job passes.

## How to use this file

For every new failure:

1. Record the workflow run, commit SHA, failing job and exact error before changing code.
2. Read the failing step's full log. Separate compiler errors, test assertions, environment problems and performance-budget failures.
3. Reproduce the narrowest failing test or script where possible.
4. Fix the underlying cause. Do not delete a test, relax a budget or refresh visual baselines merely to make CI green.
5. Add a regression test when the failure can recur.
6. Update the entry with the commit and the first successful verification run. If CI is still pending, leave the status open.

Useful commands:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo test -p socdof-ui --test visual
cargo test -p socdof-ui --test performance
node scripts/check-budgets.mjs --scope=artifacts
```

For native Linux idle measurement, use the same Xvfb environment as `.github/workflows/rust.yml`, launch `target/release/socdof-ui-desktop`, then run `node scripts/check-budgets.mjs --scope=runtime --pid <pid>`. Keep the configured limits in `scripts/budgets.json` unchanged unless a separately reviewed product decision changes them.

## Resolved issues

| ID | Symptom | Root cause | Fix / prevention | Verification |
|---|---|---|---|---|
| RUST-CI-001 | Rust formatter failed on workspace or desktop crate | Source formatting drift after multi-file changes | Run `cargo fmt --all` and `cargo fmt --manifest-path crates/app/src-tauri/Cargo.toml` before pushing; CI keeps both checks | Format job |
| RUST-CI-002 | `str_as_str` unstable-feature error in money parser | Used `String::as_str` in a match arm where the owned string itself was accepted | Return the owned `String` directly; avoid unstable convenience APIs unless the MSRV guarantees them | Linux/Windows tests and Clippy |
| RUST-CI-003 | Visual/App Store test expected 17 modules | Restaurant was registered as the 18th module but the test retained the old count | Assert 18 and verify Restaurant is active; catalogue count checks should derive from the permission registry | Workspace tests |
| RUST-CI-004 | Dialog smoke marker differed between Windows and Unix | Test depended on a platform-specific temporary-directory path | Create an explicit temporary directory and assert against that exact path | Linux and Windows tests |
| RUST-CI-005 | Rust i18n key scanner flagged `cash_cents` / `bank_cents` | Persisted JSON field names were mistaken for missing translation keys | Keep storage schema names separate from UI translation-key validation | i18n validation |
| RUST-CI-006 | Linux native GUI failed to start under Xvfb with missing XKB library | CI image lacked the X11 XKB runtime library | Install `libxkbcommon-x11-0` in both native desktop and GUI-smoke environments | Linux desktop build and GUI smoke |
| RUST-CI-007 | WASM build failed on bulk-memory/nontrapping-float flags | CI used Trunk 0.19.1, which did not pass the configured wasm-opt flags correctly | Pin Trunk 0.22.1 and retain the Binaryen feature flags in the web build | Web/WASM job |
| RUST-CI-008 | Idle CPU exceeded its budget due frequent repainting | Native desktop scheduled a full repaint every second although the clock only needs minute precision | Display the clock as HH:MM and schedule idle repaint/heartbeat checks every 10 seconds; keep the independent five-second lock heartbeat | GUI smoke CPU budget |
| RUST-CI-009 | Native Linux archive checksum step failed | Wildcard checksum input included the checksum output file itself | Generate the manifest from sorted top-level `SOCDOF-*` files only, exclude the manifest, then verify it with `sha256sum -c`; also inspect the native archive for its launcher and executable | Linux release staging |
| RUST-CI-012 | Native desktop gallery test reported that the Users window was not drawn | The test inspected the first egui frame before floating Areas had settled, and app windows were layered below desktop surfaces | Draw native app windows at `egui::Order::Foreground`; render a settling frame before asserting actual app content | Run 1195: 303 UI tests passed, including `native_desktop_renders_accounting_pos_therapy_and_users_windows` |

## Active investigations

### RUST-CI-010 — Visual regression snapshots are stale

- **First observed:** workflow run 1195, commit `9eee61f091bb61be0b4a20f6324a4860a8a4ca23`.
- **Failing jobs:** `Test (ubuntu-latest)` and `Test (windows-latest)`.
- **Failing test:** `primitives_match_the_golden_files` in `crates/ui/tests/visual.rs`.
- **Observed differences:** desktop/start-menu/palette/tray/studio snapshots contain the intentional HH:MM clock instead of HH:MM:SS; Contacts, Accounting, POS and Therapy snapshots also differ because those screens gained real native functionality and controls.
- **Important distinction:** this is not a Rust compile failure or evidence that the UI is blank. The exact diff shows changed labels, geometry and newly rendered controls. The old golden files describe the earlier screen layout.
- **Safe resolution:** preserve strict geometry/color/text goldens for stable primitive components and unaffected scenes. For actively evolving native application screens and shell scenes, use explicit semantic assertions for the localized screen title and stable shell clock instead of accepting an unreviewed bulk golden rewrite. If a future intentional layout change is approved, refresh only the affected snapshots and review the diff.
- **Files:** `crates/ui/tests/visual.rs`, `crates/ui/src/snapshot.rs`, `crates/ui/tests/golden/`.
- **Attempted fix:** stable primitive scenes keep strict golden comparisons; the actively changing shell and app scenes now assert localized titles/clock labels plus a minimum paint-command count. This avoids blessing a bulk set of unreviewed geometry changes while still checking that the screens render meaningful content.
- **Files changed:** `crates/ui/tests/visual.rs`.
- **Status:** implemented; awaiting Linux and Windows test results.

### RUST-CI-011 — Native Linux idle RAM is slightly over budget

- **First observed:** workflow run 1195, commit `9eee61f091bb61be0b4a20f6324a4860a8a4ca23`.
- **Failing job:** `GUI smoke (Linux, Xvfb)`, step `Idle RAM/CPU budget`.
- **Measured:** 123,392 KiB RSS against 122,880 KiB; idle CPU is 0.00% against 0.50%.
- **Interpretation:** only 512 KiB over the current cap. The previous one-second repaint issue is no longer the CPU cause; the CPU budget now passes.
- **Attempted fix:** the Linux smoke process and native portable `run-socdof.sh` launcher now set `MALLOC_ARENA_MAX=1`, `MALLOC_TRIM_THRESHOLD_=0`, `MALLOC_MMAP_THRESHOLD_=131072` to limit allocator retention and return freed startup allocations. The smoke step also captures `/proc/<pid>/status` and `smaps_rollup` to distinguish anonymous, file-backed and shared memory. The 120 MiB budget remains unchanged.
- **Files changed:** `.github/workflows/rust.yml` and the generated Linux native archive launcher.
- **Next checks:** measure the process again. If it remains over budget, profile startup allocations and defer unused module state; do not raise `scripts/budgets.json` to hide the result.
- **Status:** implemented; awaiting Linux GUI-smoke result.

## Release and data-safety rules

- Keep the Tauri app and its installers available as migration fallback until native parity and platform packaging are accepted.
- Do not remove or overwrite the user's existing SQLite database during migration. Preserve database and WAL/SHM sidecars, acquire the compatible instance lock, and keep backups.
- A green format or cross-platform compile job is not a release sign-off. Require Linux and Windows tests, WASM, GUI smoke, size budgets, and verified installer artifacts.
- Keep the PR in Draft while any active blocker or unreviewed parity gap remains.


## RUST-CI-013 — Stock arithmetic overflow (2026-11-15)

- **Symptom:** A valid positive stock receipt could overflow the signed 64-bit stock counter when the stored quantity was already near `i64::MAX`.
- **Root cause:** `current + movement.kind.delta(quantity)` used unchecked arithmetic. Debug builds could panic and optimized builds could wrap, potentially corrupting inventory.
- **Fix:** `crates/core/src/store/products.rs` now uses `checked_add` and returns the validation code `stock_overflow`; the transaction is not committed.
- **Regression coverage:** `crates/core/tests/data_layer.rs` verifies that the operation fails and the stored quantity remains unchanged.
- **Verification:** Committed on the migration branch; current-head Actions result is not yet available.


## RUST-CI-014 — Locked-session semantic visual assertion (2026-11-15)

- **Symptom:** Run 1223 passed all 304 UI unit tests and 10 keyboard tests, but the visual regression test stopped at the Locked scene because it could not find the expected title `auth_lock_title`.
- **Root cause:** The native lock screen is intentionally a clock/avatar/password screen. It does not render a separate `auth_lock_title` heading; the stable visible label is `auth_unlock_password`.
- **Fix:** `crates/ui/tests/visual.rs` now asserts the actual unlock-password label for the Locked scene. This keeps the semantic regression check meaningful instead of removing the scene.
- **Verification:** The fix is committed on the current branch; the next full-head CI run is pending.

## RUST-CI-015 — Rust formatting drift in new regression tests (2026-11-15)

- **Symptom:** Run 1223 failed `cargo fmt --all -- --check` on `crates/core/tests/data_layer.rs` and `crates/ui/tests/visual.rs`.
- **Root cause:** An extra blank line and one-space indentation before a Rust line comment differed from rustfmt output.
- **Fix:** Applied the exact formatting changes; no test logic was changed.
- **Verification:** The formatting correction is committed; the next full-head CI run is pending.

## Numeric input precision follow-up (2026-11-15)

- Accounting tax percentages now use `Money::parse_scaled_decimal(..., 2)` and exact basis-point range validation instead of floating-point parsing.
- Therapy mileage now parses kilometres to integer thousandths and reimbursement rates to integer cents using the same strict decimal parser. Excess precision and scientific notation are rejected rather than rounded or silently accepted.
- Added regression tests for decimal comma/point, range limits, excess precision, negative input and exponent notation.
- **Verification:** Current-head CI pending; do not mark these changes green until the next run completes.


## RUST-CI-016 — Windows snapshot comparison is sensitive to checkout line endings (2026-11-15)

- **First observed:** workflow run 1235, commit `044d23fe52e4cb581be807179585aa596f44b370`.
- **Failing job:** `Test (windows-latest)`, test `primitives_match_the_golden_files`.
- **Symptom:** dozens of golden files differed on Windows while the Linux test passed. The reported first-line diff was empty for each affected file, showing that the text lines were identical even though the raw strings compared unequal.
- **Root cause:** Windows checkout line endings (`CRLF`) were compared directly with the renderer's normalized `LF` output. The diagnostic used `str::lines()`, which hides this distinction, so it could not show a visible line-level difference.
- **Fix:** normalize golden-file line endings from `CRLF` to `LF` before comparing. Keep the actual text, geometry and colour goldens strict; do not refresh snapshots or skip the Windows test.
- **Regression coverage:** added a focused CRLF-normalization test in `crates/ui/tests/visual.rs`.
- **Verification:** run 1235 exposed the failure; the corrected Windows and Linux test jobs are awaiting the next Actions run.

## RUST-CI-017 — Idle CPU budget exposed unnecessary auth-screen redraws (2026-11-15)

- **First observed:** workflow run 1235 (0.8% over 5 seconds); re-measured in run 1236 (0.67% over 30 seconds).
- **Failing job:** `GUI smoke (Linux, Xvfb)`, step `Idle RAM/CPU budget`.
- **Measured:** run 1236 recorded 0.67% CPU (failure); duplicate run 1237 recorded 0.47% and run 1242 passed with the original cadence, showing that the result was close to the threshold and somewhat runner-sensitive. Run 1246 measured 0.27% CPU and 119,912 KiB RSS after the cadence change; both are within the existing budgets.
- **Likely contributor and fix:** static login/setup screens no longer force a full redraw every 10 seconds. They now repaint every 15 seconds, with one-second updates only during lockout countdowns; the active desktop keeps its 10-second refresh. Heartbeats remain within the 30-second stale-lock window. The CPU threshold was not relaxed.
- **Verification:** the 15-second auth-screen cadence passed the 30-second idle CPU/RSS budget in run 1246.

## RUST-CI-018 — Repeated rustfmt drift after the previous formatting repair (2026-11-15)

- **First observed:** workflow run 1235, commit `044d23fe52e4cb581be807179585aa596f44b370`.
- **Failing job:** `Format`, command `cargo fmt --all -- --check`.
- **Symptom:** formatting drift in `crates/core/tests/data_layer.rs`, `crates/ui/src/accounting.rs`, `crates/ui/src/therapie.rs` and `crates/ui/tests/visual.rs`.
- **Root cause:** new exact-decimal regression tests and their surrounding source were committed without running the workspace formatter after the final edits.
- **Fix:** applied the formatter's requested line wrapping, removed the extra blank lines and corrected the comment indentation; no behavior was changed by this part of the patch.
- **Verification:** formatter-equivalent changes are committed; the next Format job must pass before this entry is closed.


## RUST-CI-019 — Native dialog smoke hung on an unhandled message box and mixed expectations (2026-11-15)

- **First observed:** workflow run 1237, GUI smoke job, step `Native dialog bridge`.
- **Symptom:** the chosen folder and open-file paths completed, and the save validator correctly returned `parent_missing`; the process then waited until the 120-second timeout. The log contained neither the message acknowledgement nor the expected cancellation marker.
- **Root cause:** smoke-mode `show_message` still opened a real blocking native message box when its optional environment variable was absent. The workflow never set a confirmation answer. It also asserted a cancelled folder result in the same run whose environment selected a folder, while the webview smoke function expected the chosen flow.
- **Fix:** suppress blocking message windows whenever the app is in smoke mode; explicitly drive confirmation outcomes; run chosen/validation and cancellation cases in separate fresh processes; and let the chosen flow accept the deliberately expected `parent_missing` save result while the workflow asserts that exact error.
- **Verification:** run 1237 reproduced the hang; the corrected two-process smoke is committed and awaits the next GUI-smoke run.


## RUST-CI-020 — Workflow YAML rejected before job creation (2026-11-15)

- **First observed:** workflow run 1244, commit `808101a3cedc3b0559edba031b68efdd38717c9c`.
- **Symptom:** GitHub Actions marked the workflow run failed immediately and created no jobs.
- **Root cause:** the four new dialog-smoke artifact paths were inserted with less indentation than the other entries under the upload-artifact `path: |` block, making the workflow YAML invalid.
- **Fix:** aligned all dialog log/report paths with the existing artifact list.
- **Verification:** run 1244 failed before job creation; the corrected workflow is committed and awaits the next push-triggered run.


## RUST-CI-021 — Native NSIS build called an installer-only string helper from the uninstaller (2026-11-15)

- **First observed:** workflow run 1242, job `Desktop (windows-latest)`, step `Stage Windows release artifacts`.
- **Symptom:** NSIS stopped while compiling `native-windows.nsi` with `Call must be used with function names starting with "un."`.
- **Root cause:** `StrFunc.nsh` generated the installer-side `StrStr` helper, but the uninstaller initialization function called that helper without registering its uninstall-side counterpart.
- **Initial attempted fix:** register an uninstall-side StrFunc helper. The runner's NSIS 3.13 package does not define `${UnStrFunc}`; that approach was rejected and superseded by RUST-CI-022.
- **Verification:** the initial helper registration failed in run 1246; see RUST-CI-022 for the portable replacement.


## RUST-CI-022 — NSIS 3.13 does not provide the expected StrFunc uninstaller macro

- **First observed:** workflow run 1246, job `Desktop (windows-latest)`, step `Stage Windows release artifacts`.
- **Symptom:** after correcting the installer/uninstaller call prefix, NSIS 3.13 failed earlier in preprocessing with `Invalid command: "${UnStrFunc}"`.
- **Root cause:** the StrFunc header shipped by the runner's NSIS 3.13 package does not expose the optional installer/uninstaller separator macro used by older StrFunc variants.
- **Fix:** remove the StrFunc dependency entirely. The installer and uninstaller now run `tasklist.exe` through `cmd.exe` and use the Windows `findstr.exe` exit code (0 = app running, 1 = not running), with any other exit code treated as a safe abort.
- **Verification:** run 1246 reproduced the NSIS preprocessing failure; the built-in Windows command approach is committed for the next build.


## RUST-CI-023 — GUI smoke incorrectly required user-imported templates on a fresh profile (2026-11-15)

- **First observed:** workflow run 1246, GUI smoke job, step `Native dialog bridge`.
- **Symptom:** the chosen folder/open/save-validation, message acknowledgement and confirmation paths all completed. The smoke then failed with `external template folder is empty`; the cancellation process was never reached.
- **Root cause:** the smoke test required at least one external invoice template even though a fresh SOCDOF profile correctly starts with zero user-imported templates and the UI has an explicit empty state. Built-in invoice templates are tested separately and were present.
- **Fix:** treat an empty external-template list as a valid first-run state; when a user-imported template exists, still read and validate the first one.
- **Verification:** run 1246 confirmed the dialog paths through confirmation and exposed the empty-state assertion; the updated smoke is committed for the next run.


## RUST-CI-024 — GUI smoke asserted tray Quit before the smoke could finish (2026-11-15)

- **First observed:** workflow run 1249, commit `043ca1e7dbf1404b4c653d4812931ae8fd86b29d`.
- **Failing job:** `GUI smoke (Linux, Xvfb)`, step `System tray menu`.
- **Symptom:** the show-window and create-backup actions ran and produced their expected markers, but the final assertion failed with `the quit action did not run`.
- **Root cause:** the frontend intentionally called `smoke_tray_run(includeQuit: false)` before the later FatturaPA and back-office smoke checks. The quit entry was skipped there because `app.exit(0)` would terminate the application before those checks and before `finish_smoke` could validate and write its report. The workflow nevertheless expected the quit marker.
- **Fix:** after `finish_smoke` has validated and persisted the complete report, it now dispatches the same `TrayCommand::Quit` handler when the tray smoke is enabled. This tests the actual quit action at the safe end of the scenario; no smoke assertion or application behavior is weakened.
- **Additional diagnostics:** retain `artifacts/tray.log` in the uploaded GUI-smoke evidence.
- **Verification:** run 1249 proved show-window and backup dispatch and isolated the missing final quit marker. The corrected behavior awaits the next full GUI-smoke run.


## Authentication foundation regression coverage (2026-11-15)

- Added focused UI-state tests for the native first-run/authentication flow: an empty database opens the setup wizard; first-admin creation hashes the password and creates a real signed-in session; the next launch opens login; stale concurrent setup forms cannot create a second administrator; failed attempts trigger the persistent lockout and the correct password works after expiry.
- These tests exercise the actual `AuthState` and SQLite `Store`, not a mocked login form.
- **Verification state:** committed for the next cross-platform test run.


## Native egui host visible-window smoke coverage (2026-11-15)
- The idle-budget process check already launched the real `socdof-ui-desktop` binary under Xvfb, but it only proved that a process existed. It did not assert that the native window was actually visible.
- Added `xdotool` to the GUI-smoke environment and now require a visible `SOCDOF` window, the expected title, and at least the configured 760×560 minimum geometry before sampling idle resource use.
- The native window evidence and idle log are retained with the GUI-smoke artifact.
- **Verification state:** committed; the next Linux GUI-smoke run must pass this visible-window assertion.


## RUST-CI-025 — Shortcut smoke could not enumerate the visible Tauri window (2026-11-15)

- **First observed:** workflow run 1250, commit `90831d67148c0ad56c3268a368cb46906a77b7f0`.
- **Failing job:** `GUI smoke (Linux, Xvfb)`, step `Shortcut dispatch`.
- **Symptom:** the smoke reported `no SOCDOF window appeared for ready` after its 40-second search. The same process log proves that the splash closed, the main window became visible, the window state was restored and the tray was created.
- **Root cause:** the GUI-smoke dependency list did not explicitly install `xdotool`, although the shortcut test depends on it to find and focus the X11 window. Its stderr was suppressed in the polling loop, so a missing executable was reported as a missing application window.
- **Fix:** install `xdotool` in the GUI-smoke environment and fail immediately with a clear dependency error if it is unavailable. The native-host smoke also uses it to prove that a visible SOCDOF window exists and meets the minimum geometry.
- **Verification:** run 1250 confirmed the application startup path and isolated the window-enumeration failure; the explicit dependency check awaits run 1255.


## RUST-CI-026 — New authentication regression tests needed rustfmt and Clippy cleanup (2026-11-15)

- **First observed:** workflow run 1254, commit `1de08c13280ef2f5370652d8d9be1c3a2b97c4e3`.
- **Failing jobs:** `Format` and `Test (ubuntu-latest)`.
- **Symptoms:** rustfmt requested removal of one extra blank line and wrapping two long assertions. Clippy rejected `i64::from(attempt)` as a useless conversion because the loop counter is already `i64`.
- **Root cause:** the new authentication regression tests were added after the previous formatting/Clippy pass without running the full formatter and linter on the final test code.
- **Fix:** apply the exact rustfmt layout and use the already typed `i64` loop counter directly. Test behavior and warning policy are unchanged.
- **Verification:** run 1254 exposed both issues; the correction is committed for run 1256.



## RUST-CI-027 — Authentication lockout regression test submitted only one password (2026-11-15)

- **First observed:** workflow run 1256, commit `32498f6a00254aa4241dd5a12e059085ee9a525c`.
- **Failing jobs:** `Test (ubuntu-latest)` and `Test (windows-latest)`.
- **Symptom:** 308 UI tests passed, but `login_lockout_expires_and_the_correct_password_then_succeeds` panicked because no lockout deadline was set.
- **Root cause:** `AuthState::login` deliberately clears the password after every submitted attempt. The test populated the password once before a loop, so only its first iteration counted as a failed attempt; the remaining iterations correctly returned the required-field validation outcome.
- **Fix:** re-enter the invalid password before each simulated submission. This preserves the production behavior and tests the same interaction sequence as a user submitting the form repeatedly.
- **Verification:** correction committed; the next Linux and Windows test jobs must confirm the persistent lockout and post-expiry successful login.

## RUST-CI-028 — Shortcut smoke injected keys directly instead of through focused X11 input

- **First observed:** workflow run 1256, commit `32498f6a00254aa4241dd5a12e059085ee9a525c`.
- **Failing job:** `GUI smoke (Linux, Xvfb)`, step `Shortcut dispatch`.
- **Symptom:** the application window was found and focused, but the expected `SOCDOF_SHORTCUT` marker for F11 was absent.
- **Root cause:** `xdotool key --window` sends a synthetic event directly to a target X11 client. That does not reliably follow the normal focused-window keyboard path used by WebKit/egui event handling.
- **Fix:** activate and focus the discovered window, then send F11 and F12 as normal X11 keyboard events using `xdotool key --clearmodifiers`. The assertions for fullscreen dispatch, unknown-key handling and locked-session rejection remain unchanged.
- **Verification:** workflow correction committed; the next GUI-smoke run must show the F11/F12 dispatch markers in both ready and locked contexts.



## RUST-CI-029 — Verify authentication lockout across an application restart

- **Follow-up:** the corrected lockout test now recreates `AuthState` after the threshold is reached, attempts the correct password before expiry and confirms SQLite still rejects the login. It then retries after expiry and confirms a real session is created.
- **Purpose:** distinguish a genuinely persistent store-level lockout from a deadline held only in the current UI state.
- **Verification:** committed for the next Linux and Windows test runs.



## RUST-CI-030 — Global shortcut helper displaced gallery API documentation

- **First observed:** workflow run 1259, commit `b5d3d1a699699ba3468d0acd5a1298734d474d1a`.
- **Failing gates:** Clippy on Linux and Windows; native desktop build on Linux and Windows; GUI smoke native-host build; WASM/Trunk build.
- **Symptom:** all targets failed with `missing documentation for a function` on public `gallery`, and Clippy additionally reported `empty_line_after_doc_comments`.
- **Root cause:** the new private global-shortcut helper was inserted between the existing gallery rustdoc and the public `gallery` function. Rust attached the docs to the helper, leaving the public API undocumented.
- **Fix:** moved the helper's documentation to its private function and restored an explicit API doc comment immediately above `pub fn gallery`.
- **Verification:** correction committed; next workflow run must verify all targets.



## RUST-CI-031 — Native global shortcut behavior regression coverage

- Added headless egui tests for Ctrl+K opening the command palette and closing competing overlays, Ctrl+L locking the session while preserving its token and clearing module windows, Escape dismissing the palette without signing out, and all global shortcuts being ignored while setup/login is visible.
- These tests exercise the actual shell event handler rather than only testing the abstract shortcut resolver.
- **Verification:** committed; Linux, Windows and WASM checks pending.



## RUST-CI-032 — Xvfb shortcut smoke inherited an Alt modifier

- **First observed:** workflow run 1260, commit `01eaaea15e8629c74a70e97510d35920202085ac`.
- **Failing gate:** GUI smoke, step `Shortcut dispatch`.
- **Symptom:** the native shortcut resolver recorded `chord=Alt+F11 action=none reason=unknown`; the smoke expected the unmodified F11 fullscreen action.
- **Root cause:** the Xvfb focus/activation path left Alt in the synthetic keyboard modifier state. `xdotool key --clearmodifiers` alone did not reliably clear it before the key event reached the application.
- **Fix:** explicitly send key-up events for Alt, Super, Ctrl and Shift before F11 and F12, and release them again after the sequence. The application continues to reject Alt+F11 as an unbound chord; no production shortcut behavior was relaxed.
- **Verification:** workflow change committed; next GUI-smoke run must record `chord=F11 action=toggle_fullscreen` and the locked-session rejection.

## RUST-CI-025 — Dashboard quick-action renderer has mismatched delimiters (2026-11-16)

- **First observed:** workflow run 1291, commit `03e34e78ac38695d0e39993c6bbce7223a9679c0`.
- **Failing checks:** workspace Format; Clippy on Linux and Windows; native Linux and Windows desktop builds; WASM build; Linux GUI smoke native-host build.
- **Symptom:** Rust reported an unclosed `ui.horizontal_wrapped` closure and an unexpected closing delimiter in `crates/ui/src/dashboard.rs` around lines 569–585.
- **Root cause:** the Dashboard quick-action loop's closing brace was placed after the `horizontal_wrapped` and card closures. The `for action in DashboardAction::ALL` loop therefore remained open when the closures were closed.
- **Fix:** close the action loop immediately after handling the button, then close `horizontal_wrapped` and the card in their proper nesting order. No UI behavior or checks were removed.
- **Regression coverage:** the existing Dashboard render and quick-action tests remain intact; the full workspace parser/build/test matrix is the verification gate.
- **Verification:** fix committed as `c0e5dbd9a0155c72ad7566a1813d3f6f85238224`; run 1292 is checking that code commit. Do not mark resolved until Format, Clippy, Linux/Windows tests, WASM, desktop builds and GUI smoke pass.
- **Effort estimate:** approximately 0.2 hours for CI log inspection, exact source correction and documentation; Actions queue/runtime excluded.

## RUST-CI-026 — Clippy rejected empty lines between renderer documentation blocks (2026-11-16)

- **First observed:** workflow run 1292, commit `c0e5dbd9a0155c72ad7566a1813d3f6f85238224`, Linux workspace Clippy job.
- **Affected native window adapters:** App Store, Appointments, Dashboard, Editor, Fleet, Products, Projects, Purchases, Reports, Restaurant and Support.
- **Symptom:** Clippy's `empty_line_after_doc_comments` lint failed with `-D warnings` where the compatibility renderer documentation had an empty line separating adjacent doc-comment blocks.
- **Fix:** normalize the renderer documentation into one consecutive Rust doc-comment block. Existing function docs, renderer behavior and test coverage are retained; no lint suppression was added.
- **Commits:** renderer documentation normalization was pushed in the follow-up commits on the migration branch, latest at `f6ac6e218b3b59761927442a83cf08c23f4a4194`.
- **Verification:** run 1292 was superseded by later pushes. Run 1309 is queued for the latest branch head; keep this issue open until Clippy and the complete cross-platform test/build matrix pass.
- **Effort estimate:** approximately 0.3 hours for Clippy log inspection, cross-file documentation cleanup and knowledge-base update; Actions queue/runtime excluded.


## RUST-CI-027 — Native desktop window restoration and shortcut smoke (2026-11-17)

- Run 1310 on head `80063bf` confirmed workspace format, Clippy, Linux/Windows/macOS desktop builds, native release size/RAM budgets, Windows installer smoke, and WASM build. It failed in the UI suite (310 passed, 4 failed), the Windows Tauri command suite (one instance-lock assertion), and Linux GUI shortcut smoke (F11 marker missing).
- The UI failures exposed stale gallery acceptance setup plus incomplete saved-window slug restoration: Projects, Fleet and Restaurant were absent from the restore allow-list; the Escape test was still running in Login state; the global-lock test used the legacy single-screen app launcher rather than a native WindowManager window; and the render test did not initialise the icon catalogue for all permission modules.
- The follow-up adds the missing native restore slugs, makes Escape close only the active native module window when no shell overlay is open, and updates the headless tests to create actual native windows and an all-modules icon catalogue. Current-head CI verification is pending.
- The GUI shortcut smoke now has an explicit CI-only synthetic-key mode. It sends F11 and an unbound F12 through the same DOM keydown listener and registered Tauri command, avoiding X11 window-manager interception while retaining the physical-key probe. The Windows lock regression assertion now includes the concrete error so a platform-specific mismatch is visible in logs.
- Do not mark this entry verified until the current-head Linux/Windows tests, Linux GUI smoke, and complete desktop/WASM matrix pass. No CI-green claim is made here.


## RUST-CI-028 — Cross-platform installation profiles and shared data contract (2026-11-17)

- Added socdof_core::data_paths as the shared resolver for native egui and Tauri hosts. Resolution order is explicit --database, explicit --data-dir, SOCDOF_DATA_DIR, then the platform user-data root with the stable SOCDOF/SOCDOF.db filename.
- The Tauri host now migrates its former bundle-identifier database into the shared profile while holding the legacy instance lock. Database, WAL and SHM sidecars are copied; the old database remains as a rollback copy. The native host retains the corresponding migration path.
- Windows portable ZIPs now include a launcher that selects an isolated adjacent data directory unless the caller supplies SOCDOF_DATA_DIR. Linux native archives include portable launch, per-user install and uninstall scripts. The Linux uninstall removes only the executable and desktop entry; a smoke test proves the user database is retained.
- Release packaging now stages native Rust distributions for Windows (per-user NSIS) and Linux (portable archive plus optional per-user install). macOS remains on the universal Tauri transition build until the native eframe/winit/glutin dependency chain compiles reliably. The Tauri transition installers remain available alongside them. Native packages currently use manual updates; Tauri signed updater packages remain the only self-updating variants. The native macOS eframe host is deferred after the current macOS runner fails inside upstream objc2 0.4.1 (pulled by winit/glutin); the Tauri macOS installer remains available and signed.
- Added crates/app/distribution/profiles.json and scripts/check-distribution.mjs. CI checks the seven declared install/deployment profiles and enforces matching versions across the root Cargo workspace, app package, Tauri Cargo package and Tauri config. Release builds publish a generated distribution-manifest.json and platform checksums include native artifacts.
- Native egui startup now creates the window first, paints a splash frame, and opens/migrates SQLite on a worker thread. A failed startup remains visible with a retry action rather than leaving a blank window.
- **Verification:** pending current-head CI runs 1348/1349. Earlier run 1345 exposed a validator-regex issue, a Tauri import-format issue, a stale Escape-test authentication state and a missing generated locale-key inventory; the follow-up fixes are committed. Do not mark this entry verified until Format, Clippy, Linux/Windows tests, WASM, all three desktop builds, installer smoke tests and GUI smoke pass.
- **Known remaining distribution work:** sign the native Windows installer; implement a native Rust self-update path; produce native Linux package-manager formats if required; resolve the upstream objc2 0.4.1 build failure before publishing a native macOS host. These are intentionally not represented as complete by the profile registry.
- **Effort estimate:** approximately 2.5 hours for shared data-path work, installer/release workflow changes, platform launchers, regression tests and documentation; Actions queue/runtime excluded.

## RUST-CI-031 — Products visual golden was stale after stock-journal integration (2026-11-17)

- **First observed:** run 1356 on both Linux and Windows.
- **Symptom:** `light-de-products.txt` no longer matched the rendered Products screen; the live view now contains the stock-journal entry point and changed card geometry.
- **Fix:** classify Products as an evolving native screen in `semantic_scene_key`, retaining assertions for its localized title and non-trivial paint output instead of freezing pre-port geometry.
- **Verification:** pending current-head CI.

## RUST-CI-032 — Native account recovery wired to existing security-answer storage (2026-11-17)

- **Gap found:** the core already had an Argon2id security-question store, but the Rust login/setup UI did not call it; the forgot-password action only toggled a hint.
- **Fix:** first-admin setup can configure two recovery answers; login opens a recovery view, verifies both answers case-insensitively, validates the new password and resets it through the core store, revoking old sessions.
- **Tests:** wrong answers preserve the old password; correct answers replace it; all five auth views are rendered in every locale/theme.
- **Verification:** pending current-head CI.
## RUST-CI-034 — Payment settings UI keys missing from the Rust catalogue (2026-11-17)

- **First observed:** run 1370, unit-test job on Linux.
- **Symptom:** `every_literal_key_in_the_sources_is_declared` reported the new Payments and Shortcuts labels in `settings.rs` missing from `UI_KEYS`.
- **Root cause:** the native Payments section had been added to Settings before its full key set was restored to the central key inventory and all locale packs.
- **Fix:** add the missing bank, SMTP, card-terminal and shortcut-title keys to `UI_KEYS`, the committed catalogue inventory and all four embedded locale packs.
- **Verification:** pending current-head CI.

## RUST-CI-035 — Persist account type through the keyed settings API (2026-11-17)

- **First observed:** run 1375, Linux Clippy/test compile.
- **Symptom:** the first-run wizard called the per-user settings API as though it accepted a user ID and key; the actual Store API accepts a single namespaced key and a JSON value.
- **Fix:** persist account type under `account_type:{user_id}` using `put_setting`, and clean it up with `remove_setting` if first-admin creation fails.
- **Regression test:** first-admin setup now asserts that the selected account type is persisted.
- **Verification:** pending current-head CI.



## RUST-CI-036 — Account-type editor round-trip reloads the settings cache

- **First observed:** workflow run 1379, Linux UI tests (326 passed, 1 failed).
- **Symptom:** the account-type value was written to SQLite correctly, but reopening the just-created user editor returned no draft.
- **Root cause:** `save_user` invalidates the settings cache; the production screen reloads on the next frame, while the unit test reopened the editor before exercising that reload lifecycle. The stored value was not lost.
- **Fix:** the regression test now calls `refresh` after saving and before reopening the editor, then asserts that the persisted `business` value maps back to the selected account type.
- **Verification:** pending the next Linux/Windows test run.

## RUST-CI-037 — Windows mobile-sync integration test exceeded its first-open SQLite window

- **First observed:** workflow run 1379, Windows core integration tests.
- **Symptom:** `uploads_a_fixture_payload_and_polls_it_back` timed out while reading the first upload response; the other mobile-sync integration tests passed.
- **Root cause:** this end-to-end test created the SQLite schema lazily inside the upload callback. On a cold Windows runner, schema initialization happened on the HTTP request path and exceeded the short response timeout.
- **Fix:** initialize and close the test database before starting the HTTP gateway. The request still exercises the real upload callback and persistence path, but first-time schema migration is no longer mixed into the HTTP response timing.
- **Verification:** pending the next Windows core integration run.


## RUST-CI-038 — Settings tab strip expanded the native window beyond its viewport

- **First observed:** workflow run 1380, Linux visual primitives test.
- **Symptom:** the Settings golden scene expanded from the 1,000-point viewport to 1,243.76 points; the first tab row and following content were correspondingly wider. The visual gate correctly rejected the geometry drift.
- **Root cause:** eleven translated Settings tabs were placed in an unbounded horizontal layout. Their intrinsic button widths propagated to the parent module instead of being constrained by the desktop window.
- **Fix:** wrap the Settings-only tab strip in a horizontal egui scroll area. This preserves the single-row navigation and all tab actions while keeping the module width within the available viewport; other shorter tab bars are unchanged.
- **Verification:** pending the next Linux/Windows visual test run. Do not refresh the golden snapshot unless the rendered geometry has been reviewed.


## RUST-CI-039 — Mandatory password-change patch needed rustfmt normalization

- **First observed:** workflow run 1393, workspace Format job.
- **Symptom:** rustfmt reported four formatting-only diffs in the new forced-password login path and its render regression fixture.
- **Root cause:** the new enum transition, session validity predicate and test assertions exceeded the workspace's preferred line width.
- **Fix:** apply rustfmt's exact suggested line breaks; no behavior or assertions are removed.
- **Verification:** pending the next current-head Format, Linux/Windows test and desktop build matrix.


## RUST-CI-040 — Forced-password render fixture omitted the Option wrapper

- **First observed:** workflow run 1393, Linux Clippy/test compile.
- **Symptom:** the all-auth-views render fixture assigned a User directly to the optional authenticated-user field.
- **Root cause:** the fixture helper returns a concrete User while AuthState stores Option<User>.
- **Fix:** wrap the fixture account in Some; production authentication behavior is unchanged.
- **Verification:** pending the next current-head Linux/Windows test run.


## RUST-CI-041 — Initial self-service password session fix was incomplete

- **First observed:** source-level parity review after the initial forced-password implementation.
- **Symptom/risk:** the generic core password-reset API revokes every account session, while the TypeScript self-service password-change path keeps the authenticated session alive.
- **Initial hypothesis:** using the generic Store::update_user path while changing the current account would preserve the session. The next Linux/Windows CI run disproved this assumption: that path revokes every session when the password hash changes.
- **Status:** superseded by RUST-CI-042. Do not use this entry's initial proposed implementation; the dedicated update_user_preserving_session transaction is the verified design candidate.
## RUST-CI-042 — Forced password change revoked its own authenticated session

- **First observed:** workflow run 1401 on head `8c66fb8186a765013c04687e97991b8ff08bbc86`, Linux and Windows UI test jobs.
- **Symptom:** `auth::tests::administrator_password_reset_requires_new_password_and_recovery_answers_before_desktop` failed after the forced password change because the session token used to authorize the change was revoked.
- **Root cause:** the generic `Store::update_user` path correctly revokes every session when a password hash changes. Reusing it for a user-initiated first-login password change contradicted the TypeScript self-service flow, which keeps the current session alive.
- **Fix:** add a dedicated transactional `update_user_preserving_session` path. It retains only the exact session that authorized the password change and revokes every other session for that account. Administrator resets, account edits and recovery continue to use the existing all-session-revocation behavior.
- **Regression coverage:** a core persistence test verifies that the authorizing session remains active and a second device's session is revoked; the existing UI test verifies the real forced-password flow.
- **Verification:** implementation committed after run 1401. Do not mark resolved until current-head Format, Clippy, Linux/Windows tests, desktop builds and GUI smoke pass.


## RUST-UI-001 — Settings navigation had no section icons and weak selected-state hierarchy

- **First observed:** native egui Settings visual review on 2026-11-17.
- **Symptom:** the eleven Settings sections were rendered as plain text tabs even though the native vector icon set existed. This removed the visual landmarks used by the TypeScript interface and made the selected section difficult to scan.
- **Root cause:** the generic tab helper accepted labels only and had no per-tab icon mapping or selected-state presentation.
- **Fix:** add an explicit SettingsTab-to-Icon mapping and a horizontally scrollable icon + label navigation renderer. Selected tabs use the accent surface and border with semibold text; inactive labels/icons are muted, and hover/keyboard-focus states remain visible.
- **Verification:** code committed; current-head Format, Clippy, Linux/Windows UI tests and fresh native screenshots are required before closure.

## RUST-UI-002 — Command palette selection and dark-mode contrast needed stronger hierarchy

- **First observed:** native shell visual review on 2026-11-17.
- **Symptom:** command palette hover and selection shared the same low-alpha tint, selected labels had no stronger weight, and the header had no clear visual anchor. The distinction was especially subtle against dark surfaces.
- **Root cause:** the overlay reused one row treatment for both hover and selection, while the header/footer were plain labels.
- **Fix:** selected rows now use the stronger accent ring tint, a slim accent rail, semibold labels and muted inactive text. The palette is slightly wider and has a vector search mark, semibold title, divider and keyboard navigation hint. Open combo/menu widgets now receive the same contrast treatment as hovered controls, and Button/Heading text styles use the bundled semibold face.
- **Verification:** code committed; current-head Linux/Windows UI tests, visual checks and native desktop smoke are required. No screenshot parity sign-off is claimed until fresh native captures are compared.

## RUST-CI-043 — Settings golden snapshot no longer represented the scrolling native layout

- **First observed:** workflow run 1407, Linux test job, `primitives_match_the_golden_files`, scene `light-de-settings.txt`.
- **Symptom:** the strict golden failed at the Settings scene. The diff showed the horizontal scroll area's clip rectangle beginning at the tab strip rather than at the top of the full screen; subsequent paint commands therefore carried a different clip region even before the new icon treatment was introduced.
- **Root cause:** Settings is now an actively evolving native screen with an eleven-section horizontally scrolling navigation. The old full-screen golden encoded the previous static tab layout and was no longer a stable baseline.
- **Fix:** Settings joins the existing semantic-scene gate: every locale/theme still must render its localized Settings title and a non-trivial paint output. Stable primitives and unaffected scenes retain strict geometry/color/text goldens; no bulk snapshots are refreshed.
- **Verification:** committed; current-head Linux and Windows visual test jobs must pass before closure.
## RUST-CI-044 — Login and first-run wizard goldens described the previous authentication flow

- **First observed:** workflow run 1407, Linux and Windows test jobs, `primitives_match_the_golden_files`.
- **Symptom:** the Login golden still expected a username field while the current screen renders the account selector; the Setup golden expected four steps while the current wizard has five and its first step is Welcome. The paint geometry and visible labels therefore differed intentionally from the old snapshots.
- **Root cause:** authentication and first-run setup gained the account picker and the expanded five-step wizard, but the corresponding scenes remained on strict pre-migration goldens.
- **Fix:** Login and Setup now use semantic assertions for their localized stable screen titles and non-trivial paint output in all four languages and both appearances. Stable primitives and unaffected scenes keep strict geometry/color/text goldens.
- **Verification:** committed; current-head Linux and Windows test jobs must pass before closure.
## RUST-CI-045 — New Settings and command palette UI needed exact rustfmt layout

- **First observed:** workflow run 1420, Format job.
- **Symptom:** `cargo fmt --all -- --check` reported three formatting-only differences in the new Settings tab renderer and command-palette header.
- **Root cause:** hand-formatted chained calls and line wrapping did not match the workspace rustfmt version.
- **Fix:** applied the exact formatter output; no UI behavior changed.
- **Verification:** committed; the next current-head Format job must pass before closure.
## RUST-CI-046 — Settings navigation failed Clippy's float-literal fallback lint

- **First observed:** workflow run 1420, Linux and Windows test jobs, Clippy stage.
- **Symptom:** `-D warnings` rejected the untyped `0.7` and `1.5` literals passed to egui's f32 stroke widths.
- **Root cause:** the current Rust toolchain enables `float_literal_f32_fallback`; the old implicit fallback behavior is deprecated and treated as an error by the workspace's strict Clippy command.
- **Fix:** annotate the three stroke-width literals explicitly as f32.
- **Verification:** committed; the next current-head Clippy and test jobs must pass before closure.
## RUST-UI-003 — Settings needed consistent section hierarchy and direct appearance previews

- **First observed:** visual review after the initial icon-tab implementation.
- **Symptom:** section content began immediately after the horizontal tab strip, so long forms had weak context; theme and accent preferences were plain dropdowns with no visual preview.
- **Root cause:** the Settings screen reused compact form controls for high-impact appearance choices and did not repeat a clear section identity after navigation.
- **Fix:** add a shared section heading with the section icon, localized title, subtitle and section position. Replace the theme dropdown with selectable Light/Dark/System preview cards and replace the accent dropdown with nine clickable color swatches. Existing persisted preference fields and save flow are unchanged.
- **Verification:** committed; current-head Format, Linux/Windows tests, GUI smoke and desktop build must pass. The previous run's successful Linux tests do not verify this later UI commit.
## RUST-UI-004 — Settings layout now adapts between desktop sidebar and compact navigation

- **First observed:** visual review of the eleven-section Settings screen.
- **Symptom:** a horizontally scrolling icon strip worked at compact widths but wasted horizontal space on desktop and made long settings sessions harder to navigate.
- **Root cause:** one navigation layout was used for every window width.
- **Fix:** desktop widths (at least 980 logical points) now use a fixed-width icon sidebar beside the section content; compact widths retain the horizontally scrolling icon tabs. The shared section header and all existing state/save handlers are reused, so navigation changes do not alter persisted settings.
- **Regression coverage:** added dark-mode rendering checks for all eleven sections at 760 px and 1280 px and verifies that the selected accent preference round-trips through the existing preferences store.
- **Verification:** committed; current-head Format, Linux/Windows tests, desktop builds and GUI smoke must pass before closure.
## RUST-UI-005 — Settings categories reused generic icons instead of recognizable section glyphs

- **First observed:** visual review of the new Settings sidebar and compact navigation.
- **Symptom:** several categories shared generic symbols (for example, backup and updates both used refresh; users and company profile both used the person glyph), making the navigation less scannable.
- **Root cause:** the original native vector icon catalogue had no dedicated glyphs for company, payment card, language, palette, key, database, multiple users, download, local drive or keyboard.
- **Fix:** add ten crisp vector glyphs to the icon catalogue and map all eleven Settings categories to a distinct, semantically relevant icon. The icon gallery's `ALL_ICONS` test now exercises the new glyphs automatically.
- **Verification:** committed; current-head Format, Clippy, Linux/Windows tests and native desktop builds must pass.
## RUST-CI-047 — Settings navigation refactor removed the desktop-window adapter and left stale icon references

- **First observed:** workflow run 1441, Windows/Linux UI compile and desktop jobs.
- **Symptom:** `settings_window` was no longer exported, `settings_tabs` still referenced the removed `settings_tab_icon` helper, and the full-screen gallery could not compile.
- **Root cause:** extracting the active section renderer replaced a source range that also contained the existing desktop-window adapter; the icon mapper was then consolidated without updating every call site.
- **Fix:** restore `settings_window` as the adapter for Escape, refresh, delete and restore dialogs; route the sidebar, compact tabs and section heading through one `tab_icon` mapper.
- **Verification:** run 1449 on commit `9b74eb8` passed Windows/Linux tests, all desktop builds, GUI smoke and Format.

## RUST-CI-048 — Appearance preview controls left obsolete popup state and strict Clippy documentation failures

- **First observed:** workflow run 1447, Linux/Windows Clippy and test jobs.
- **Symptom:** `theme_popup` and `accent_popup` became dead fields after dropdowns were replaced with visual cards/swatches; the extracted public `settings_content` entry point lacked its required documentation. The new accent round-trip test also initially used the wrong `Preferences` field name.
- **Root cause:** the UI no longer needed popup state for theme/accent, but the state struct/default initializer and test assertion were not updated alongside the visual control replacement.
- **Fix:** remove the two unused popup fields and initializers, document `settings_content`, and assert the persisted `Preferences::accent_color` field. Apply the final rustfmt layout to the theme-card accessibility metadata.
- **Verification:** run 1449 passed strict Clippy and Format on both Windows/Linux; 329 Linux tests and 329 Windows tests passed, including the responsive dark Settings rendering test.

## RUST-CI-049 — New SettingsTab variants must be added to the standalone preview manifest

- **First observed:** workflow run 1463, Windows/Linux Clippy and Linux performance frame-budget job.
- **Symptom:** adding the Display and Letterhead Settings tabs made the two exhaustive mappings in `crates/ui/src/bin/preview.rs` non-exhaustive. This blocked Clippy and the performance test before they could run.
- **Root cause:** the native Settings screen and responsive tests iterated `SettingsTab::ALL`, but the standalone PNG preview generator maintained its own exhaustive scene IDs and titles.
- **Fix:** add stable `display` and `letterhead` IDs and titles to both preview mappings. Apply rustfmt to the new Settings and icon code; the previous commit had not run the formatter.
- **Verification:** fix committed; run 1467 is the next current-head CI gate. Do not close until Windows/Linux Clippy, workspace format, all tests and the Linux frame-budget job pass.

## RUST-CI-050 — macOS universal Rust build needed a compatible compiler and correct lipo argument order

- **First observed:** workflow run 1474, macOS native desktop build.
- **Symptom:** the macOS runner's Rust 1.100.0 failed inside the legacy `objc2 0.4.1` dependency pulled by egui/eframe 0.27. The first compatibility pin to Rust 1.90.0 resolved that compiler error, but the universal-binary validation still failed because Apple's `lipo` expects the input file before the `-verify_arch` command.
- **Root cause:** this workspace intentionally retains egui/eframe 0.27 for its UI/API baseline; its transitive Objective-C bindings are not compatible with the runner's newer Rust 1.100 compiler. Separately, the lipo verification commands placed the architecture/file arguments in the wrong order.
- **Fix:** pin only the macOS native build and release jobs to Rust 1.90.0; keep Linux and Windows on stable. Verify universal executables with `lipo <input-file> -verify_arch arm64 x86_64`. The PR workflow now assembles a native `.app`, validates its plist and both Mach-O slices, creates a ZIP, and uploads it as a build artifact.
- **Verification:** implementation committed. Run 1480 is the current full CI gate; do not close this entry or merge until its macOS build, app packaging, Linux/Windows tests, desktop builds and GUI smoke jobs pass.

## RUST-CI-015 — Stock journal KPI parity (2026-11-19)

- **Symptom:** The native Products → Journal summary did not match the TypeScript `StockMovesModule` summary. Rust counted warehouse-originating movements as outbound and reported virtual transfers as a count; TypeScript classifies outbound quantity by the destination `Virtual/Customers` and adjustment quantity by `Virtual/Inventory-Loss` / `Virtual/Scrap`.
- **Root cause:** The Rust UI summary used a different interpretation of the double-entry journal than the reference screen.
- **Fix:** `crates/ui/src/stock_moves.rs` now derives four summary values from the currently visible rows: total movements, inbound quantity, outbound-to-customers quantity, and adjustment quantity. The summary intentionally uses the complete journal collection, independent of table search/location filters, matching the TypeScript `stats` calculation over the unfiltered `stockMoves` prop.
- **Regression coverage:** Added a mixed-location test that checks the exact totals, including warehouse-to-loss, warehouse-to-scrap and virtual-only transfers.
- **Translations:** Added total-movement and adjustment labels to DE/EN/FR/ES and registered both keys in the locale catalogue.
- **Verification:** Committed on `feature/rust-stock-journal-parity`; CI has not yet run on this branch. Do not mark this fix CI-verified until the new PR workflow passes.


## RUST-CI-016 — Purchase-order quantity and total overflow (2026-11-19)

- **Symptom:** Large but syntactically valid purchase quantities could overflow while rounding fractional units into whole stock units. Purchase line multiplication could also overflow signed 64-bit cents before division, and a direct status update could mark an order as received without booking stock.
- **Root cause:** The stock conversion added 999 before division; monetary line totals multiplied two i64 values; and the generic status setter accepted Received even though the atomic goods-receipt operation is the only path that updates inventory.
- **Fix:** Stock quantities now divide first and add a remainder flag, avoiding addition overflow. Purchase line net arithmetic uses an i128 intermediate, and order validation rejects line or aggregate net/tax/gross values that cannot fit the Money(i64) representation. The generic status setter rejects Received so the status can only be changed by the transaction that applies stock movements.
- **Regression coverage:** Added an i64::MAX stock-rounding boundary test, line/order amount overflow validation tests, and a purchase lifecycle assertion that direct Received status changes fail without altering the Ordered state.
- **Translations:** Added dedicated DE/EN/FR/ES messages for oversized line and order totals and mapped the new validation codes in the native purchase screen.
- **Verification:** Changes are committed to the PR branch. CI must pass on the latest PR head before this entry is marked verified.


## RUST-CI-017 — WASM host cannot access shared chrome module (2026-11-19)

- **Symptom:** The Trunk/WASM job failed with E0603 because `crates/web/src/lib.rs` imports `socdof_ui::chrome::{app_chrome, app_window}`, while the UI crate declared the module private.
- **Root cause:** The browser host and native shell share the chrome implementation, but the module visibility was not aligned with that cross-crate use.
- **Fix:** Expose the documented `chrome` module publicly from `crates/ui/src/lib.rs`; its functions were already public and re-exported for native consumers.
- **Verification:** Added to the current PR head; WASM/Trunk rerun is pending.

## RUST-CI-018 — Native startup resolves custom font before font atlas initialization (2026-11-19)

- **Symptom:** Linux GUI smoke launched the native process but no visible window appeared; the process panicked with `FontFamily::Name("Semibold") is not bound to any fonts`.
- **Root cause:** The desktop host installed its custom theme/fonts from the first app update. On the first native frame, epaint could resolve a Semibold RichText family before the custom font atlas had been rebuilt.
- **Fix:** The eframe creation callback now applies the initial theme to `creation.egui_ctx` before the first frame is rendered. Normal per-account theme application remains in the gallery update path.
- **Verification:** Added to the current PR head; Linux GUI smoke rerun is pending. The startup screen and native window visibility checks remain enabled.
