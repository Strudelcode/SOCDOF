//! Native project portfolio and task management.
//!
//! The screen uses the same project/task records and validation as the shared core store. It keeps
//! integer cents and thousandths of an hour in the domain layer, so the UI never rounds persisted
//! business values through floating point.

use egui::{Context, RichText};
use socdof_core::domain::contact::Contact;
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::project::{
    default_code, iso_date, metrics, Project, ProjectTask, DEFAULT_HOURLY_RATE_CENTS,
};
use socdof_core::money::Money;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{badge, button, card, ButtonVariant, Tone};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::FONT_SMALL;

/// Editable state of the project portfolio.
#[derive(Debug, Clone)]
pub struct ProjectsState {
    /// Projects currently loaded from SQLite.
    pub projects: Vec<Project>,
    /// Tasks currently loaded from SQLite.
    pub tasks: Vec<ProjectTask>,
    /// Contacts available for linking a customer to a project.
    pub contacts: Vec<Contact>,
    /// Selected project.
    pub selected: Option<Uuid>,
    /// Search filter.
    pub query: String,
    /// Project form draft.
    pub draft: Option<Project>,
    /// Whether the current project draft is a new record.
    pub draft_is_new: bool,
    /// Task form draft.
    pub task_draft: Option<ProjectTask>,
    /// Whether the current task draft is a new record.
    pub task_is_new: bool,
    /// Project delete confirmation.
    pub confirm_delete: bool,
    /// Last error.
    pub error: Option<String>,
    /// Last success message.
    pub status: Option<String>,
    /// Invoice created from billable project tasks; the host opens it in Invoices.
    pub created_invoice: Option<Uuid>,
    /// Request to return to the desktop.
    pub back: bool,
}

impl Default for ProjectsState {
    fn default() -> Self {
        Self {
            projects: Vec::new(),
            tasks: Vec::new(),
            contacts: Vec::new(),
            selected: None,
            query: String::new(),
            draft: None,
            draft_is_new: false,
            task_draft: None,
            task_is_new: false,
            confirm_delete: false,
            error: None,
            status: None,
            created_invoice: None,
            back: false,
        }
    }
}

impl ProjectsState {
    /// Creates an empty project screen.
    pub fn new() -> Self {
        Self::default()
    }

    /// Reloads projects and tasks from the persistent store.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.projects = store.projects()?;
        self.tasks = store.project_tasks_all()?;
        self.contacts = store.list_contacts()?;
        if self.selected.is_some_and(|id| !self.projects.iter().any(|p| p.id == id)) {
            self.selected = None;
        }
        Ok(())
    }

    /// Clears transient state and reloads the current portfolio.
    pub fn reset_for_open(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.query.clear();
        self.draft = None;
        self.task_draft = None;
        self.confirm_delete = false;
        self.error = None;
        self.status = None;
        self.created_invoice = None;
        self.back = false;
        self.refresh(store)
    }

    /// Starts a new project with the same suggested code and hourly rate as the legacy module.
    pub fn start_new(&mut self, now: i64) {
        let year = iso_date(now).split('-').next().and_then(|value| value.parse::<i64>().ok()).unwrap_or(1970);
        let contact = self.contacts.first();
        self.draft = Some(Project {
            id: Uuid::new_v4(),
            title: String::new(),
            code: default_code(year, self.projects.len()),
            description: String::new(),
            contact_id: contact.map(|contact| contact.id),
            client_name: contact.map(Contact::display_name).unwrap_or_default(),
            category: "client_work".to_string(),
            status: "active".to_string(),
            priority: "medium".to_string(),
            budget_cents: 250_000,
            hourly_rate_cents: DEFAULT_HOURLY_RATE_CENTS,
            start_date: iso_date(now),
            deadline: String::new(),
            color: "#4f46e5".to_string(),
            created_at: now,
            updated_at: now,
        });
        self.draft_is_new = true;
        self.error = None;
        self.status = None;
    }

    /// Opens an existing project for editing.
    pub fn start_edit(&mut self) {
        if let Some(project) = self.current().cloned() {
            self.draft = Some(project);
            self.draft_is_new = false;
            self.error = None;
            self.status = None;
        }
    }

    /// Cancels the project editor without writing to SQLite.
    pub fn cancel_edit(&mut self) {
        self.draft = None;
        self.error = None;
    }

    /// Saves a validated project and refreshes the portfolio.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(mut project) = self.draft.clone() else {
            return Ok(());
        };
        project.normalize();
        if let Some(contact_id) = project.contact_id {
            if let Some(contact) = self.contacts.iter().find(|contact| contact.id == contact_id) {
                project.client_name = contact.display_name();
            }
        }
        project.updated_at = now;
        project.validate().map_err(socdof_core::CoreError::Validation)?;
        if self.draft_is_new {
            store.insert_project(&project)?;
        } else {
            store.update_project(&project)?;
        }
        self.selected = Some(project.id);
        self.draft = None;
        self.error = None;
        self.status = Some("projects_saved".to_string());
        self.refresh(store)
    }

    /// Deletes the selected project and all of its tasks through the core store.
    pub fn delete_selected(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else { return Ok(()); };
        store.delete_project(id)?;
        self.selected = None;
        self.confirm_delete = false;
        self.status = Some("projects_deleted".to_string());
        self.refresh(store)
    }

    /// Exports the complete portfolio using the shared core CSV format.
    pub fn export_csv(&self, path: &std::path::Path) -> socdof_core::CoreResult<u64> {
        let content = socdof_core::domain::project::csv(&self.projects, &self.tasks);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content.as_bytes())?;
        Ok(content.len() as u64)
    }

    /// Creates a draft invoice from billable, logged tasks using the same template defaults
    /// and tax calculation as the desktop command path.
    pub fn create_invoice(
        &mut self,
        store: &Store,
        project_id: Uuid,
        now: i64,
    ) -> socdof_core::CoreResult<Uuid> {
        let project = store
            .project(project_id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(project_id.to_string()))?;
        let contact_id = project.contact_id.ok_or_else(|| {
            socdof_core::CoreError::Validation("project_contact_required".to_string())
        })?;
        if store.find_contact(contact_id)?.is_none() {
            return Err(socdof_core::CoreError::Validation(
                "project_contact_unknown".to_string(),
            ));
        }
        let tasks = store.project_tasks(project_id)?;
        let billable: Vec<_> = tasks
            .into_iter()
            .filter(|task| task.billable && task.logged_hours_milli > 0)
            .collect();
        if billable.is_empty() {
            return Err(socdof_core::CoreError::Validation(
                "project_billable_tasks_required".to_string(),
            ));
        }

        let company = store.company_profile()?;
        let template = socdof_core::invoice_template::active(store)?;
        let existing = store.list_invoices()?;
        let year = socdof_core::date::civil_from_millis(now).0;
        let prefix = format!("{year}-");
        let next_number = existing
            .iter()
            .filter_map(|invoice| invoice.number.strip_prefix(&prefix))
            .filter_map(|suffix| suffix.parse::<u32>().ok())
            .max()
            .unwrap_or(0) + 1;
        let rate = if project.hourly_rate_cents == 0 {
            DEFAULT_HOURLY_RATE_CENTS
        } else {
            project.hourly_rate_cents
        };
        let invoice = Invoice {
            id: Uuid::new_v4(),
            number: format!("{prefix}{next_number:04}"),
            contact_id,
            status: InvoiceStatus::Draft,
            issued_at: now,
            due_at: now + template.due_days.max(0) * 86_400_000,
            currency_symbol: company.currency,
            note: Some(format!("Projekt {} - {}", project.code, project.title)),
            lines: billable
                .iter()
                .map(|task| InvoiceLine {
                    description: format!("{} - {}", project.code, task.title),
                    quantity_milli: task.logged_hours_milli,
                    unit_price: Money::from_cents(rate),
                    tax_rate_bp: 1900,
                })
                .collect(),
        };
        invoice.validate().map_err(socdof_core::CoreError::Validation)?;
        store.insert_invoice(&invoice)?;
        self.created_invoice = Some(invoice.id);
        self.status = Some("projects_invoice_created".to_string());
        Ok(invoice.id)
    }

    /// Selected project.
    pub fn current(&self) -> Option<&Project> {
        self.selected.and_then(|id| self.projects.iter().find(|p| p.id == id))
    }

    /// Tasks belonging to the selected project.
    pub fn current_tasks(&self) -> Vec<&ProjectTask> {
        self.selected
            .map(|id| self.tasks.iter().filter(|task| task.project_id == id).collect())
            .unwrap_or_default()
    }

    /// Starts a task draft for the selected project.
    pub fn start_task(&mut self, now: i64) {
        let Some(project_id) = self.selected else { return; };
        self.task_draft = Some(ProjectTask {
            id: Uuid::new_v4(),
            project_id,
            title: String::new(),
            description: String::new(),
            status: "todo".to_string(),
            priority: "medium".to_string(),
            assignee: String::new(),
            estimated_hours_milli: 2_000,
            logged_hours_milli: 0,
            due_date: String::new(),
            billable: true,
            created_at: now,
        });
        self.task_is_new = true;
        self.error = None;
    }

    /// Opens a task for editing.
    pub fn edit_task(&mut self, id: Uuid) {
        if let Some(task) = self.tasks.iter().find(|task| task.id == id).cloned() {
            self.task_draft = Some(task);
            self.task_is_new = false;
            self.error = None;
        }
    }

    /// Saves a task after core validation.
    pub fn save_task(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(mut task) = self.task_draft.clone() else { return Ok(()); };
        task.normalize();
        task.validate().map_err(socdof_core::CoreError::Validation)?;
        if self.task_is_new {
            store.insert_project_task(&task)?;
        } else {
            store.update_project_task(&task)?;
        }
        self.task_draft = None;
        self.status = Some("projects_task_saved".to_string());
        self.refresh(store)
    }

    /// Moves one task to another Kanban status.
    pub fn set_task_status(
        &mut self,
        store: &Store,
        task_id: Uuid,
        status: &str,
    ) -> socdof_core::CoreResult<()> {
        let Some(project_id) = self.selected else { return Ok(()); };
        store.set_project_task_status(project_id, task_id, status)?;
        self.refresh(store)
    }

    /// Deletes a task from the selected project.
    pub fn delete_task(&mut self, store: &Store, task_id: Uuid) -> socdof_core::CoreResult<()> {
        let Some(project_id) = self.selected else { return Ok(()); };
        store.delete_project_task(project_id, task_id)?;
        self.status = Some("projects_task_deleted".to_string());
        self.refresh(store)
    }
}

fn money(cents: i64, currency: &str) -> String {
    format!("{:.2} {}", cents as f64 / 100.0, currency)
}

fn hours(milli: i64) -> String {
    format!("{:.1} h", milli as f64 / 1_000.0)
}

fn category_key(category: &str) -> &'static str {
    match category {
        "client_work" => "projects_category_client_work",
        "internal" => "projects_category_internal",
        "maintenance" => "projects_category_maintenance",
        "development" => "projects_category_development",
        _ => "projects_category_marketing",
    }
}

fn priority_key(priority: &str) -> &'static str {
    match priority {
        "low" => "projects_priority_low",
        "medium" => "projects_priority_medium",
        "high" => "projects_priority_high",
        _ => "projects_priority_urgent",
    }
}

fn status_label(status: &str) -> &'static str {
    match status {
        "active" => "projects_status_active",
        "planning" => "projects_status_planning",
        "review" => "projects_status_review",
        "completed" => "projects_status_completed",
        "on_hold" => "projects_status_on_hold",
        _ => "projects_status_cancelled",
    }
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &ProjectsState) {
    if let Some(error) = &state.error {
        ui.label(RichText::new(error).size(FONT_SMALL).color(theme.palette.danger));
    }
    if let Some(status) = &state.status {
        ui.label(RichText::new(texts.get(status)).size(FONT_SMALL).color(theme.palette.success));
    }
}

/// Renders the native project portfolio with project CRUD and task/Kanban actions.
pub fn projects(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ProjectsState,
    store: &Store,
    now: i64,
) {
    if ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        if state.task_draft.is_some() {
            state.task_draft = None;
        } else if state.draft.is_some() {
            state.cancel_edit();
        } else {
            state.back = true;
        }
    }
    if let Err(error) = state.refresh(store) {
        state.error = Some(error.to_string());
    }

    let currency = store.company_profile().map(|p| p.currency).unwrap_or_else(|_| "EUR".to_string());
    let contacts = state.contacts.clone();
    let stats = metrics(&state.projects, &state.tasks);
    let mut new_project = false;
    let mut edit_project = false;
    let mut cancel_project = false;
    let mut save_project = false;
    let mut delete_project = false;
    let mut new_task = false;
    let mut cancel_task = false;
    let mut save_task = false;
    let mut edit_task: Option<Uuid> = None;
    let mut delete_task: Option<Uuid> = None;
    let mut change_task: Option<(Uuid, &'static str)> = None;
    let mut bill_project: Option<Uuid> = None;
    let mut export_csv = false;

    let filtered: Vec<Project> = state.projects.iter().filter(|project| {
        let query = state.query.trim().to_lowercase();
        query.is_empty()
            || project.title.to_lowercase().contains(&query)
            || project.code.to_lowercase().contains(&query)
            || project.client_name.to_lowercase().contains(&query)
    }).cloned().collect();

    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(theme.palette.background).inner_margin(egui::Margin::same(24.0)))
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                crate::chrome::module_header(
                    ui, theme, texts, focus,
                    crate::chrome::ModuleHeader {
                        app: crate::chrome::app_chrome("projects"),
                        title: texts.get("projects_title"),
                        subtitle: texts.get("projects_subtitle"),
                        status: None,
                    },
                    &mut state.back,
                );
                ui.add_space(10.0);

                ui.horizontal_wrapped(|ui| {
                    card(ui, theme, |ui| {
                        ui.label(RichText::new(texts.get("projects_kpi_active")).size(FONT_SMALL).color(theme.palette.text_muted));
                        ui.heading(stats.active_projects_count.to_string());
                    });
                    card(ui, theme, |ui| {
                        ui.label(RichText::new(texts.get("projects_kpi_budget")).size(FONT_SMALL).color(theme.palette.text_muted));
                        ui.heading(money(stats.total_budget_cents, &currency));
                    });
                    card(ui, theme, |ui| {
                        ui.label(RichText::new(texts.get("projects_kpi_tasks")).size(FONT_SMALL).color(theme.palette.text_muted));
                        ui.heading(format!("{} / {}", stats.completed_tasks_count, stats.total_tasks_count));
                    });
                    card(ui, theme, |ui| {
                        ui.label(RichText::new(texts.get("projects_kpi_billable")).size(FONT_SMALL).color(theme.palette.text_muted));
                        ui.heading(money(stats.billable_revenue_cents, &currency));
                    });
                });
                ui.add_space(10.0);
                messages(ui, theme, texts, state);

                if let Some(task) = state.task_draft.as_mut() {
                    card(ui, theme, |ui| {
                        ui.heading(texts.get("projects_task_edit"));
                        ui.text_edit_singleline(&mut task.title);
                        ui.text_edit_multiline(&mut task.description);
                        ui.horizontal(|ui| {
                            ui.label(texts.get("projects_assignee"));
                            ui.text_edit_singleline(&mut task.assignee);
                            ui.label(texts.get("projects_due"));
                            ui.text_edit_singleline(&mut task.due_date);
                        });
                        egui::ComboBox::from_id_source("projects-task-status")
                            .selected_text(texts.get(status_label(&task.status)))
                            .show_ui(ui, |ui| {
                                for (value, key) in [("todo", "projects_task_todo"), ("in_progress", "projects_task_progress"), ("review", "projects_task_review"), ("done", "projects_task_done")] {
                                    ui.selectable_value(&mut task.status, value.to_string(), texts.get(key));
                                }
                            });
                        egui::ComboBox::from_id_source("projects-task-priority")
                            .selected_text(texts.get(priority_key(&task.priority)))
                            .show_ui(ui, |ui| {
                                for value in ["low", "medium", "high", "urgent"] {
                                    ui.selectable_value(&mut task.priority, value.to_string(), texts.get(priority_key(value)));
                                }
                            });
                        ui.horizontal(|ui| {
                            ui.label(texts.get("projects_estimated_hours"));
                            let mut estimated = (task.estimated_hours_milli as f64 / 1_000.0).to_string();
                            if ui.text_edit_singleline(&mut estimated).changed() {
                                task.estimated_hours_milli = ((estimated.parse::<f64>().unwrap_or(0.0).max(0.0)) * 1_000.0).round() as i64;
                            }
                            ui.label(texts.get("projects_logged_hours"));
                            let mut logged = (task.logged_hours_milli as f64 / 1_000.0).to_string();
                            if ui.text_edit_singleline(&mut logged).changed() {
                                task.logged_hours_milli = ((logged.parse::<f64>().unwrap_or(0.0).max(0.0)) * 1_000.0).round() as i64;
                            }
                            ui.checkbox(&mut task.billable, texts.get("projects_billable"));
                        });
                        ui.horizontal(|ui| {
                            if button(ui, theme, focus, texts.get("projects_save"), ButtonVariant::Primary).activated {
                                save_task = true;
                            }
                            if button(ui, theme, focus, texts.get("projects_cancel"), ButtonVariant::Ghost).activated {
                                cancel_task = true;
                            }
                        });
                    });
                }

                if let Some(project) = state.draft.as_mut() {
                    card(ui, theme, |ui| {
                        ui.heading(texts.get("projects_edit"));
                        egui::Grid::new("projects-project-form").num_columns(2).spacing([10.0, 8.0]).show(ui, |ui| {
                            ui.label(texts.get("projects_name")); ui.text_edit_singleline(&mut project.title); ui.end_row();
                            ui.label(texts.get("projects_code")); ui.text_edit_singleline(&mut project.code); ui.end_row();
                            ui.label(texts.get("projects_client")); ui.text_edit_singleline(&mut project.client_name); ui.end_row();
                            ui.label(texts.get("projects_contact"));
                            egui::ComboBox::from_id_source("projects-contact")
                                .selected_text(project.contact_id.and_then(|id| contacts.iter().find(|contact| contact.id == id).map(|contact| contact.display_name())).unwrap_or_else(|| texts.get("projects_no_contact").to_string()))
                                .show_ui(ui, |ui| {
                                    ui.selectable_value(&mut project.contact_id, None, texts.get("projects_no_contact"));
                                    for contact in &contacts {
                                        ui.selectable_value(&mut project.contact_id, Some(contact.id), contact.display_name());
                                    }
                                });
                            ui.end_row();
                            ui.label(texts.get("projects_description")); ui.text_edit_multiline(&mut project.description); ui.end_row();
                            ui.label(texts.get("projects_category"));
                            egui::ComboBox::from_id_source("projects-category").selected_text(texts.get(category_key(&project.category))).show_ui(ui, |ui| {
                                for value in ["client_work", "internal", "maintenance", "development", "marketing"] {
                                    ui.selectable_value(&mut project.category, value.to_string(), texts.get(category_key(value)));
                                }
                            }); ui.end_row();
                            ui.label(texts.get("projects_status"));
                            egui::ComboBox::from_id_source("projects-status").selected_text(texts.get(status_label(&project.status))).show_ui(ui, |ui| {
                                for (value,key) in [("active","projects_status_active"),("planning","projects_status_planning"),("review","projects_status_review"),("completed","projects_status_completed"),("on_hold","projects_status_on_hold"),("cancelled","projects_status_cancelled")] {
                                    ui.selectable_value(&mut project.status, value.to_string(), texts.get(key));
                                }
                            }); ui.end_row();
                            ui.label(texts.get("projects_priority"));
                            egui::ComboBox::from_id_source("projects-priority").selected_text(texts.get(priority_key(&project.priority))).show_ui(ui, |ui| {
                                for value in ["low", "medium", "high"] { ui.selectable_value(&mut project.priority, value.to_string(), texts.get(priority_key(value))); }
                            }); ui.end_row();
                            ui.label(texts.get("projects_budget"));
                            let mut budget = format!("{:.2}", project.budget_cents as f64 / 100.0);
                            if ui.text_edit_singleline(&mut budget).changed() { project.budget_cents = ((budget.replace(',', ".").parse::<f64>().unwrap_or(0.0).max(0.0))*100.0).round() as i64; }
                            ui.end_row();
                            ui.label(texts.get("projects_hourly_rate"));
                            let mut rate = format!("{:.2}", project.hourly_rate_cents as f64 / 100.0);
                            if ui.text_edit_singleline(&mut rate).changed() { project.hourly_rate_cents = ((rate.replace(',', ".").parse::<f64>().unwrap_or(0.0).max(0.0))*100.0).round() as i64; }
                            ui.end_row();
                            ui.label(texts.get("projects_start_date")); ui.text_edit_singleline(&mut project.start_date); ui.end_row();
                            ui.label(texts.get("projects_deadline")); ui.text_edit_singleline(&mut project.deadline); ui.end_row();
                            ui.label(texts.get("projects_color")); ui.text_edit_singleline(&mut project.color); ui.end_row();
                        });
                        ui.horizontal(|ui| {
                            if button(ui, theme, focus, texts.get("projects_save"), ButtonVariant::Primary).activated { save_project = true; }
                            if button(ui, theme, focus, texts.get("projects_cancel"), ButtonVariant::Ghost).activated { cancel_project = true; }
                        });
                    });
                } else {
                    ui.horizontal(|ui| {
                        ui.heading(texts.get("projects_portfolio"));
                        #[cfg(feature = "dialogs")]
                        if button(ui, theme, focus, texts.get("projects_export"), ButtonVariant::Secondary).activated { export_csv = true; }
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if button(ui, theme, focus, texts.get("projects_new"), ButtonVariant::Primary).activated { new_project = true; }
                        });
                    });
                    ui.horizontal(|ui| {
                        ui.label(texts.get("projects_search"));
                        ui.text_edit_singleline(&mut state.query);
                    });
                    ui.columns(2, |columns| {
                        card(&mut columns[0], theme, |ui| {
                            ui.heading(format!("{} ({})", texts.get("projects_list"), filtered.len()));
                            egui::ScrollArea::vertical().max_height(520.0).show(ui, |ui| {
                                for project in &filtered {
                                    let selected = state.selected == Some(project.id);
                                    let label = format!("{}\n{} · {}", project.title, project.code, texts.get(status_label(&project.status)));
                                    if ui.selectable_label(selected, label).clicked() { state.selected = Some(project.id); state.confirm_delete = false; }
                                }
                            });
                        });
                        card(&mut columns[1], theme, |ui| {
                            if let Some(project) = state.current().cloned() {
                                ui.horizontal(|ui| {
                                    ui.heading(&project.title);
                                    badge(ui, theme, texts.get(status_label(&project.status)), Tone::Accent);
                                });
                                ui.label(format!("{} · {}", project.code, project.client_name));
                                ui.label(&project.description);
                                ui.label(format!("{}: {}", texts.get("projects_budget"), money(project.budget_cents, &currency)));
                                ui.label(format!("{}: {}", texts.get("projects_deadline"), if project.deadline.is_empty() { "—" } else { &project.deadline }));
                                ui.horizontal(|ui| {
                                    if button(ui, theme, focus, texts.get("projects_edit"), ButtonVariant::Secondary).activated { edit_project = true; }
                                    if button(ui, theme, focus, texts.get("projects_new_task"), ButtonVariant::Primary).activated { new_task = true; }
                                    if button(ui, theme, focus, texts.get("projects_bill_project"), ButtonVariant::Secondary).activated { bill_project = Some(project.id); }
                                    if button(ui, theme, focus, texts.get("projects_delete"), ButtonVariant::Danger).activated { state.confirm_delete = true; }
                                });
                                if state.confirm_delete {
                                    ui.label(texts.get("projects_delete_confirm"));
                                    if button(ui, theme, focus, texts.get("projects_delete_yes"), ButtonVariant::Danger).activated { delete_project = true; }
                                }
                                ui.separator();
                                ui.heading(texts.get("projects_tasks"));
                                for task in state.current_tasks() {
                                    ui.horizontal_wrapped(|ui| {
                                        ui.label(RichText::new(&task.title).strong());
                                        badge(ui, theme, texts.get(match task.status.as_str() {
                                            "in_progress" => "projects_task_progress",
                                            "review" => "projects_task_review",
                                            "done" => "projects_task_done",
                                            _ => "projects_task_todo",
                                        }), Tone::Neutral);
                                        ui.label(format!("{} · {}", task.assignee, hours(task.logged_hours_milli)));
                                        if button(ui, theme, focus, texts.get("projects_task_edit"), ButtonVariant::Ghost).activated { edit_task = Some(task.id); }
                                        if button(ui, theme, focus, texts.get("projects_task_delete"), ButtonVariant::Ghost).activated { delete_task = Some(task.id); }
                                    });
                                    ui.horizontal(|ui| {
                                        for (value,key) in [("todo","projects_task_todo"),("in_progress","projects_task_progress"),("review","projects_task_review"),("done","projects_task_done")] {
                                            if task.status != value && button(ui, theme, focus, texts.get(key), ButtonVariant::Ghost).activated {
                                                change_task = Some((task.id, value));
                                            }
                                        }
                                    });
                                }
                            } else {
                                ui.label(texts.get("projects_select"));
                            }
                        });
                    });
                }
            });
        });

    if new_project { state.start_new(now); }
    if edit_project { state.start_edit(); }
    if cancel_project { state.cancel_edit(); }
    if save_project {
        if let Err(error) = state.save(store, now) { state.error = Some(error.to_string()); }
    }
    if delete_project {
        if let Err(error) = state.delete_selected(store) { state.error = Some(error.to_string()); }
    }
    if new_task { state.start_task(now); }
    if cancel_task { state.task_draft = None; }
    if save_task {
        if let Err(error) = state.save_task(store) { state.error = Some(error.to_string()); }
    }
    if let Some(id) = edit_task { state.edit_task(id); }
    if let Some(id) = delete_task {
        if let Err(error) = state.delete_task(store, id) { state.error = Some(error.to_string()); }
    }
    if let Some((id, status)) = change_task {
        if let Err(error) = state.set_task_status(store, id, status) { state.error = Some(error.to_string()); }
    }
    if let Some(project_id) = bill_project {
        if let Err(error) = state.create_invoice(store, project_id, now) { state.error = Some(error.to_string()); }
    }
    #[cfg(feature = "dialogs")]
    if export_csv {
        let company = store.company_profile().map(|profile| profile.name).unwrap_or_default();
        let suggested = socdof_core::domain::project::csv_file_name(&company, now);
        if let Some(path) = rfd::FileDialog::new().set_file_name(&suggested).save_file() {
            match state.export_csv(&path) {
                Ok(_) => state.status = Some("projects_exported".to_string()),
                Err(error) => state.error = Some(error.to_string()),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn project_and_task_crud_persist_through_the_store() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ProjectsState::new();
        state.refresh(&store).expect("refresh");
        state.start_new(1_800_000_000_000);
        let mut project = state.draft.clone().expect("draft");
        project.title = "Rust migration".to_string();
        project.code = "PRJ-2027-01".to_string();
        state.draft = Some(project);
        state.save(&store, 1_800_000_000_001).expect("save");
        let project_id = state.selected.expect("selected");
        assert_eq!(store.projects().expect("projects").len(), 1);

        state.start_task(1_800_000_000_002);
        let mut task = state.task_draft.clone().expect("task draft");
        task.title = "Port the portfolio".to_string();
        task.logged_hours_milli = 1_500;
        state.task_draft = Some(task);
        state.save_task(&store).expect("save task");
        assert_eq!(store.project_tasks(project_id).expect("tasks").len(), 1);
        assert_eq!(metrics(&state.projects, &state.tasks).total_logged_hours_milli, 1_500);

        let task_id = state.tasks[0].id;
        state.set_task_status(&store, task_id, "done").expect("status");
        assert_eq!(state.tasks[0].status, "done");
        state.delete_task(&store, task_id).expect("delete task");
        assert!(state.tasks.is_empty());
        state.delete_selected(&store).expect("delete project");
        assert!(state.projects.is_empty());
    }

    #[test]
    fn invalid_project_does_not_write_to_store() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ProjectsState::new();
        state.start_new(1_800_000_000_000);
        state.draft.as_mut().expect("draft").title.clear();
        assert!(state.save(&store, 1_800_000_000_001).is_err());
        assert!(store.projects().expect("projects").is_empty());
    }

    #[test]
    fn portfolio_metrics_use_integer_domain_values() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ProjectsState::new();
        state.refresh(&store).expect("refresh");
        assert_eq!(metrics(&state.projects, &state.tasks).total_tasks_count, 0);
    }
}
