//! Project portfolio and Kanban task persistence.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::project::{Project, ProjectTask};
use crate::error::{CoreError, CoreResult};

const PROJECT_COLUMNS: &str = "id, title, code, description, contact_id, client_name, category, \
    status, priority, budget_cents, hourly_rate_cents, start_date, deadline, color, created_at, \
    updated_at";
const TASK_COLUMNS: &str = "id, project_id, title, description, status, priority, assignee, \
    estimated_hours_milli, logged_hours_milli, due_date, billable, created_at";

fn project_from_row(row: &Row<'_>) -> rusqlite::Result<Project> {
    Ok(Project {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        title: row.get(1)?,
        code: row.get(2)?,
        description: row.get(3)?,
        contact_id: row
            .get::<_, Option<String>>(4)?
            .and_then(|value| Uuid::parse_str(&value).ok()),
        client_name: row.get(5)?,
        category: row.get(6)?,
        status: row.get(7)?,
        priority: row.get(8)?,
        budget_cents: row.get(9)?,
        hourly_rate_cents: row.get(10)?,
        start_date: row.get(11)?,
        deadline: row.get(12)?,
        color: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

fn task_from_row(row: &Row<'_>) -> rusqlite::Result<ProjectTask> {
    Ok(ProjectTask {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        project_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or(Uuid::nil()),
        title: row.get(2)?,
        description: row.get(3)?,
        status: row.get(4)?,
        priority: row.get(5)?,
        assignee: row.get(6)?,
        estimated_hours_milli: row.get(7)?,
        logged_hours_milli: row.get(8)?,
        due_date: row.get(9)?,
        billable: row.get(10)?,
        created_at: row.get(11)?,
    })
}

/// Lists all projects, newest first like the TypeScript array.
pub fn list_projects(conn: &Connection) -> CoreResult<Vec<Project>> {
    let sql =
        format!("SELECT {PROJECT_COLUMNS} FROM projects ORDER BY created_at DESC, rowid DESC");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], project_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Loads one project.
pub fn find_project(conn: &Connection, id: Uuid) -> CoreResult<Option<Project>> {
    let sql = format!("SELECT {PROJECT_COLUMNS} FROM projects WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], project_from_row)
        .optional()?)
}

/// Inserts a project.
pub fn insert_project(conn: &Connection, project: &Project) -> CoreResult<()> {
    project.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO projects (id, title, code, description, contact_id, client_name, category,
            status, priority, budget_cents, hourly_rate_cents, start_date, deadline, color,
            created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            project.id.to_string(),
            project.title,
            project.code,
            project.description,
            project.contact_id.map(|id| id.to_string()),
            project.client_name,
            project.category,
            project.status,
            project.priority,
            project.budget_cents,
            project.hourly_rate_cents,
            project.start_date,
            project.deadline,
            project.color,
            project.created_at,
            project.updated_at,
        ],
    )?;
    Ok(())
}

/// Replaces a project without touching its tasks.
pub fn update_project(conn: &Connection, project: &Project) -> CoreResult<()> {
    project.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE projects SET title = ?2, code = ?3, description = ?4, contact_id = ?5,
            client_name = ?6, category = ?7, status = ?8, priority = ?9, budget_cents = ?10,
            hourly_rate_cents = ?11, start_date = ?12, deadline = ?13, color = ?14,
            updated_at = ?15 WHERE id = ?1",
        params![
            project.id.to_string(),
            project.title,
            project.code,
            project.description,
            project.contact_id.map(|id| id.to_string()),
            project.client_name,
            project.category,
            project.status,
            project.priority,
            project.budget_cents,
            project.hourly_rate_cents,
            project.start_date,
            project.deadline,
            project.color,
            project.updated_at,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(project.id.to_string()));
    }
    Ok(())
}

/// Deletes a project together with all of its tasks.
pub fn delete_project(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let transaction = conn.unchecked_transaction()?;
    transaction.execute(
        "DELETE FROM project_tasks WHERE project_id = ?1",
        params![id.to_string()],
    )?;
    let changed = transaction.execute(
        "DELETE FROM projects WHERE id = ?1",
        params![id.to_string()],
    )?;
    transaction.commit()?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Lists all tasks of one project in creation order.
pub fn list_tasks(conn: &Connection, project_id: Uuid) -> CoreResult<Vec<ProjectTask>> {
    let sql = format!(
        "SELECT {TASK_COLUMNS} FROM project_tasks WHERE project_id = ?1
         ORDER BY created_at, rowid"
    );
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map(params![project_id.to_string()], task_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Lists every task, oldest first, for the aggregated views.
pub fn list_all_tasks(conn: &Connection) -> CoreResult<Vec<ProjectTask>> {
    let sql = format!("SELECT {TASK_COLUMNS} FROM project_tasks ORDER BY created_at, rowid");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], task_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Loads one task.
pub fn find_task(conn: &Connection, id: Uuid) -> CoreResult<Option<ProjectTask>> {
    let sql = format!("SELECT {TASK_COLUMNS} FROM project_tasks WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], task_from_row)
        .optional()?)
}

/// Inserts a task.
pub fn insert_task(conn: &Connection, task: &ProjectTask) -> CoreResult<()> {
    task.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO project_tasks (id, project_id, title, description, status, priority, assignee,
            estimated_hours_milli, logged_hours_milli, due_date, billable, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            task.id.to_string(),
            task.project_id.to_string(),
            task.title,
            task.description,
            task.status,
            task.priority,
            task.assignee,
            task.estimated_hours_milli,
            task.logged_hours_milli,
            task.due_date,
            i64::from(task.billable),
            task.created_at,
        ],
    )?;
    Ok(())
}

/// Replaces a task.
pub fn update_task(conn: &Connection, task: &ProjectTask) -> CoreResult<()> {
    task.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE project_tasks SET project_id = ?2, title = ?3, description = ?4, status = ?5,
            priority = ?6, assignee = ?7, estimated_hours_milli = ?8, logged_hours_milli = ?9,
            due_date = ?10, billable = ?11 WHERE id = ?1",
        params![
            task.id.to_string(),
            task.project_id.to_string(),
            task.title,
            task.description,
            task.status,
            task.priority,
            task.assignee,
            task.estimated_hours_milli,
            task.logged_hours_milli,
            task.due_date,
            i64::from(task.billable),
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(task.id.to_string()));
    }
    Ok(())
}

/// Changes only the status of a task, as the Kanban quick actions do.
pub fn set_task_status(
    conn: &Connection,
    project_id: Uuid,
    task_id: Uuid,
    status: &str,
) -> CoreResult<()> {
    if !matches!(status, "todo" | "in_progress" | "review" | "done") {
        return Err(CoreError::Validation(format!(
            "Unbekannter Aufgabenstatus: {status}"
        )));
    }
    let changed = conn.execute(
        "UPDATE project_tasks SET status = ?3 WHERE id = ?1 AND project_id = ?2",
        params![task_id.to_string(), project_id.to_string(), status],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(task_id.to_string()));
    }
    Ok(())
}

/// Deletes one task of a project.
pub fn delete_task(conn: &Connection, project_id: Uuid, task_id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM project_tasks WHERE id = ?1 AND project_id = ?2",
        params![task_id.to_string(), project_id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(task_id.to_string()));
    }
    Ok(())
}
