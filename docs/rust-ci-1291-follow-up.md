# Rust CI follow-up — 2026-11-16

## RUST-CI-025 — Dashboard quick-action renderer has mismatched delimiters

- **First observed:** Rust workflow run 1291, commit `03e34e78ac38695d0e39993c6bbce7223a9679c0`.
- **Failing checks:** workspace Format; Clippy on Linux and Windows; native Linux and Windows desktop builds; WASM build; Linux GUI smoke native-host build.
- **Symptom:** Rust reported an unclosed `ui.horizontal_wrapped` closure and an unexpected closing delimiter in `crates/ui/src/dashboard.rs` around lines 569–585.
- **Root cause:** the Dashboard quick-action loop's closing brace was placed after the `horizontal_wrapped` and card closures. The `for action in DashboardAction::ALL` loop therefore remained open when the closures were closed.
- **Fix:** close the action loop immediately after handling the button, then close `horizontal_wrapped` and the card in their proper nesting order. No UI behavior or checks were removed.
- **Regression coverage:** the existing Dashboard render and quick-action tests remain intact; the full workspace parser/build/test matrix is the verification gate.
- **Verification:** fix committed as `c0e5dbd9a0155c72ad7566a1813d3f6f85238224`; a new current-head Actions run is required. Do not mark resolved until Format, Clippy, Linux/Windows tests, WASM, desktop builds and GUI smoke pass.
- **Effort estimate:** approximately 0.2 hours for CI log inspection, exact source correction and documentation; Actions queue/runtime excluded.
