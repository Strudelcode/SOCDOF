//! User persistence and credential checks.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::user::{User, UserRole};
use crate::error::{CoreError, CoreResult};
use crate::now_millis;
use crate::security::verify_password;

const COLUMNS: &str = "id, username, display_name, role, role_id, active, password_hash, \
                       must_change_password, created_at, updated_at";

/// Inserts a user. The password must already be hashed by [`crate::security::hash_password`].
pub fn insert(conn: &Connection, user: &User) -> CoreResult<()> {
    user.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO users (id, username, display_name, role, role_id, active, password_hash,
            must_change_password, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            user.id.to_string(),
            user.username.trim(),
            user.display_name.trim(),
            user.role.as_str(),
            user.role_id,
            user.active,
            user.password_hash,
            user.must_change_password,
            user.created_at,
            user.updated_at,
        ],
    )?;

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

/// Stores a new password hash and clears the "must change password" flag.
pub fn set_password(conn: &Connection, id: Uuid, password_hash: &str) -> CoreResult<()> {
    let changed = conn.execute(
        "UPDATE users SET password_hash = ?2, must_change_password = 0, updated_at = ?3
         WHERE id = ?1",
        params![id.to_string(), password_hash, now_millis()],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }

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
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
