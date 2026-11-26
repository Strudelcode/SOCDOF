//! Deterministic startup handshake between the splash window and the main window.
//!
//! The shell reports `ready` once the instance lock, the database and the session are up; until then a
//! splash window is visible. Every transition is idempotent and every failure closes the splash, so a
//! broken start can never leave the user in front of a splash that never goes away.
//!
//! The module is windowing-free: it returns a [`SplashAction`] and the Tauri layer performs the
//! matching window calls. That keeps the ordering, the error path and the timeout testable without
//! GTK/WebKit.

use socdof_core::now_millis;

/// Milliseconds after which a start that never reported `ready` counts as failed.
pub const STARTUP_TIMEOUT_MS: i64 = 20_000;

/// State of the startup sequence.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StartupPhase {
    /// The splash is visible and the shell is initialising.
    Starting,
    /// The shell is ready; the splash is gone and the main window owns the screen.
    Ready,
    /// Initialisation failed or timed out; the splash is gone and the error is visible.
    Failed,
    /// The splash was closed by the user before the shell reported `ready`.
    Closed,
}

impl StartupPhase {
    /// Stable lower-case name used in the `SOCDOF_SPLASH` smoke markers.
    pub fn as_str(self) -> &'static str {
        match self {
            StartupPhase::Starting => "starting",
            StartupPhase::Ready => "ready",
            StartupPhase::Failed => "failed",
            StartupPhase::Closed => "closed",
        }
    }
}

/// What the window layer has to do after a transition.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SplashAction {
    /// Nothing to do; the transition was already applied.
    None,
    /// Show the splash window and keep the main window hidden.
    ShowSplash,
    /// Close the splash and show and focus the main window.
    ShowMain,
    /// Close the splash and show the main window in its error state.
    ShowError,
}

/// Startup handshake: phases, timeout and idempotent transitions.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StartupHandshake {
    phase: StartupPhase,
    /// Why the start failed (`startup_timeout`, `database_error`, …).
    reason: Option<String>,
    started_at: i64,
    ready_at: Option<i64>,
}

impl Default for StartupHandshake {
    fn default() -> Self {
        Self::new()
    }
}

impl StartupHandshake {
    /// Starts a handshake whose timeout window begins now.
    pub fn new() -> Self {
        Self::new_at(now_millis())
    }

    /// Starts a handshake whose timeout window began at `started_at`.
    pub fn new_at(started_at: i64) -> Self {
        Self {
            phase: StartupPhase::Starting,
            reason: None,
            started_at,
            ready_at: None,
        }
    }

    /// Current phase.
    pub fn phase(&self) -> StartupPhase {
        self.phase
    }

    /// Reason of a failure, if the start failed.
    pub fn reason(&self) -> Option<&str> {
        self.reason.as_deref()
    }

    /// Whether the splash window should currently be on screen.
    pub fn splash_visible(&self) -> bool {
        self.phase == StartupPhase::Starting
    }

    /// Milliseconds between `started_at` and `ready`, once the shell reported ready.
    pub fn ready_after_ms(&self) -> Option<i64> {
        self.ready_at.map(|ready| ready - self.started_at)
    }

    /// Reports that the shell is up. The splash closes exactly once.
    pub fn mark_ready(&mut self) -> SplashAction {
        self.mark_ready_at(now_millis())
    }

    /// [`StartupHandshake::mark_ready`] with an explicit clock, for deterministic tests.
    pub fn mark_ready_at(&mut self, now: i64) -> SplashAction {
        if self.phase != StartupPhase::Starting {
            return SplashAction::None;
        }
        self.phase = StartupPhase::Ready;
        self.ready_at = Some(now);
        SplashAction::ShowMain
    }

    /// Reports a failed initialisation; the splash closes and the error becomes visible.
    pub fn mark_failed(&mut self, reason: impl Into<String>) -> SplashAction {
        if self.phase != StartupPhase::Starting {
            return SplashAction::None;
        }
        self.phase = StartupPhase::Failed;
        self.reason = Some(reason.into());
        SplashAction::ShowError
    }

    /// Closes the splash because the user asked for it.
    pub fn close(&mut self) -> SplashAction {
        if self.phase != StartupPhase::Starting {
            return SplashAction::None;
        }
        self.phase = StartupPhase::Closed;
        self.reason = Some("closed_by_user".to_string());
        SplashAction::ShowMain
    }

    /// Fails the start when it has been in [`StartupPhase::Starting`] for longer than
    /// [`STARTUP_TIMEOUT_MS`], so the splash cannot hang forever.
    pub fn check_timeout(&mut self, now: i64) -> SplashAction {
        if self.phase != StartupPhase::Starting {
            return SplashAction::None;
        }
        if now - self.started_at < STARTUP_TIMEOUT_MS {
            return SplashAction::None;
        }
        self.mark_failed_at("startup_timeout")
    }

    /// [`StartupHandshake::mark_failed`] without borrowing rules surprises in call chains.
    fn mark_failed_at(&mut self, reason: &str) -> SplashAction {
        self.phase = StartupPhase::Failed;
        self.reason = Some(reason.to_string());
        SplashAction::ShowError
    }

    /// Smoke marker for the CI job, e.g. `SOCDOF_SPLASH phase=ready reason=- splash=false`.
    pub fn marker(&self) -> String {
        format!(
            "SOCDOF_SPLASH phase={} reason={} splash={}",
            self.phase.as_str(),
            self.reason.as_deref().unwrap_or("-"),
            self.splash_visible()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_with_a_visible_splash() {
        let handshake = StartupHandshake::new();
        assert_eq!(handshake.phase(), StartupPhase::Starting);
        assert!(handshake.splash_visible());
        assert!(handshake.marker().contains("phase=starting"));
    }

    #[test]
    fn ready_closes_the_splash_once() {
        let mut handshake = StartupHandshake::new_at(1_000);
        assert_eq!(handshake.mark_ready_at(1_250), SplashAction::ShowMain);
        assert_eq!(handshake.phase(), StartupPhase::Ready);
        assert!(!handshake.splash_visible());
        assert_eq!(handshake.ready_after_ms(), Some(250));
        assert_eq!(handshake.mark_ready_at(1_500), SplashAction::None);
        assert_eq!(handshake.ready_after_ms(), Some(250));
    }

    #[test]
    fn failed_start_closes_the_splash_and_keeps_the_reason() {
        let mut handshake = StartupHandshake::new();
        assert_eq!(
            handshake.mark_failed("database_error"),
            SplashAction::ShowError
        );
        assert_eq!(handshake.phase(), StartupPhase::Failed);
        assert!(!handshake.splash_visible());
        assert_eq!(handshake.reason(), Some("database_error"));
        assert!(handshake.marker().contains("reason=database_error"));
        assert_eq!(handshake.mark_ready(), SplashAction::None);
        assert_eq!(handshake.phase(), StartupPhase::Failed);
    }

    #[test]
    fn timeout_closes_the_splash_instead_of_hanging() {
        let mut handshake = StartupHandshake::new_at(0);
        assert_eq!(
            handshake.check_timeout(STARTUP_TIMEOUT_MS - 1),
            SplashAction::None
        );
        assert!(handshake.splash_visible());
        assert_eq!(
            handshake.check_timeout(STARTUP_TIMEOUT_MS),
            SplashAction::ShowError
        );
        assert_eq!(handshake.reason(), Some("startup_timeout"));
        assert!(!handshake.splash_visible());
        assert_eq!(
            handshake.check_timeout(STARTUP_TIMEOUT_MS * 2),
            SplashAction::None
        );
    }

    #[test]
    fn closing_the_splash_twice_changes_nothing() {
        let mut handshake = StartupHandshake::new();
        assert_eq!(handshake.close(), SplashAction::ShowMain);
        assert_eq!(handshake.phase(), StartupPhase::Closed);
        assert_eq!(handshake.close(), SplashAction::None);
        assert_eq!(handshake.mark_ready(), SplashAction::None);
        assert_eq!(handshake.phase(), StartupPhase::Closed);
    }

    #[test]
    fn marker_names_are_stable() {
        let mut handshake = StartupHandshake::new_at(0);
        assert_eq!(
            handshake.marker(),
            "SOCDOF_SPLASH phase=starting reason=- splash=true"
        );
        handshake.mark_ready_at(10);
        assert_eq!(
            handshake.marker(),
            "SOCDOF_SPLASH phase=ready reason=- splash=false"
        );
    }
}
