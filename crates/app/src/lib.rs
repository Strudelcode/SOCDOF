//! SOCDOF desktop application shell.
//!
//! This library holds everything the window layer needs: the startup sequence (instance lock,
//! database, ready state) and the commands that call `socdof-core`. It has no windowing dependency,
//! so the same code runs under Tauri and in the headless smoke test.

#![deny(missing_docs)]

pub mod commands;
pub mod desktop;
pub mod shell;
pub mod shortcuts;
pub mod startup;
pub mod window_state;
