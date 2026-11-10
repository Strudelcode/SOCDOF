//! Keyboard shortcut to application action mapping.
//!
//! The table lives here instead of the window layer so the same event always produces the same
//! decision: which action a chord triggers, whether the current state allows it, and whether a
//! repeated key is ignored. Only bindings that are already documented get a default — F11 for
//! fullscreen, Ctrl+K for the command palette (README, Phase 5) and Ctrl+L for the lock screen
//! (Phase 6). Window snapping has no agreed chord yet, so [`default_bindings`] leaves it out and the
//! caller can register one without touching this decision path.

use serde::Serialize;

/// A key that takes part in a shortcut.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Key {
    /// `F11`, the documented fullscreen toggle.
    F11,
    /// `K`, used with Ctrl for the command palette.
    K,
    /// `L`, used with Ctrl for the lock screen.
    L,
    /// `Escape`, dismisses overlays.
    Escape,
    /// Any key without a binding.
    Other,
}

impl Key {
    /// Parses the key name the web layer reports (`event.key`).
    pub fn from_name(name: &str) -> Self {
        match name {
            "F11" => Key::F11,
            "k" | "K" => Key::K,
            "l" | "L" => Key::L,
            "Escape" | "Esc" => Key::Escape,
            _ => Key::Other,
        }
    }

    /// Stable name used in smoke markers.
    pub fn as_str(self) -> &'static str {
        match self {
            Key::F11 => "F11",
            Key::K => "K",
            Key::L => "L",
            Key::Escape => "Escape",
            Key::Other => "other",
        }
    }
}

/// Modifier state of a key event.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct Modifiers {
    /// Ctrl (or Cmd on macOS).
    pub control: bool,
    /// Shift.
    pub shift: bool,
    /// Alt.
    pub alt: bool,
    /// Meta/Cmd.
    pub meta: bool,
}

impl Modifiers {
    /// Modifiers with Ctrl (or Cmd) held.
    pub fn control() -> Self {
        Self {
            control: true,
            ..Self::default()
        }
    }

    /// Whether no modifier is held.
    pub fn is_empty(self) -> bool {
        !(self.control || self.shift || self.alt || self.meta)
    }
}

/// A key plus its modifiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct KeyChord {
    /// The pressed key.
    pub key: Key,
    /// Modifiers held with it.
    pub modifiers: Modifiers,
}

impl KeyChord {
    /// Builds a chord.
    pub fn new(key: Key, modifiers: Modifiers) -> Self {
        Self { key, modifiers }
    }

    /// Smoke-marker form, e.g. `F11`, `Ctrl+K`.
    pub fn label(&self) -> String {
        let mut parts = Vec::new();
        if self.modifiers.control {
            parts.push("Ctrl");
        }
        if self.modifiers.alt {
            parts.push("Alt");
        }
        if self.modifiers.shift {
            parts.push("Shift");
        }
        if self.modifiers.meta {
            parts.push("Meta");
        }
        parts.push(self.key.as_str());
        parts.join("+")
    }
}

/// What a shortcut does in the application.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AppAction {
    /// Toggle the main window between windowed and fullscreen.
    ToggleFullscreen,
    /// Open the command palette.
    OpenCommandPalette,
    /// Lock the active session.
    LockSession,
    /// Dismiss the topmost overlay.
    Dismiss,
}

impl AppAction {
    /// Stable name used in smoke markers.
    pub fn as_str(self) -> &'static str {
        match self {
            AppAction::ToggleFullscreen => "toggle_fullscreen",
            AppAction::OpenCommandPalette => "open_command_palette",
            AppAction::LockSession => "lock_session",
            AppAction::Dismiss => "dismiss",
        }
    }

    /// Whether the action works while an overlay or a busy start blocks the others.
    pub fn allowed_when_locked(self) -> bool {
        matches!(self, AppAction::Dismiss)
    }
}

/// A default binding.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Binding {
    /// The chord that triggers it.
    pub chord: KeyChord,
    /// The action it triggers.
    pub action: AppAction,
}

/// The documented bindings.
///
/// Deliberately short: only chords that appear in the docs are bound. Snapping waits for a product
/// decision and stays unbound here.
pub fn default_bindings() -> Vec<Binding> {
    vec![
        Binding {
            chord: KeyChord::new(Key::F11, Modifiers::default()),
            action: AppAction::ToggleFullscreen,
        },
        Binding {
            chord: KeyChord::new(Key::K, Modifiers::control()),
            action: AppAction::OpenCommandPalette,
        },
        Binding {
            chord: KeyChord::new(Key::L, Modifiers::control()),
            action: AppAction::LockSession,
        },
        Binding {
            chord: KeyChord::new(Key::Escape, Modifiers::default()),
            action: AppAction::Dismiss,
        },
    ]
}

/// State the decision depends on.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ShortcutContext {
    /// True while a modal overlay or a locked session blocks the ordinary shortcuts.
    pub locked: bool,
}

impl ShortcutContext {
    /// Unlocked context.
    pub fn ready() -> Self {
        Self { locked: false }
    }

    /// Locked context: only [`AppAction::Dismiss`] is allowed.
    pub fn locked() -> Self {
        Self { locked: true }
    }
}

/// Why an event did not run an action.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RejectReason {
    /// The chord has no binding.
    Unknown,
    /// The key was held down and the event is a repeat.
    Repeat,
    /// The context blocks this action.
    Locked,
}

impl RejectReason {
    /// Stable name used in smoke markers.
    pub fn as_str(self) -> &'static str {
        match self {
            RejectReason::Unknown => "unknown",
            RejectReason::Repeat => "repeat",
            RejectReason::Locked => "locked",
        }
    }
}

/// Result of resolving one key event.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum ShortcutOutcome {
    /// The action must run.
    Action {
        /// The action to perform.
        action: AppAction,
    },
    /// Nothing runs.
    Ignored {
        /// Why nothing runs.
        reason: RejectReason,
    },
}

/// Resolves one key event against `bindings`.
///
/// A repeated key event never runs an action: holding F11 must not flicker the window. An unknown
/// chord is ignored, and a locked context only lets [`AppAction::Dismiss`] through.
pub fn resolve(
    context: ShortcutContext,
    bindings: &[Binding],
    chord: KeyChord,
    repeat: bool,
) -> ShortcutOutcome {
    if repeat {
        return ShortcutOutcome::Ignored {
            reason: RejectReason::Repeat,
        };
    }
    match bindings
        .iter()
        .find(|binding| binding.chord == chord)
        .map(|binding| binding.action)
    {
        Some(action) if context.locked && !action.allowed_when_locked() => {
            ShortcutOutcome::Ignored {
                reason: RejectReason::Locked,
            }
        }
        Some(action) => ShortcutOutcome::Action { action },
        None => ShortcutOutcome::Ignored {
            reason: RejectReason::Unknown,
        },
    }
}

/// Smoke marker for a resolved event, e.g.
/// `SOCDOF_SHORTCUT chord=F11 action=toggle_fullscreen`.
pub fn marker(chord: KeyChord, outcome: ShortcutOutcome) -> String {
    match outcome {
        ShortcutOutcome::Action { action } => {
            format!(
                "SOCDOF_SHORTCUT chord={} action={}",
                chord.label(),
                action.as_str()
            )
        }
        ShortcutOutcome::Ignored { reason } => format!(
            "SOCDOF_SHORTCUT chord={} action=none reason={}",
            chord.label(),
            reason.as_str()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(context: ShortcutContext, chord: KeyChord) -> ShortcutOutcome {
        resolve(context, &default_bindings(), chord, false)
    }

    #[test]
    fn a_documented_binding_triggers_exactly_one_action() {
        assert_eq!(
            run(
                ShortcutContext::ready(),
                KeyChord::new(Key::F11, Modifiers::default())
            ),
            ShortcutOutcome::Action {
                action: AppAction::ToggleFullscreen
            }
        );
        assert_eq!(
            run(
                ShortcutContext::ready(),
                KeyChord::new(Key::K, Modifiers::control())
            ),
            ShortcutOutcome::Action {
                action: AppAction::OpenCommandPalette
            }
        );
        let actions: Vec<_> = default_bindings()
            .iter()
            .map(|binding| binding.action)
            .collect();
        for action in &actions {
            let hits = actions.iter().filter(|other| *other == action).count();
            assert_eq!(hits, 1, "action {action:?} is bound more than once");
        }
    }

    #[test]
    fn an_unknown_key_does_nothing() {
        assert_eq!(
            run(
                ShortcutContext::ready(),
                KeyChord::new(Key::from_name("F12"), Modifiers::default())
            ),
            ShortcutOutcome::Ignored {
                reason: RejectReason::Unknown
            }
        );
        assert_eq!(Key::from_name("F12"), Key::Other);
    }

    #[test]
    fn modifiers_are_distinguishable() {
        assert_eq!(
            run(
                ShortcutContext::ready(),
                KeyChord::new(Key::K, Modifiers::default())
            ),
            ShortcutOutcome::Ignored {
                reason: RejectReason::Unknown
            },
            "plain K must not open the palette"
        );
        assert_eq!(
            run(
                ShortcutContext::ready(),
                KeyChord::new(
                    Key::F11,
                    Modifiers {
                        shift: true,
                        ..Modifiers::default()
                    }
                )
            ),
            ShortcutOutcome::Ignored {
                reason: RejectReason::Unknown
            },
            "Shift+F11 is a different chord"
        );
        assert_eq!(
            run(
                ShortcutContext::ready(),
                KeyChord::new(Key::L, Modifiers::control())
            ),
            ShortcutOutcome::Action {
                action: AppAction::LockSession
            }
        );
    }

    #[test]
    fn a_repeated_key_never_retriggers() {
        let chord = KeyChord::new(Key::F11, Modifiers::default());
        assert_eq!(
            resolve(ShortcutContext::ready(), &default_bindings(), chord, true),
            ShortcutOutcome::Ignored {
                reason: RejectReason::Repeat
            }
        );
        assert_eq!(
            resolve(ShortcutContext::ready(), &default_bindings(), chord, false),
            ShortcutOutcome::Action {
                action: AppAction::ToggleFullscreen
            }
        );
    }

    #[test]
    fn a_locked_context_only_lets_dismiss_through() {
        assert_eq!(
            run(
                ShortcutContext::locked(),
                KeyChord::new(Key::F11, Modifiers::default())
            ),
            ShortcutOutcome::Ignored {
                reason: RejectReason::Locked
            }
        );
        assert_eq!(
            run(
                ShortcutContext::locked(),
                KeyChord::new(Key::K, Modifiers::control())
            ),
            ShortcutOutcome::Ignored {
                reason: RejectReason::Locked
            }
        );
        assert_eq!(
            run(
                ShortcutContext::locked(),
                KeyChord::new(Key::Escape, Modifiers::default())
            ),
            ShortcutOutcome::Action {
                action: AppAction::Dismiss
            }
        );
        assert!(AppAction::Dismiss.allowed_when_locked());
        assert!(!AppAction::ToggleFullscreen.allowed_when_locked());
    }

    #[test]
    fn markers_name_the_chord_and_the_decision() {
        assert_eq!(
            marker(
                KeyChord::new(Key::K, Modifiers::control()),
                ShortcutOutcome::Action {
                    action: AppAction::OpenCommandPalette
                }
            ),
            "SOCDOF_SHORTCUT chord=Ctrl+K action=open_command_palette"
        );
        assert_eq!(
            marker(
                KeyChord::new(Key::Other, Modifiers::default()),
                ShortcutOutcome::Ignored {
                    reason: RejectReason::Unknown
                }
            ),
            "SOCDOF_SHORTCUT chord=other action=none reason=unknown"
        );
    }
}
