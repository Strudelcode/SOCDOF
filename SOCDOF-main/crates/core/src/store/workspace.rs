//! Desktop workspace persistence: widgets and generated reports.

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde_json::Value;
use uuid::Uuid;

use crate::domain::workspace::{Report, Widget, WidgetKind};
use crate::error::{CoreError, CoreResult};

const WIDGET_COLUMNS: &str = "id, kind, title, config, position, enabled, created_at, updated_at";
const REPORT_COLUMNS: &str = "id, kind, title, parameters, generated_at";

/// Inserts a desktop widget.
pub fn insert_widget(conn: &Connection, widget: &Widget) -> CoreResult<()> {
    widget.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO widgets (id, kind, title, config, position, enabled, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            widget.id.to_string(),
            widget.kind.as_str(),
            widget.title,
            serde_json::to_string(&widget.config)?,
            widget.position,
            widget.enabled,
            widget.created_at,
            widget.updated_at,
        ],
    )?;

    Ok(())
}

/// Replaces the stored values of an existing widget.
pub fn update_widget(conn: &Connection, widget: &Widget) -> CoreResult<()> {
    widget.validate().map_err(CoreError::Validation)?;

    let changed = conn.execute(
        "UPDATE widgets SET kind = ?2, title = ?3, config = ?4, position = ?5, enabled = ?6,
            updated_at = ?7
         WHERE id = ?1",
        params![
            widget.id.to_string(),
            widget.kind.as_str(),
            widget.title,
            serde_json::to_string(&widget.config)?,
            widget.position,
            widget.enabled,
            widget.updated_at,
        ],
    )?;

    if changed == 0 {
        return Err(CoreError::NotFound(widget.id.to_string()));
    }

    Ok(())
}

/// Loads all widgets in desktop order.
pub fn list_widgets(conn: &Connection) -> CoreResult<Vec<Widget>> {
    let sql = format!("SELECT {WIDGET_COLUMNS} FROM widgets ORDER BY position, created_at");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_widget)?;

    let mut widgets = Vec::new();
    for row in rows {
        widgets.push(row?);
    }
    Ok(widgets)
}

/// Loads one widget.
pub fn find_widget(conn: &Connection, id: Uuid) -> CoreResult<Option<Widget>> {
    let sql = format!("SELECT {WIDGET_COLUMNS} FROM widgets WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_widget)
        .optional()?)
}

/// Removes a widget.
pub fn delete_widget(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute("DELETE FROM widgets WHERE id = ?1", params![id.to_string()])?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Stores a generated report.
pub fn insert_report(conn: &Connection, report: &Report) -> CoreResult<()> {
    report.validate().map_err(CoreError::Validation)?;

    conn.execute(
        "INSERT INTO reports (id, kind, title, parameters, generated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            report.id.to_string(),
            report.kind,
            report.title,
            serde_json::to_string(&report.parameters)?,
            report.generated_at,
        ],
    )?;

    Ok(())
}

/// Loads all reports, newest first.
pub fn list_reports(conn: &Connection) -> CoreResult<Vec<Report>> {
    let sql = format!("SELECT {REPORT_COLUMNS} FROM reports ORDER BY generated_at DESC");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], map_report)?;

    let mut reports = Vec::new();
    for row in rows {
        reports.push(row?);
    }
    Ok(reports)
}

/// Loads one report.
pub fn find_report(conn: &Connection, id: Uuid) -> CoreResult<Option<Report>> {
    let sql = format!("SELECT {REPORT_COLUMNS} FROM reports WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], map_report)
        .optional()?)
}

fn map_widget(row: &Row<'_>) -> rusqlite::Result<Widget> {
    let id_text: String = row.get("id")?;
    let kind_text: String = row.get("kind")?;
    let config_text: String = row.get("config")?;

    Ok(Widget {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        kind: WidgetKind::from_storage(&kind_text).unwrap_or(WidgetKind::Custom),
        title: row.get("title")?,
        config: serde_json::from_str(&config_text).unwrap_or(Value::Null),
        position: row.get("position")?,
        enabled: row.get("enabled")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_report(row: &Row<'_>) -> rusqlite::Result<Report> {
    let id_text: String = row.get("id")?;
    let parameters_text: String = row.get("parameters")?;

    Ok(Report {
        id: Uuid::parse_str(&id_text).map_err(|_| rusqlite::Error::InvalidQuery)?,
        kind: row.get("kind")?,
        title: row.get("title")?,
        parameters: serde_json::from_str(&parameters_text).unwrap_or(Value::Null),
        generated_at: row.get("generated_at")?,
    })
}
