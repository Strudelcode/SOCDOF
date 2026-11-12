//! End-to-end proof for the project portfolio commands of the desktop window.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::{ContactInput, DesktopState};
use socdof_app::project_bridge::{ProjectInput, ProjectTaskInput};

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-projects-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn project_input(contact_id: Option<uuid::Uuid>) -> ProjectInput {
    ProjectInput {
        id: None,
        title: "  Website Relaunch ".to_string(),
        code: String::new(),
        description: "Relaunch der Website".to_string(),
        contact_id,
        category: "development".to_string(),
        status: "active".to_string(),
        priority: "high".to_string(),
        budget: 5_000.0,
        hourly_rate: 95.0,
        start_date: "2026-11-11".to_string(),
        deadline: "2026-12-31".to_string(),
        color: "#4f46e5".to_string(),
    }
}

#[test]
fn projects_roundtrip_persist_bill_and_export() {
    let dir = temp_dir("roundtrip");
    let database = dir.join("socdof.sqlite");
    let state = DesktopState::open(&database).expect("state");
    let contact = state
        .create_contact(&ContactInput {
            name: "Beispiel GmbH".to_string(),
            contact_type: "customer".to_string(),
            city: "Berlin".to_string(),
            ..Default::default()
        })
        .expect("contact");

    let created = state
        .save_project(&project_input(Some(contact.id)))
        .expect("create");
    assert_eq!(created.title, "Website Relaunch");
    assert_eq!(created.client_name, "Beispiel GmbH");
    assert!(created.code.starts_with("PRJ-"));
    assert_eq!(created.budget, 5_000.0);
    assert_eq!(created.task_count, 0);

    let mut edit = project_input(Some(contact.id));
    edit.id = Some(created.id);
    edit.status = "review".to_string();
    edit.budget = 6_000.0;
    edit.description = "Relaunch, Phase 2".to_string();
    let edited = state.save_project(&edit).expect("update");
    assert_eq!(edited.status, "review");
    assert_eq!(edited.budget, 6_000.0);
    assert_eq!(edited.code, created.code, "editing keeps the code");

    let task = state
        .save_project_task(&ProjectTaskInput {
            id: None,
            project_id: Some(created.id),
            title: "Konzept".to_string(),
            description: "Seitenstruktur".to_string(),
            status: "in_progress".to_string(),
            priority: "high".to_string(),
            assignee: "Meyer".to_string(),
            estimated_hours: 4.0,
            logged_hours: 2.5,
            due_date: "2026-12-15".to_string(),
            billable: true,
        })
        .expect("task");
    assert_eq!(task.estimated_hours, 4.0);
    assert_eq!(task.logged_hours, 2.5);

    let overview = state.project_overview().expect("overview");
    let listed = overview
        .projects
        .iter()
        .find(|project| project.id == created.id)
        .expect("listed project");
    assert_eq!(listed.status, "review");
    assert_eq!(listed.task_count, 1);
    assert_eq!(listed.progress_pct, 0);
    assert_eq!(listed.billable_value, 237.5);
    assert_eq!(overview.metrics.active_projects_count, 0);
    assert_eq!(overview.metrics.total_tasks_count, 1);
    assert_eq!(overview.metrics.completed_tasks_count, 0);
    assert_eq!(overview.metrics.billable_revenue, 237.5);

    let moved = state
        .set_project_task_status(created.id, task.id, "done")
        .expect("status");
    assert_eq!(moved.status, "done");
    let overview = state.project_overview().expect("overview after done");
    assert_eq!(overview.metrics.completion_rate, 100);

    let csv_path = dir.join("projekte.csv");
    let report = state.export_projects_csv(&csv_path).expect("csv");
    assert_eq!(report.rows, 1);
    let csv = std::fs::read_to_string(&csv_path).expect("csv file");
    assert!(csv.starts_with('\u{feff}'));
    assert!(csv.contains(&created.code));
    assert!(csv.contains("Website Relaunch"));
    assert!(csv.contains("237.50"));

    let persisted = state.project_persistence(created.id).expect("persistence");
    assert!(persisted.present);
    assert_eq!(persisted.tasks, 1);

    let invoice = state.create_project_invoice(created.id).expect("invoice");
    assert_eq!(invoice.items.len(), 1);
    assert_eq!(invoice.contact_id, contact.id);
    assert_eq!(invoice.total_cents, 28_263);
    state.delete_invoice(invoice.id).expect("delete invoice");

    state.release_lock();
    drop(state);

    let reopened = DesktopState::open(&database).expect("reopen");
    let persisted = reopened.project_overview().expect("persisted overview");
    let listed = persisted
        .projects
        .iter()
        .find(|project| project.id == created.id)
        .expect("persisted project");
    assert_eq!(listed.status, "review");
    assert_eq!(listed.tasks[0].status, "done");
    assert_eq!(listed.tasks[0].logged_hours, 2.5);

    reopened
        .delete_project_task(created.id, task.id)
        .expect("delete task");
    reopened.delete_project(created.id).expect("delete project");
    let empty = reopened.project_overview().expect("empty overview");
    assert!(empty.projects.is_empty());
    assert_eq!(empty.metrics.total_tasks_count, 0);
    reopened.release_lock();
}

#[test]
fn projects_reject_invalid_modal_fields() {
    let dir = temp_dir("validation");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");

    let mut invalid = project_input(None);
    invalid.title = "   ".to_string();
    assert!(state.save_project(&invalid).is_err());

    let project = state.save_project(&project_input(None)).expect("project");
    let invalid_task = ProjectTaskInput {
        project_id: Some(project.id),
        title: String::new(),
        status: "todo".to_string(),
        priority: "medium".to_string(),
        estimated_hours: 1.0,
        ..Default::default()
    };
    assert!(state.save_project_task(&invalid_task).is_err());

    let missing_project = ProjectTaskInput {
        project_id: None,
        title: "Ohne Projekt".to_string(),
        status: "todo".to_string(),
        priority: "medium".to_string(),
        ..Default::default()
    };
    assert!(state.save_project_task(&missing_project).is_err());
    assert!(state.create_project_invoice(project.id).is_err());
    state.release_lock();
}
