//! Login sessions and the account lockout policy.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::user::User;

/// Default lifetime of a session token: twelve hours.
pub const SESSION_TTL_MS: i64 = 12 * 60 * 60 * 1000;

/// Failed sign-ins allowed before the account is locked.
pub const MAX_FAILED_ATTEMPTS: i64 = 5;

/// Duration of a lockout after too many failed sign-ins: five minutes.
pub const LOCKOUT_MS: i64 = 5 * 60 * 1000;

/// A signed-in session. Only the hash of the token is stored, never the token itself.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Session {
    /// Stable identifier.
    pub id: Uuid,
    /// Signed-in account.
    pub user_id: Uuid,
    /// SHA-256 of the session token, hex encoded.
    pub token_hash: String,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Expiry time in milliseconds since the Unix epoch.
    pub expires_at: i64,
    /// Last request that used the token, in milliseconds since the Unix epoch.
    pub last_seen_at: i64,
    /// Revocation time, set when the user signs out.
    pub revoked_at: Option<i64>,
}

impl Session {
    /// Whether the session can still be used at `now`.
    pub fn is_active(&self, now: i64) -> bool {
        self.revoked_at.is_none() && self.expires_at > now
    }
}

/// Result of a sign-in attempt.
#[derive(Debug, Clone)]
pub enum LoginOutcome {
    /// Credentials were valid, a session was created.
    Success {
        /// The authenticated account. Boxed to keep the enum small; it is moved into the UI state
        /// right after a successful sign-in.
        user: Box<User>,
        /// The created session.
        session: Session,
        /// Plain session token, returned to the caller once and never stored.
        token: String,
    },
    /// Unknown account, inactive account or wrong password.
    Invalid,
    /// The account is locked until the given time.
    Locked {
        /// End of the lockout in milliseconds since the Unix epoch.
        until: i64,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sessions_expire_and_revoke() {
        let session = Session {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            token_hash: "hash".to_string(),
            created_at: 1_000,
            expires_at: 2_000,
            last_seen_at: 1_000,
            revoked_at: None,
        };
        assert!(session.is_active(1_999));
        assert!(!session.is_active(2_000));

        let revoked = Session {
            revoked_at: Some(1_500),
            ..session
        };
        assert!(!revoked.is_active(1_600));
    }

    #[test]
    fn lockout_policy_is_five_attempts_for_five_minutes() {
        assert_eq!(MAX_FAILED_ATTEMPTS, 5);
        assert_eq!(LOCKOUT_MS, 300_000);
        assert_eq!(SESSION_TTL_MS, 43_200_000);
    }
}
