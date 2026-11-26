//! User persistence and credential checks.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::user::{User, UserRole};
use crate::error::{CoreError, CoreResult};
use crate::now_millis;
use crate::security::verify_password;

const COLUMNS: &str = "id, username, display_name, role, role_id, active, password_hash, \
                       must_change_password, passwordless, created_at, updated_at";

/// Inserts a user. The password must already be hashed by [`crate::security::hash_password`].
pub fn insert(conn: &Connection, user: &User) -> CoreResult<()> {
    user.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO users (id, username, display_name, role, role_id, active, password_hash,
            must_change_password, passwordless, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            user.id.to_string(),
            user.username.trim(),
            user.display_name.trim(),
            user.role.as_str(),
            user.role_id,
            user.active,
            user.password_hash,
            user.must_change_password,
            user.passwordless,
            user.created_at,
            user.updated_at,
        ],
    )?;

    Ok(())
}

/// Creates the first administrator only while the database is still empty.
/// The count check and insert share one write transaction, preventing parallel first-run setup.
pub fn insert_first_admin(conn: &Connection, user: &User) -> CoreResult<()> {
    user.validate().map_err(CoreError::Validation)?;
    if user.role != UserRole::Admin || !user.active {
        return Err(CoreError::Validation("first_admin_required".to_string()));
    }

    let transaction = conn.unchecked_transaction()?;
    let count: i64 = transaction.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if count != 0 {
        return Err(CoreError::Validation("setup_already_completed".to_string()));
    }
    insert(&transaction, user)?;
    transaction.commit()?;
    Ok(())
}

/// Finds a user by login name. The comparison ignores case.
pub fn find_by_username(conn: &Connection, username: &str) -> CoreResult<Option<User>> {
    let sql = format!("SELECT {COLUMNS} FROM users WHERE username = ?1");
    Ok(conn
        .query_row(&sql, params![username.trim()], map_row)
        .optional()?)
}

/// Loads one user by identifier.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<User>> {
    let sql = format!("SELECT {COLUMNS} FROM users WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?)
}

/// Loads all users ordered by display name.
pub fn list(conn: &Connection) -> CoreResult<Vec<User>> {
    let sql = format!("SELECT {COLUMNS} FROM users ORDER BY lower(display_name)");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_row)?;

    let mut users = Vec::new();
    for row in rows {
        users.push(row?);
    }
    Ok(users)
}

/// Checks the credentials. Returns `None` for unknown, inactive or wrong-password accounts, so the
/// caller cannot distinguish those cases.
pub fn authenticate(conn: &Connection, username: &str, password: &str) -> CoreResult<Option<User>> {
    let Some(user) = find_by_username(conn, username)? else {
        return Ok(None);
    };

    if !user.active || !verify_password(password, &user.password_hash) {
        return Ok(None);
    }

    Ok(Some(user))
}

/// Replaces the editable fields of an existing user.
///
/// The password hash is not changed here; use [`set_password`] for that. The last administrator
/// cannot be demoted or deactivated, so a broken role assignment cannot lock everybody out.
pub fn update(conn: &Connection, user: &User) -> CoreResult<()> {
    update_internal(conn, user, None)
}

/// Updates a user's own password while keeping the session used to authorize the change.
///
/// Every other session is revoked so a password change cannot leave older devices signed in.
pub fn update_preserving_session(
    conn: &Connection,
    user: &User,
    session_id: Uuid,
    now: i64,
) -> CoreResult<()> {
    update_internal(conn, user, Some((session_id, now)))
}

fn update_internal(
    conn: &Connection,
    user: &User,
    preserved_session: Option<(Uuid, i64)>,
) -> CoreResult<()> {
    user.validate().map_err(CoreError::Validation)?;

    let existing: Option<(String, Option<String>, bool, String, String)> = conn
        .query_row(
            "SELECT role, role_id, active, username, password_hash FROM users WHERE id = ?1",
            params![user.id.to_string()],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .optional()?;
    let Some((role, role_id, active, username, password_hash)) = existing else {
        return Err(CoreError::NotFound(user.id.to_string()));
    };

    let was_admin = role == "admin" && active;
    let remains_admin = user.role == UserRole::Admin && user.active;
    if was_admin && !remains_admin && admin_count(conn)? <= 1 {
        return Err(CoreError::Validation("last_admin".to_string()));
    }

    let transaction = conn.unchecked_transaction()?;
    let changed = transaction.execute(
        "UPDATE users SET username = ?2, display_name = ?3, role = ?4, role_id = ?5,
            active = ?6, must_change_password = ?7, password_hash = ?8, passwordless = ?9,
            updated_at = ?10
         WHERE id = ?1",
        params![
            user.id.to_string(),
            user.username.trim(),
            user.display_name.trim(),
            user.role.as_str(),
            user.role_id,
            user.active,
            user.must_change_password,
            user.password_hash,
            user.passwordless,
            user.updated_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(user.id.to_string()));
    }

    // Sessions retain the permissions and identity from sign-in time. Revoke them whenever
    // account access changes. A self-service password change may retain only its authorizing
    // session; every other session is still revoked atomically with the account update.
    if role != user.role.as_str()
        || role_id != user.role_id
        || active != user.active
        || username != user.username.trim()
        || password_hash != user.password_hash
    {
        if let Some((session_id, now)) = preserved_session {
            transaction.execute(
                "UPDATE auth_sessions SET revoked_at = ?2
                 WHERE user_id = ?1 AND id <> ?3 AND revoked_at IS NULL",
                params![user.id.to_string(), now, session_id.to_string()],
            )?;
        } else {
            transaction.execute(
                "UPDATE auth_sessions SET revoked_at = ?2
                 WHERE user_id = ?1 AND revoked_at IS NULL",
                params![user.id.to_string(), now_millis()],
            )?;
        }
    }

    transaction.commit()?;
    Ok(())
}

/// Deletes an account. The last administrator is protected.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let role: Option<String> = conn
        .query_row(
            "SELECT role FROM users WHERE id = ?1",
            params![id.to_string()],
            |row| row.get(0),
        )
        .optional()?;

    let Some(role) = role else {
        return Err(CoreError::NotFound(id.to_string()));
    };

    if role == "admin" && admin_count(conn)? <= 1 {
        return Err(CoreError::Validation("last_admin".to_string()));
    }

    let transaction = conn.unchecked_transaction()?;
    transaction.execute(
        "UPDATE auth_sessions SET revoked_at = ?2
         WHERE user_id = ?1 AND revoked_at IS NULL",
        params![id.to_string(), now_millis()],
    )?;
    transaction.execute("DELETE FROM users WHERE id = ?1", params![id.to_string()])?;
    transaction.commit()?;
    Ok(())
}

fn admin_count(conn: &Connection) -> CoreResult<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'admin'",
        [],
        |row| row.get(0),
    )?)
}

/// Stores a new password hash and clears the "must change password" flag.
pub fn set_password(conn: &Connection, id: Uuid, password_hash: &str) -> CoreResult<()> {
    let transaction = conn.unchecked_transaction()?;
    let now = now_millis();
    let changed = transaction.execute(
        "UPDATE users SET password_hash = ?2, must_change_password = 0, updated_at = ?3
         WHERE id = ?1",
        params![id.to_string(), password_hash, now],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }

    // A password reset invalidates every previously issued credential for this account.
    transaction.execute(
        "UPDATE auth_sessions SET revoked_at = ?2
         WHERE user_id = ?1 AND revoked_at IS NULL",
        params![id.to_string(), now],
    )?;
    transaction.commit()?;
    Ok(())
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<User> {
    let id_text: String = row.get("id")?;
    let role_text: String = row.get("role")?;

    Ok(User {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        username: row.get("username")?,
        display_name: row.get("display_name")?,
        role: UserRole::from_storage(&role_text).unwrap_or(UserRole::User),
        role_id: row.get("role_id")?,
        active: row.get("active")?,
        password_hash: row.get("password_hash")?,
        must_change_password: row.get("must_change_password")?,
        passwordless: row.get("passwordless")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn access_store() -> Connection {
        let conn = Connection::open_in_memory().expect("database");
        conn.execute_batch(
            "CREATE TABLE users (
                id TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT NOT NULL,
                role TEXT NOT NULL, role_id TEXT, active INTEGER NOT NULL,
                password_hash TEXT NOT NULL, must_change_password INTEGER NOT NULL,
                passwordless INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
            );
            CREATE TABLE auth_sessions (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
                last_seen_at INTEGER NOT NULL, revoked_at INTEGER
            );",
        )
        .expect("schema");
        conn
    }

    fn admin(id: Uuid) -> User {
        User {
            id,
            username: "admin".to_string(),
            display_name: "Administrator".to_string(),
            role: UserRole::Admin,
            role_id: None,
            active: true,
            password_hash: "hash".to_string(),
            must_change_password: false,
            passwordless: false,
            created_at: 1,
            updated_at: 1,
        }
    }

    fn add_session(conn: &Connection, user_id: Uuid) -> Uuid {
        let session_id = Uuid::new_v4();
        conn.execute(
            "INSERT INTO auth_sessions
             (id, user_id, token_hash, created_at, expires_at, last_seen_at, revoked_at)
             VALUES (?1, ?2, 'token-hash', 1, 999999999, 1, NULL)",
            params![session_id.to_string(), user_id.to_string()],
        )
        .expect("session");
        session_id
    }

    fn active_sessions(conn: &Connection, user_id: Uuid) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM auth_sessions WHERE user_id = ?1 AND revoked_at IS NULL",
            params![user_id.to_string()],
            |row| row.get(0),
        )
        .expect("session count")
    }

    #[test]
    fn changing_account_access_revokes_existing_sessions_atomically() {
        let conn = access_store();
        let id = Uuid::new_v4();
        let user = admin(id);
        insert(&conn, &user).expect("insert user");
        add_session(&conn, id);

        let mut disabled = user;
        disabled.active = false;
        disabled.updated_at = 2;
        assert!(
            update(&conn, &disabled).is_err(),
            "last admin must stay protected"
        );
        assert_eq!(active_sessions(&conn, id), 1);

        let mut second = admin(Uuid::new_v4());
        second.username = "admin2".to_string();
        second.display_name = "Second administrator".to_string();
        insert(&conn, &second).expect("insert second admin");
        update(&conn, &disabled).expect("disable account");
        assert_eq!(active_sessions(&conn, id), 0);
    }

    #[test]
    fn updating_password_hash_and_account_revokes_sessions_in_one_transaction() {
        let conn = access_store();
        let id = Uuid::new_v4();
        let user = admin(id);
        insert(&conn, &user).expect("insert user");
        add_session(&conn, id);

        let mut changed = user;
        changed.password_hash = "replacement-hash".to_string();
        changed.username = "new-admin".to_string();
        changed.updated_at = 2;
        update(&conn, &changed).expect("update user and password");
        assert_eq!(active_sessions(&conn, id), 0);
        let stored: String = conn
            .query_row(
                "SELECT password_hash FROM users WHERE id = ?1",
                params![id.to_string()],
                |row| row.get(0),
            )
            .expect("stored password hash");
        assert_eq!(stored, "replacement-hash");
    }

    #[test]
    fn self_service_password_change_preserves_only_the_authorizing_session() {
        let conn = access_store();
        let id = Uuid::new_v4();
        let user = admin(id);
        insert(&conn, &user).expect("insert user");
        let current_session = add_session(&conn, id);
        let other_session = add_session(&conn, id);

        let mut changed = user;
        changed.password_hash = "replacement-hash".to_string();
        changed.must_change_password = false;
        changed.updated_at = 2;
        update_preserving_session(&conn, &changed, current_session, 2)
            .expect("self-service password change");

        assert_eq!(active_sessions(&conn, id), 1);
        let current_revoked: Option<i64> = conn
            .query_row(
                "SELECT revoked_at FROM auth_sessions WHERE id = ?1",
                params![current_session.to_string()],
                |row| row.get(0),
            )
            .expect("current session");
        let other_revoked: Option<i64> = conn
            .query_row(
                "SELECT revoked_at FROM auth_sessions WHERE id = ?1",
                params![other_session.to_string()],
                |row| row.get(0),
            )
            .expect("other session");
        assert_eq!(current_revoked, None);
        assert_eq!(other_revoked, Some(2));
    }

    #[test]
    fn password_reset_revokes_all_existing_sessions() {
        let conn = access_store();
        let id = Uuid::new_v4();
        insert(&conn, &admin(id)).expect("insert user");
        add_session(&conn, id);

        set_password(&conn, id, "new-password-hash").expect("reset password");

        assert_eq!(active_sessions(&conn, id), 0);
    }

    #[test]
    fn deleting_account_revokes_sessions_before_removal() {
        let conn = access_store();
        let id = Uuid::new_v4();
        insert(&conn, &admin(id)).expect("insert admin");
        let mut second = admin(Uuid::new_v4());
        second.username = "admin2".to_string();
        second.display_name = "Second administrator".to_string();
        insert(&conn, &second).expect("insert second admin");
        add_session(&conn, id);

        delete(&conn, id).expect("delete account");

        assert_eq!(active_sessions(&conn, id), 0);
    }
}

#[cfg(test)]
mod first_admin_tests {
    use super::*;

    #[test]
    fn first_admin_can_only_be_created_once() {
        let conn = Connection::open_in_memory().expect("database");
        conn.execute_batch(
            "CREATE TABLE users (
                id TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT NOT NULL,
                role TEXT NOT NULL, role_id TEXT, active INTEGER NOT NULL,
                password_hash TEXT NOT NULL, must_change_password INTEGER NOT NULL,
                passwordless INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
            );",
        )
        .expect("schema");
        let first = User {
            id: Uuid::new_v4(),
            username: "owner".to_string(),
            display_name: "Owner".to_string(),
            role: UserRole::Admin,
            role_id: None,
            active: true,
            password_hash: "argon-hash".to_string(),
            must_change_password: false,
            passwordless: false,
            created_at: 1,
            updated_at: 1,
        };
        insert_first_admin(&conn, &first).expect("first admin");
        let second = User {
            id: Uuid::new_v4(),
            username: "second".to_string(),
            display_name: "Second".to_string(),
            ..first
        };
        assert!(insert_first_admin(&conn, &second).is_err());
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get::<_, i64>(0))
                .expect("count"),
            1
        );
    }
}
