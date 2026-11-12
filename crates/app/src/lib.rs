//! SOCDOF desktop application shell.
//!
//! This library holds everything the window layer needs: the startup sequence (instance lock,
//! database, ready state) and the commands that call `socdof-core`. It has no windowing dependency,
//! so the same code runs under Tauri and in the headless smoke test.

#![deny(missing_docs)]

pub mod commands;
pub mod desktop;
pub mod dialogs;
pub mod external_assets;
pub mod fleet_bridge;
pub mod invoice_bridge;
pub mod project_bridge;
pub mod restaurant_bridge;
pub mod shell;
pub mod shortcuts;
pub mod startup;
pub mod template_bridge;
pub mod tray;
pub mod window_state;
