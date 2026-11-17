//! Projects, tasks and the portfolio metrics, ported from `ProjectsModule.tsx`.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Hourly rate the TypeScript module falls back to when a project has none (95 EUR).
pub const DEFAULT_HOURLY_RATE_CENTS: i64 = 9_500;

/// A project of the portfolio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    /// Stable identifier.
    pub id: Uuid,
    /// Display title, required.
    pub title: String,
    /// Short code such as `PRJ-2026-01`.
    pub code: String,
    /// Goal and milestones.
    pub description: String,
    /// Customer contact, `None` for internal projects.
    pub contact_id: Option<Uuid>,
    /// Customer name copied from the contact when the project is saved.
    pub client_name: String,
    /// `client_work`, `internal`, `maintenance`, `development` or `marketing`.
    pub category: String,
    /// `active`, `planning`, `review`, `completed`, `on_hold` or `cancelled`.
    pub status: String,
    /// `low`, `medium` or `high`.
    pub priority: String,
    /// Budget in integer cents.
    pub budget_cents: i64,
    /// Hourly rate in integer cents.
    pub hourly_rate_cents: i64,
    /// Start date (`YYYY-MM-DD`), empty when unknown.
    pub start_date: String,
    /// Deadline (`YYYY-MM-DD`), empty when unknown.
    pub deadline: String,
    /// Accent colour of the project card.
    pub color: String,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl Project {
    /// Trims the text fields and lowercases the enumerations.
    pub fn normalize(&mut self) {
        self.title = self.title.trim().to_string();
        self.code = self.code.trim().to_string();
        self.description = self.description.trim().to_string();
        self.client_name = self.client_name.trim().to_string();
        self.category = self.category.trim().to_lowercase();
        self.status = self.status.trim().to_lowercase();
        self.priority = self.priority.trim().to_lowercase();
        self.start_date = self.start_date.trim().to_string();
        self.deadline = self.deadline.trim().to_string();
        self.color = self.color.trim().to_string();
    }

    /// Validates the fields the TypeScript modal requires and keeps the enumerations closed.
    pub fn validate(&self) -> Result<(), String> {
        if self.title.trim().is_empty() {
            return Err("Projekttitel ist erforderlich".to_string());
        }
        if self.code.trim().is_empty() {
            return Err("Projektcode ist erforderlich".to_string());
        }
        if !matches!(
            self.category.as_str(),
            "client_work" | "internal" | "maintenance" | "development" | "marketing"
        ) {
            return Err(format!("Unbekannte Projektkategorie: {}", self.category));
        }
        if !matches!(
            self.status.as_str(),
            "active" | "planning" | "review" | "completed" | "on_hold" | "cancelled"
        ) {
            return Err(format!("Unbekannter Projektstatus: {}", self.status));
        }
        if !matches!(self.priority.as_str(), "low" | "medium" | "high") {
            return Err(format!("Unbekannte Projektprioritaet: {}", self.priority));
        }
        if self.budget_cents < 0 {
            return Err("Projektbudget darf nicht negativ sein".to_string());
        }
        if self.hourly_rate_cents < 0 {
            return Err("Stundensatz darf nicht negativ sein".to_string());
        }
        if !self.start_date.is_empty() && !is_iso_date(&self.start_date) {
            return Err("Startdatum muss ein gueltiges Datum (YYYY-MM-DD) sein".to_string());
        }
        if !self.deadline.is_empty() && !is_iso_date(&self.deadline) {
            return Err("Deadline muss ein gueltiges Datum (YYYY-MM-DD) sein".to_string());
        }
        Ok(())
    }
}

/// One task of the Kanban board.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTask {
    /// Stable identifier.
    pub id: Uuid,
    /// Project the task belongs to.
    pub project_id: Uuid,
    /// Task title, required.
    pub title: String,
    /// Notes and details.
    pub description: String,
    /// `todo`, `in_progress`, `review` or `done`.
    pub status: String,
    /// `low`, `medium`, `high` or `urgent`.
    pub priority: String,
    /// Person responsible for the task.
    pub assignee: String,
    /// Estimated effort in thousandths of an hour.
    pub estimated_hours_milli: i64,
    /// Logged effort in thousandths of an hour.
    pub logged_hours_milli: i64,
    /// Due date (`YYYY-MM-DD`), empty when unknown.
    pub due_date: String,
    /// Whether the logged time is billed on an invoice.
    pub billable: bool,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

impl ProjectTask {
    /// Trims the text fields and lowercases the enumerations.
    pub fn normalize(&mut self) {
        self.title = self.title.trim().to_string();
        self.description = self.description.trim().to_string();
        self.assignee = self.assignee.trim().to_string();
        self.due_date = self.due_date.trim().to_string();
        self.status = self.status.trim().to_lowercase();
        self.priority = self.priority.trim().to_lowercase();
    }

    /// Validates the fields of the task modal.
    pub fn validate(&self) -> Result<(), String> {
        if self.title.trim().is_empty() {
            return Err("Aufgabentitel ist erforderlich".to_string());
        }
        if !matches!(
            self.status.as_str(),
            "todo" | "in_progress" | "review" | "done"
        ) {
            return Err(format!("Unbekannter Aufgabenstatus: {}", self.status));
        }
        if !matches!(self.priority.as_str(), "low" | "medium" | "high" | "urgent") {
            return Err(format!("Unbekannte Aufgabenprioritaet: {}", self.priority));
        }
        if self.estimated_hours_milli < 0 || self.logged_hours_milli < 0 {
            return Err("Stunden duerfen nicht negativ sein".to_string());
        }
        if !self.due_date.is_empty() && !is_iso_date(&self.due_date) {
            return Err("Faelligkeitsdatum muss ein gueltiges Datum (YYYY-MM-DD) sein".to_string());
        }
        Ok(())
    }

    /// Billable value of this task in cents, rounded to the nearest cent.
    pub fn billable_cents(&self, hourly_rate_cents: i64) -> i64 {
        let rate = if hourly_rate_cents == 0 {
            DEFAULT_HOURLY_RATE_CENTS
        } else {
            hourly_rate_cents
        };
        (self.logged_hours_milli * rate + 500) / 1_000
    }
}

/// Aggregated values of the KPI strip.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetrics {
    /// Projects with status `active`.
    pub active_projects_count: i64,
    /// Sum of all project budgets in cents.
    pub total_budget_cents: i64,
    /// Sum of all logged task hours in thousandths.
    pub total_logged_hours_milli: i64,
    /// Sum of all estimated task hours in thousandths.
    pub total_estimated_hours_milli: i64,
    /// Number of tasks.
    pub total_tasks_count: i64,
    /// Tasks with status `done`.
    pub completed_tasks_count: i64,
    /// Completed share in percent, rounded like the TypeScript KPI.
    pub completion_rate: i64,
    /// Billable value of all billable task hours in cents.
    pub billable_revenue_cents: i64,
}

/// Computes the KPI values exactly like the TypeScript `useMemo` block.
pub fn metrics(projects: &[Project], tasks: &[ProjectTask]) -> ProjectMetrics {
    let mut total_budget_cents = 0;
    let mut total_logged_hours_milli = 0;
    let mut total_estimated_hours_milli = 0;
    let mut total_tasks_count = 0;
    let mut completed_tasks_count = 0;
    let mut billable_revenue_cents = 0;

    for project in projects {
        total_budget_cents += project.budget_cents;
        let rate = if project.hourly_rate_cents == 0 {
            DEFAULT_HOURLY_RATE_CENTS
        } else {
            project.hourly_rate_cents
        };
        for task in tasks.iter().filter(|task| task.project_id == project.id) {
            total_tasks_count += 1;
            total_logged_hours_milli += task.logged_hours_milli;
            total_estimated_hours_milli += task.estimated_hours_milli;
            if task.status == "done" {
                completed_tasks_count += 1;
            }
            if task.billable {
                billable_revenue_cents += task.billable_cents(rate);
            }
        }
    }

    let completion_rate = if total_tasks_count > 0 {
        ((completed_tasks_count as f64 / total_tasks_count as f64) * 100.0).round() as i64
    } else {
        0
    };

    ProjectMetrics {
        active_projects_count: projects
            .iter()
            .filter(|project| project.status == "active")
            .count() as i64,
        total_budget_cents,
        total_logged_hours_milli,
        total_estimated_hours_milli,
        total_tasks_count,
        completed_tasks_count,
        completion_rate,
        billable_revenue_cents,
    }
}

/// Suggested code of a new project, as in the TypeScript modal (`PRJ-YYYY-NN`).
pub fn default_code(year: i64, project_count: usize) -> String {
    format!("PRJ-{year:04}-{:02}", project_count + 1)
}

/// ISO date (`YYYY-MM-DD`) of a Unix timestamp in milliseconds.
pub fn iso_date(ms: i64) -> String {
    let (year, month, day) = crate::date::civil_from_millis(ms);
    format!("{year:04}-{month:02}-{day:02}")
}

/// Escapes one CSV field; the export quotes every field like the Fleet CSV writer.
fn csv_field(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn status_label(status: &str) -> &'static str {
    match status {
        "active" => "In Arbeit",
        "planning" => "Planung",
        "review" => "Review",
        "completed" => "Abgeschlossen",
        "on_hold" => "Pausiert",
        _ => "Storniert",
    }
}

fn category_label(category: &str) -> &'static str {
    match category {
        "client_work" => "Kundenauftrag",
        "internal" => "Intern",
        "maintenance" => "Wartung",
        "development" => "Entwicklung",
        _ => "Marketing",
    }
}

fn priority_label(priority: &str) -> &'static str {
    match priority {
        "low" => "Niedrig",
        "medium" => "Mittel",
        "high" => "Hoch",
        _ => "Dringend",
    }
}

/// Portfolio CSV with one row per project, including task aggregates.
pub fn csv(projects: &[Project], tasks: &[ProjectTask]) -> String {
    let headers = [
        "Code",
        "Titel",
        "Kunde",
        "Kategorie",
        "Status",
        "Prioritaet",
        "Budget",
        "Stundensatz",
        "Start",
        "Deadline",
        "Aufgaben",
        "Erledigt",
        "Erfasste Stunden",
        "Abrechenbarer Wert",
    ];
    let mut lines = vec![headers.join(";")];
    for project in projects {
        let project_tasks: Vec<&ProjectTask> = tasks
            .iter()
            .filter(|task| task.project_id == project.id)
            .collect();
        let done = project_tasks
            .iter()
            .filter(|task| task.status == "done")
            .count();
        let logged_milli: i64 = project_tasks
            .iter()
            .map(|task| task.logged_hours_milli)
            .sum();
        let billable_cents: i64 = project_tasks
            .iter()
            .filter(|task| task.billable)
            .map(|task| task.billable_cents(project.hourly_rate_cents))
            .sum();
        lines.push(
            [
                csv_field(&project.code),
                csv_field(&project.title),
                csv_field(&project.client_name),
                csv_field(category_label(&project.category)),
                csv_field(status_label(&project.status)),
                csv_field(priority_label(&project.priority)),
                format!("{:.2}", project.budget_cents as f64 / 100.0),
                format!("{:.2}", project.hourly_rate_cents as f64 / 100.0),
                csv_field(&project.start_date),
                csv_field(&project.deadline),
                project_tasks.len().to_string(),
                done.to_string(),
                format!("{:.3}", logged_milli as f64 / 1_000.0),
                format!("{:.2}", billable_cents as f64 / 100.0),
            ]
            .join(";"),
        );
    }
    format!("\u{feff}{}", lines.join("\n"))
}

/// Suggested CSV file name of the portfolio export.
pub fn csv_file_name(company: &str, now: i64) -> String {
    let name: String = if company.trim().is_empty() {
        "SOCDOF".to_string()
    } else {
        company.trim().to_string()
    };
    let safe: String = name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let (year, month, day) = crate::date::civil_from_millis(now);
    format!("Projekte_{safe}_{year:04}-{month:02}-{day:02}.csv")
}

fn is_iso_date(text: &str) -> bool {
    let text = text.trim();
    text.len() == 10 && crate::date::parse_iso8601(text).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> Project {
        Project {
            id: Uuid::new_v4(),
            title: "Website Relaunch".to_string(),
            code: "PRJ-2026-01".to_string(),
            description: String::new(),
            contact_id: None,
            client_name: "Beispiel GmbH".to_string(),
            category: "development".to_string(),
            status: "active".to_string(),
            priority: "high".to_string(),
            budget_cents: 500_000,
            hourly_rate_cents: 9_500,
            start_date: "2026-11-11".to_string(),
            deadline: "2026-12-31".to_string(),
            color: "#4f46e5".to_string(),
            created_at: 0,
            updated_at: 0,
        }
    }

    fn task(project_id: Uuid, status: &str, logged_milli: i64, billable: bool) -> ProjectTask {
        ProjectTask {
            id: Uuid::new_v4(),
            project_id,
            title: "Konzept".to_string(),
            description: String::new(),
            status: status.to_string(),
            priority: "medium".to_string(),
            assignee: "Meyer".to_string(),
            estimated_hours_milli: 4_000,
            logged_hours_milli: logged_milli,
            due_date: String::new(),
            billable,
            created_at: 0,
        }
    }

    #[test]
    fn validates_the_modal_fields_and_normalizes_the_code() {
        let mut item = project();
        item.title = "  Relaunch ".to_string();
        item.category = " Development ".to_string();
        item.status = " Active ".to_string();
        item.priority = " High ".to_string();
        item.normalize();
        assert_eq!(item.title, "Relaunch");
        assert_eq!(item.category, "development");
        assert!(item.validate().is_ok());

        let mut invalid = project();
        invalid.title = "   ".to_string();
        assert!(invalid.validate().is_err());
        invalid = project();
        invalid.status = "unknown".to_string();
        assert!(invalid.validate().is_err());
        invalid = project();
        invalid.budget_cents = -1;
        assert!(invalid.validate().is_err());

        let mut task = task(item.id, "todo", 0, true);
        task.title = "  Aufgabe ".to_string();
        task.normalize();
        assert_eq!(task.title, "Aufgabe");
        assert!(task.validate().is_ok());
        task.status = "blocked".to_string();
        assert!(task.validate().is_err());
    }

    #[test]
    fn metrics_ignore_tasks_that_do_not_belong_to_a_listed_project() {
        let item = project();
        let linked = task(item.id, "done", 1_000, true);
        let orphan = task(Uuid::new_v4(), "todo", 9_000, true);

        let result = metrics(&[item], &[linked, orphan]);

        assert_eq!(result.total_tasks_count, 1);
        assert_eq!(result.completed_tasks_count, 1);
        assert_eq!(result.completion_rate, 100);
        assert_eq!(result.total_logged_hours_milli, 1_000);
        assert_eq!(result.billable_revenue_cents, 9_500);
    }

    #[test]
    fn computes_portfolio_metrics_and_csv() {
        let item = project();
        let done = task(item.id, "done", 2_500, true);
        let open = task(item.id, "in_progress", 1_000, false);
        let tasks = vec![done, open];
        let metrics = metrics(std::slice::from_ref(&item), &tasks);
        assert_eq!(metrics.active_projects_count, 1);
        assert_eq!(metrics.total_budget_cents, 500_000);
        assert_eq!(metrics.total_logged_hours_milli, 3_500);
        assert_eq!(metrics.total_estimated_hours_milli, 8_000);
        assert_eq!(metrics.total_tasks_count, 2);
        assert_eq!(metrics.completed_tasks_count, 1);
        assert_eq!(metrics.completion_rate, 50);
        // 2.5 h * 95 EUR = 237.50 EUR; the non-billable task contributes nothing.
        assert_eq!(metrics.billable_revenue_cents, 23_750);

        let csv = csv(&[item], &tasks);
        assert!(csv.starts_with('\u{feff}'));
        assert!(csv.contains("PRJ-2026-01"));
        assert!(csv.contains("Website Relaunch"));
        assert!(csv.contains("50"));
        assert!(csv.contains("237.50"));
        assert_eq!(default_code(2026, 2), "PRJ-2026-03");
        assert_eq!(iso_date(0), "1970-01-01");
    }
}
