//! Session persistence and the sign-in path with lockout handling.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::session::{
    LoginOutcome, Session, LOCKOUT_MS, MAX_FAILED_ATTEMPTS, SESSION_TTL_MS,
};
use crate::domain::user::User;
use crate::error::CoreResult;
use crate::security::{hash_token, new_session_token};
use crate::store::users;

const COLUMNS: &str = "id, user_id, token_hash, created_at, expires_at, last_seen_at, revoked_at";

/// Creates a session for a user and returns it together with the plain token.
///
/// Only the SHA-256 hash of the token is stored; the token itself is returned exactly once.
pub fn create(
    conn: &Connection,
    user: &User,
    now: i64,
    ttl_ms: i64,
) -> CoreResult<(Session, String)> {
    let (token, token_hash) = new_session_token();

    let session = Session {
        id: Uuid::new_v4(),
        user_id: user.id,
        token_hash,
        created_at: now,
        expires_at: now + ttl_ms,
        last_seen_at: now,
        revoked_at: None,
    };

    conn.execute(
        "INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at,
            revoked_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)",
        params![
            session.id.to_string(),
            session.user_id.to_string(),
            session.token_hash,
            session.created_at,
            session.expires_at,
            session.last_seen_at,
        ],
    )?;

    Ok((session, token))
}

/// Looks up the active session for a plain token.
pub fn find_active(conn: &Connection, token: &str, now: i64) -> CoreResult<Option<Session>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM auth_sessions WHERE token_hash = ?1 AND revoked_at IS NULL \
         AND expires_at > ?2"
    );
    Ok(conn
        .query_row(&sql, params![hash_token(token), now], map_row)
        .optional()?)
}

/// Records that a session was used.
pub fn touch(conn: &Connection, id: Uuid, now: i64) -> CoreResult<()> {
    conn.execute(
        "UPDATE auth_sessions SET last_seen_at = ?2 WHERE id = ?1",
        params![id.to_string(), now],
    )?;
    Ok(())
}

/// Revokes one session (sign out).
pub fn revoke(conn: &Connection, id: Uuid, now: i64) -> CoreResult<()> {
    conn.execute(
        "UPDATE auth_sessions SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL",
        params![id.to_string(), now],
    )?;
    Ok(())
}

/// Number of active sessions of a user at `now`.
pub fn active_count(conn: &Connection, user_id: Uuid, now: i64) -> CoreResult<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM auth_sessions WHERE user_id = ?1 AND revoked_at IS NULL \
         AND expires_at > ?2",
        params![user_id.to_string(), now],
        |row| row.get(0),
    )?)
}

/// Revokes every active session of a user (sign out everywhere, password change).
pub fn revoke_all_for_user(conn: &Connection, user_id: Uuid, now: i64) -> CoreResult<usize> {
    let changed = conn.execute(
        "UPDATE auth_sessions SET revoked_at = ?2 WHERE user_id = ?1 AND revoked_at IS NULL",
        params![user_id.to_string(), now],
    )?;
    Ok(changed)
}

/// Removes expired and revoked sessions.
pub fn purge_expired(conn: &Connection, now: i64) -> CoreResult<usize> {
    let changed = conn.execute(
        "DELETE FROM auth_sessions WHERE expires_at <= ?1 OR revoked_at IS NOT NULL",
        params![now],
    )?;
    Ok(changed)
}

/// Current lockout end for an account, if the lockout is still running.
pub fn locked_until(conn: &Connection, username: &str, now: i64) -> CoreResult<Option<i64>> {
    let until: Option<i64> = conn
        .query_row(
            "SELECT locked_until FROM auth_attempts WHERE username = ?1",
            params![username.trim()],
            |row| row.get(0),
        )
        .optional()?
        .flatten();

    Ok(until.filter(|until| *until > now))
}

/// Records a failed sign-in and returns the lockout end when the threshold is reached.
pub fn register_failure(conn: &Connection, username: &str, now: i64) -> CoreResult<Option<i64>> {
    conn.execute(
        "INSERT INTO auth_attempts (username, failed_count, locked_until, updated_at)
         VALUES (?1, 1, NULL, ?2)
         ON CONFLICT(username) DO UPDATE SET
            failed_count = auth_attempts.failed_count + 1,
            updated_at = excluded.updated_at",
        params![username.trim(), now],
    )?;

    let failed: i64 = conn.query_row(
        "SELECT failed_count FROM auth_attempts WHERE username = ?1",
        params![username.trim()],
        |row| row.get(0),
    )?;

    if failed >= MAX_FAILED_ATTEMPTS {
        let until = now + LOCKOUT_MS;
        conn.execute(
            "UPDATE auth_attempts SET locked_until = ?2, failed_count = 0 WHERE username = ?1",
            params![username.trim(), until],
        )?;
        return Ok(Some(until));
    }

    Ok(None)
}

/// Clears the counter after a successful sign-in.
pub fn clear_failures(conn: &Connection, username: &str) -> CoreResult<()> {
    conn.execute(
        "DELETE FROM auth_attempts WHERE username = ?1",
        params![username.trim()],
    )?;
    Ok(())
}

/// Signs a user in.
///
/// Locked accounts are rejected before the password is checked, failed attempts are counted and a
/// session is created on success.
pub fn login(
    conn: &Connection,
    username: &str,
    password: &str,
    now: i64,
) -> CoreResult<LoginOutcome> {
    if let Some(until) = locked_until(conn, username, now)? {
        return Ok(LoginOutcome::Locked { until });
    }

    match users::authenticate(conn, username, password)? {
        Some(user) => {
            clear_failures(conn, username)?;
            let (session, token) = create(conn, &user, now, SESSION_TTL_MS)?;
            Ok(LoginOutcome::Success {
                user: Box::new(user),
                session,
                token,
            })
        }
        None => match register_failure(conn, username, now)? {
            Some(until) => Ok(LoginOutcome::Locked { until }),
            None => Ok(LoginOutcome::Invalid),
        },
    }
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Session> {
    let id_text: String = row.get("id")?;
    let user_text: String = row.get("user_id")?;

    Ok(Session {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        user_id: Uuid::parse_str(&user_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        token_hash: row.get("token_hash")?,
        created_at: row.get("created_at")?,
        expires_at: row.get("expires_at")?,
        last_seen_at: row.get("last_seen_at")?,
        revoked_at: row.get("revoked_at")?,
    })
}
