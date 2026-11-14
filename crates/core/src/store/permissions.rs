//! Role persistence and permission resolution for a user.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::permission::{AppModule, PermissionLevel, Role};
use crate::domain::user::User;
use crate::error::{CoreError, CoreResult};
use crate::now_millis;

const COLUMNS: &str = "id, name, description, is_builtin, permissions, created_at, updated_at";

/// Inserts a custom role.
pub fn insert(conn: &Connection, role: &Role) -> CoreResult<()> {
    role.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO roles (id, name, description, is_builtin, permissions, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            role.id.to_string(),
            role.name,
            role.description,
            role.is_builtin,
            serde_json::to_string(&role.permissions)?,
            role.created_at,
            role.updated_at,
        ],
    )?;

    Ok(())
}

/// Replaces name, description and grants of an existing role.
pub fn update(conn: &Connection, role: &Role) -> CoreResult<()> {
    role.validate().map_err(CoreError::Validation)?;

    let transaction = conn.unchecked_transaction()?;
    let changed = transaction.execute(
        "UPDATE roles SET name = ?2, description = ?3, permissions = ?4, updated_at = ?5
         WHERE id = ?1",
        params![
            role.id.to_string(),
            role.name,
            role.description,
            serde_json::to_string(&role.permissions)?,
            role.updated_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(role.id.to_string()));
    }

    // Existing sessions must not retain a cached permission set after a role is edited.
    let user_filter = if role.id == USER_ROLE_ID {
        "role_id = ?1 OR (role_id IS NULL AND role = 'user')"
    } else if role.id == ADMIN_ROLE_ID {
        "role_id = ?1 OR (role_id IS NULL AND role = 'admin')"
    } else {
        "role_id = ?1"
    };
    let revoke_sql = format!(
        "UPDATE auth_sessions SET revoked_at = ?2
         WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE {user_filter})"
    );
    transaction.execute(&revoke_sql, params![role.id.to_string(), now_millis()])?;

    transaction.commit()?;
    Ok(())
}

/// Loads one role.
pub fn find(conn: &Connection, id: Uuid) -> CoreResult<Option<Role>> {
    let sql = format!("SELECT {COLUMNS} FROM roles WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_row)
        .optional()?)
}

/// Loads all roles, built-ins first.
pub fn list(conn: &Connection) -> CoreResult<Vec<Role>> {
    let sql = format!("SELECT {COLUMNS} FROM roles ORDER BY is_builtin DESC, lower(name)");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_row)?;

    let mut roles = Vec::new();
    for row in rows {
        roles.push(row?);
    }
    Ok(roles)
}

/// Removes a custom role. Built-in roles are protected.
pub fn delete(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let builtin: Option<bool> = conn
        .query_row(
            "SELECT is_builtin FROM roles WHERE id = ?1",
            params![id.to_string()],
            |row| row.get(0),
        )
        .optional()?;

    match builtin {
        None => Err(CoreError::NotFound(id.to_string())),
        Some(true) => Err(CoreError::Validation("role_builtin".to_string())),
        Some(false) => {
            let transaction = conn.unchecked_transaction()?;
            transaction.execute(
                "UPDATE auth_sessions SET revoked_at = ?2
                 WHERE revoked_at IS NULL AND user_id IN
                    (SELECT id FROM users WHERE role_id = ?1)",
                params![id.to_string(), now_millis()],
            )?;
            // Preserve the account as a standard user when its custom role is removed.
            transaction.execute(
                "UPDATE users SET role_id = NULL, updated_at = ?2 WHERE role_id = ?1",
                params![id.to_string(), now_millis()],
            )?;
            transaction.execute("DELETE FROM roles WHERE id = ?1", params![id.to_string()])?;
            transaction.commit()?;
            Ok(())
        }
    }
}

/// Writes both built-in roles if they are missing. Safe to call on every start.
pub fn seed_builtin(conn: &Connection, now: i64) -> CoreResult<()> {
    for defaults in [Role::administrator(now), Role::standard_user(now)] {
        if let Some(mut existing) = find(conn, defaults.id)? {
            // New modules are appended to the permission matrix over time. Bring built-in roles
            // forward without resetting grants that an older installation already stored.
            let mut changed = false;
            for grant in defaults.permissions {
                if !existing
                    .permissions
                    .iter()
                    .any(|current| current.module == grant.module)
                {
                    existing.permissions.push(grant);
                    changed = true;
                }
            }
            if changed {
                existing.updated_at = now;
                update(conn, &existing)?;
            }
        } else {
            conn.execute(
                "INSERT INTO roles (id, name, description, is_builtin, permissions, created_at,
                    updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    defaults.id.to_string(),
                    defaults.name,
                    defaults.description,
                    defaults.is_builtin,
                    serde_json::to_string(&defaults.permissions)?,
                    defaults.created_at,
                    defaults.updated_at,
                ],
            )?;
        }
    }
    Ok(())
}

/// The role that applies to a user.
///
/// A custom role reference wins; otherwise the built-in administrator or standard role is used.
/// The result is always a usable role, so the UI never has to handle "no role".
pub fn role_for_user(conn: &Connection, user: &User) -> CoreResult<Role> {
    if let Some(role_id) = user.role_id.as_deref() {
        if let Ok(id) = Uuid::parse_str(role_id) {
            if let Some(role) = find(conn, id)? {
                return Ok(role);
            }
        }
    }

    Ok(if user.is_admin() {
        Role::administrator(now_millis())
    } else {
        Role::standard_user(now_millis())
    })
}

/// Whether a user may perform `required` on `module`.
///
/// Administrators always pass, which keeps a broken role assignment from locking them out.
pub fn user_allows(
    conn: &Connection,
    user: &User,
    module: AppModule,
    required: PermissionLevel,
) -> CoreResult<bool> {
    if user.is_admin() {
        return Ok(true);
    }
    Ok(role_for_user(conn, user)?.allows(module, required))
}

fn map_row(row: &Row<'_>) -> rusqlite::Result<Role> {
    let id_text: String = row.get("id")?;
    let permissions_text: String = row.get("permissions")?;

    Ok(Role {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        name: row.get("name")?,
        description: row.get("description")?,
        is_builtin: row.get("is_builtin")?,
        permissions: serde_json::from_str(&permissions_text).unwrap_or_default(),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
