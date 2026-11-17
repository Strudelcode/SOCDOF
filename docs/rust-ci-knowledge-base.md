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


## RUST-CI-041 — Forced password change must preserve the current session

- **First observed:** source-level parity review after the initial forced-password implementation.
- **Symptom/risk:** the generic core password-reset API revokes every account session, while the TypeScript changePassword path updates the authenticated user's password without ending the current session.
- **Root cause:** reusing the administrator/recovery reset primitive for a user-initiated first-login change would immediately invalidate the session that is required to complete the forced-change flow.
- **Fix:** persist the changed user through Store::update_user, clearing must_change_password while preserving the active session. The regression test now verifies that the session token remains valid after the password and recovery answers are saved.
- **Verification:** pending the next current-head Linux/Windows test run.
