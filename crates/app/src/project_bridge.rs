//! Wire layer of the project portfolio: TypeScript field names, inputs and views.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use socdof_core::date;
use socdof_core::domain::contact::Contact;
use socdof_core::domain::project::{self, Project, ProjectTask};

/// One Kanban task as the webview expects it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTaskView {
    /// Identifier.
    pub id: Uuid,
    /// Project the task belongs to.
    pub project_id: Uuid,
    /// Title.
    pub title: String,
    /// Notes.
    pub description: String,
    /// `todo`, `in_progress`, `review` or `done`.
    pub status: String,
    /// `low`, `medium`, `high` or `urgent`.
    pub priority: String,
    /// Person responsible.
    pub assignee: String,
    /// Estimated hours.
    pub estimated_hours: f64,
    /// Logged hours.
    pub logged_hours: f64,
    /// Due date.
    pub due_date: String,
    /// Whether the time is billable.
    pub billable: bool,
    /// ISO creation timestamp.
    pub created_at: String,
}

/// Project card with its tasks and computed values.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectView {
    /// Identifier.
    pub id: Uuid,
    /// Title.
    pub title: String,
    /// Code.
    pub code: String,
    /// Description.
    pub description: String,
    /// Customer contact.
    pub contact_id: Option<Uuid>,
    /// Customer name.
    pub client_name: String,
    /// Category.
    pub category: String,
    /// Status.
    pub status: String,
    /// Priority.
    pub priority: String,
    /// Budget in euro.
    pub budget: f64,
    /// Hourly rate in euro.
    pub hourly_rate: f64,
    /// Start date.
    pub start_date: String,
    /// Deadline.
    pub deadline: String,
    /// Accent colour.
    pub color: String,
    /// Tasks in creation order.
    pub tasks: Vec<ProjectTaskView>,
    /// ISO creation timestamp.
    pub created_at: String,
    /// ISO change timestamp.
    pub updated_at: String,
    /// Completed share in percent.
    pub progress_pct: i64,
    /// Logged hours over all tasks.
    pub logged_hours: f64,
    /// Billable value in euro.
    pub billable_value: f64,
    /// Number of tasks.
    pub task_count: i64,
    /// Number of completed tasks.
    pub done_tasks: i64,
}

/// Contact option of the project dialog.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectContactView {
    /// Identifier.
    pub id: Uuid,
    /// Display name.
    pub name: String,
    /// City, empty when unknown.
    pub city: String,
}

/// KPI strip values.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetricsView {
    /// Active projects.
    pub active_projects_count: i64,
    /// Total budget in euro.
    pub total_budget: f64,
    /// Logged hours.
    pub total_logged_hours: f64,
    /// Estimated hours.
    pub total_estimated_hours: f64,
    /// Number of tasks.
    pub total_tasks_count: i64,
    /// Completed tasks.
    pub completed_tasks_count: i64,
    /// Completed share in percent.
    pub completion_rate: i64,
    /// Billable value in euro.
    pub billable_revenue: f64,
}

/// Everything the project screen needs in one call.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectOverviewView {
    /// Projects, newest first.
    pub projects: Vec<ProjectView>,
    /// Contacts for the project dialog.
    pub contacts: Vec<ProjectContactView>,
    /// KPI values.
    pub metrics: ProjectMetricsView,
    /// Suggested CSV file name.
    pub csv_file_name: String,
}

/// Edited project of the dialog.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ProjectInput {
    /// Existing id, empty for a new project.
    pub id: Option<Uuid>,
    /// Title.
    pub title: String,
    /// Code; empty uses the next `PRJ-YYYY-NN`.
    pub code: String,
    /// Description.
    pub description: String,
    /// Customer contact.
    pub contact_id: Option<Uuid>,
    /// Category.
    pub category: String,
    /// Status.
    pub status: String,
    /// Priority.
    pub priority: String,
    /// Budget in euro.
    pub budget: f64,
    /// Hourly rate in euro.
    pub hourly_rate: f64,
    /// Start date.
    pub start_date: String,
    /// Deadline.
    pub deadline: String,
    /// Accent colour.
    pub color: String,
}

/// Edited task of the Kanban dialog.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ProjectTaskInput {
    /// Existing id, empty for a new task.
    pub id: Option<Uuid>,
    /// Project the task belongs to.
    pub project_id: Option<Uuid>,
    /// Title.
    pub title: String,
    /// Notes.
    pub description: String,
    /// Status.
    pub status: String,
    /// Priority.
    pub priority: String,
    /// Person responsible.
    pub assignee: String,
    /// Estimated hours.
    pub estimated_hours: f64,
    /// Logged hours.
    pub logged_hours: f64,
    /// Due date.
    pub due_date: String,
    /// Whether the time is billable.
    pub billable: bool,
}

/// Result of the portfolio CSV export.
#[derive(Debug, Clone, Serialize)]
pub struct ProjectCsvReport {
    /// Written path.
    pub path: String,
    /// File size in bytes.
    pub bytes: u64,
    /// Number of project rows.
    pub rows: u64,
}

/// Result of the persistence check used by the native smoke run.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPersistenceView {
    /// Whether the project was found in the database.
    pub present: bool,
    /// Number of tasks found for it.
    pub tasks: i64,
    /// Stored code.
    pub code: String,
}

fn euro(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn hours(milli: i64) -> f64 {
    milli as f64 / 1_000.0
}

/// Builds the view of one stored task.
pub fn task_view(task: &ProjectTask) -> ProjectTaskView {
    ProjectTaskView {
        id: task.id,
        project_id: task.project_id,
        title: task.title.clone(),
        description: task.description.clone(),
        status: task.status.clone(),
        priority: task.priority.clone(),
        assignee: task.assignee.clone(),
        estimated_hours: hours(task.estimated_hours_milli),
        logged_hours: hours(task.logged_hours_milli),
        due_date: task.due_date.clone(),
        billable: task.billable,
        created_at: date::format_iso8601(task.created_at),
    }
}

/// Builds one project card with its tasks and computed values.
pub fn project_view(project: &Project, tasks: &[ProjectTask]) -> ProjectView {
    let task_count = tasks.len() as i64;
    let done_tasks = tasks.iter().filter(|task| task.status == "done").count() as i64;
    let progress_pct = if task_count > 0 {
        ((done_tasks as f64 / task_count as f64) * 100.0).round() as i64
    } else {
        0
    };
    let logged_milli: i64 = tasks.iter().map(|task| task.logged_hours_milli).sum();
    let billable_cents: i64 = tasks
        .iter()
        .filter(|task| task.billable)
        .map(|task| task.billable_cents(project.hourly_rate_cents))
        .sum();
    ProjectView {
        id: project.id,
        title: project.title.clone(),
        code: project.code.clone(),
        description: project.description.clone(),
        contact_id: project.contact_id,
        client_name: project.client_name.clone(),
        category: project.category.clone(),
        status: project.status.clone(),
        priority: project.priority.clone(),
        budget: euro(project.budget_cents as f64 / 100.0),
        hourly_rate: euro(project.hourly_rate_cents as f64 / 100.0),
        start_date: project.start_date.clone(),
        deadline: project.deadline.clone(),
        color: project.color.clone(),
        tasks: tasks.iter().map(task_view).collect(),
        created_at: date::format_iso8601(project.created_at),
        updated_at: date::format_iso8601(project.updated_at),
        progress_pct,
        logged_hours: hours(logged_milli),
        billable_value: euro(billable_cents as f64 / 100.0),
        task_count,
        done_tasks,
    }
}

/// Builds the complete project screen payload.
pub fn overview(
    projects: &[Project],
    tasks: &[ProjectTask],
    contacts: &[Contact],
    csv_file_name: String,
) -> ProjectOverviewView {
    let metrics = project::metrics(projects, tasks);
    ProjectOverviewView {
        projects: projects
            .iter()
            .map(|project| {
                let project_tasks: Vec<ProjectTask> = tasks
                    .iter()
                    .filter(|task| task.project_id == project.id)
                    .cloned()
                    .collect();
                project_view(project, &project_tasks)
            })
            .collect(),
        contacts: contacts
            .iter()
            .map(|contact| ProjectContactView {
                id: contact.id,
                name: contact.display_name(),
                city: contact.city.clone().unwrap_or_default(),
            })
            .collect(),
        metrics: ProjectMetricsView {
            active_projects_count: metrics.active_projects_count,
            total_budget: euro(metrics.total_budget_cents as f64 / 100.0),
            total_logged_hours: hours(metrics.total_logged_hours_milli),
            total_estimated_hours: hours(metrics.total_estimated_hours_milli),
            total_tasks_count: metrics.total_tasks_count,
            completed_tasks_count: metrics.completed_tasks_count,
            completion_rate: metrics.completion_rate,
            billable_revenue: euro(metrics.billable_revenue_cents as f64 / 100.0),
        },
        csv_file_name,
    }
}

/// CSV content and project-row count of the portfolio export.
pub fn csv_bytes(projects: &[Project], tasks: &[ProjectTask]) -> (String, u64) {
    (
        project::csv(projects, tasks),
        projects.len().try_into().unwrap_or(0),
    )
}

impl ProjectInput {
    /// Converts the dialog into a stored project.
    pub fn to_project(
        &self,
        now: i64,
        created_at: Option<i64>,
        fallback_code: String,
        client_name: String,
    ) -> Project {
        let mut project = Project {
            id: self.id.unwrap_or_else(Uuid::new_v4),
            title: self.title.clone(),
            code: if self.code.trim().is_empty() {
                fallback_code
            } else {
                self.code.clone()
            },
            description: self.description.clone(),
            contact_id: self.contact_id,
            client_name,
            category: self.category.clone(),
            status: self.status.clone(),
            priority: self.priority.clone(),
            budget_cents: (self.budget.max(0.0) * 100.0).round() as i64,
            hourly_rate_cents: (self.hourly_rate.max(0.0) * 100.0).round() as i64,
            start_date: self.start_date.clone(),
            deadline: self.deadline.clone(),
            color: self.color.clone(),
            created_at: created_at.unwrap_or(now),
            updated_at: now,
        };
        project.normalize();
        project
    }
}

impl ProjectTaskInput {
    /// Converts the dialog into a stored task.
    pub fn to_task(&self, now: i64, created_at: Option<i64>, project_id: Uuid) -> ProjectTask {
        let mut task = ProjectTask {
            id: self.id.unwrap_or_else(Uuid::new_v4),
            project_id,
            title: self.title.clone(),
            description: self.description.clone(),
            status: self.status.clone(),
            priority: self.priority.clone(),
            assignee: self.assignee.clone(),
            estimated_hours_milli: (self.estimated_hours.max(0.0) * 1_000.0).round() as i64,
            logged_hours_milli: (self.logged_hours.max(0.0) * 1_000.0).round() as i64,
            due_date: self.due_date.clone(),
            billable: self.billable,
            created_at: created_at.unwrap_or(now),
        };
        task.normalize();
        task
    }
}
