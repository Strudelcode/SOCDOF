//! Native fleet management: vehicles, digital logbook, fuel receipts and analytics.

use egui::{Context, RichText};
use socdof_core::domain::fleet::{
    csv, csv_file_name, metrics, FleetFuel, FleetTrip, FleetVehicle, COST_PER_KM_CENTS,
};
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{badge, button, card, ButtonVariant, Tone};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::FONT_SMALL;

/// Main fleet view.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum FleetView {
    /// Digital logbook.
    #[default]
    Logbook,
    /// Vehicle register.
    Vehicles,
    /// Fuel and charging receipts.
    Fuel,
    /// Fleet analytics.
    Analytics,
}

/// Persistent state of the fleet app.
#[derive(Debug, Clone)]
pub struct FleetState {
    /// Registered vehicles.
    pub vehicles: Vec<FleetVehicle>,
    /// Logbook entries.
    pub trips: Vec<FleetTrip>,
    /// Fuel and charging receipts.
    pub fuel: Vec<FleetFuel>,
    /// Selected vehicle for the vehicle register.
    pub selected_vehicle: Option<Uuid>,
    /// Selected tab.
    pub view: FleetView,
    /// Search text.
    pub query: String,
    /// Vehicle editor.
    pub vehicle_draft: Option<FleetVehicle>,
    /// Whether the vehicle draft is new.
    pub vehicle_is_new: bool,
    /// Trip editor.
    pub trip_draft: Option<FleetTrip>,
    /// Whether the trip draft is new.
    pub trip_is_new: bool,
    /// Fuel editor.
    pub fuel_draft: Option<FleetFuel>,
    /// Whether the fuel draft is new.
    pub fuel_is_new: bool,
    /// Pending delete confirmation (kind, id).
    pub confirm_delete: Option<(&'static str, Uuid)>,
    /// Last error.
    pub error: Option<String>,
    /// Last success message.
    pub status: Option<String>,
    /// Return to desktop.
    pub back: bool,
}

impl Default for FleetState {
    fn default() -> Self {
        Self {
            vehicles: Vec::new(),
            trips: Vec::new(),
            fuel: Vec::new(),
            selected_vehicle: None,
            view: FleetView::Logbook,
            query: String::new(),
            vehicle_draft: None,
            vehicle_is_new: false,
            trip_draft: None,
            trip_is_new: false,
            fuel_draft: None,
            fuel_is_new: false,
            confirm_delete: None,
            error: None,
            status: None,
            back: false,
        }
    }
}

impl FleetState {
    /// Creates an empty fleet state.
    pub fn new() -> Self { Self::default() }

    /// Reloads all fleet records from the persistent store.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.vehicles = store.fleet_vehicles()?;
        self.trips = store.fleet_trips()?;
        self.fuel = store.fleet_fuel()?;
        if self.selected_vehicle.is_some_and(|id| !self.vehicles.iter().any(|vehicle| vehicle.id == id)) {
            self.selected_vehicle = None;
        }
        Ok(())
    }

    /// Resets transient state when the app is opened.
    pub fn reset_for_open(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.view = FleetView::Logbook;
        self.query.clear();
        self.vehicle_draft = None;
        self.trip_draft = None;
        self.fuel_draft = None;
        self.confirm_delete = None;
        self.error = None;
        self.status = None;
        self.back = false;
        self.refresh(store)
    }

    /// Starts a vehicle form.
    pub fn start_vehicle(&mut self, now: i64) {
        self.vehicle_draft = Some(FleetVehicle {
            id: Uuid::new_v4(),
            license_plate: String::new(),
            make: String::new(),
            model: String::new(),
            vehicle_type: "car".to_string(),
            fuel_type: "diesel".to_string(),
            vin: String::new(),
            current_odometer: 0,
            assigned_driver: String::new(),
            year: Some(socdof_core::date::civil_from_millis(now).0),
            next_inspection_due: String::new(),
            notes: String::new(),
            status: "active".to_string(),
            created_at: now,
        });
        self.vehicle_is_new = true;
        self.error = None;
    }

    /// Saves a validated vehicle.
    pub fn save_vehicle(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(mut vehicle) = self.vehicle_draft.clone() else { return Ok(()); };
        vehicle.normalize();
        vehicle.validate().map_err(socdof_core::CoreError::Validation)?;
        if self.vehicle_is_new {
            store.insert_fleet_vehicle(&vehicle)?;
        } else {
            store.update_fleet_vehicle(&vehicle)?;
        }
        self.selected_vehicle = Some(vehicle.id);
        self.vehicle_draft = None;
        self.status = Some("fleet_vehicle_saved".to_string());
        self.refresh(store)
    }

    /// Deletes a vehicle. Historical trips and fuel receipts are intentionally retained by core.
    pub fn delete_vehicle(&mut self, store: &Store, id: Uuid) -> socdof_core::CoreResult<()> {
        store.delete_fleet_vehicle(id)?;
        self.confirm_delete = None;
        self.status = Some("fleet_vehicle_deleted".to_string());
        self.refresh(store)
    }

    /// Starts a trip form for the selected or first registered vehicle.
    pub fn start_trip(&mut self, now: i64) {
        let Some(vehicle) = self.vehicles.iter().find(|vehicle| Some(vehicle.id) == self.selected_vehicle)
            .or_else(|| self.vehicles.first()) else {
                self.error = Some("fleet_vehicle_required".to_string());
                return;
            };
        self.trip_draft = Some(FleetTrip {
            id: Uuid::new_v4(),
            vehicle_id: vehicle.id,
            vehicle_plate: vehicle.license_plate.clone(),
            driver: vehicle.assigned_driver.clone(),
            date: socdof_core::domain::project::iso_date(now),
            start_time: "08:30".to_string(),
            end_time: "09:30".to_string(),
            start_location: String::new(),
            end_location: String::new(),
            purpose: "business".to_string(),
            reason: String::new(),
            customer_name: String::new(),
            start_km: vehicle.current_odometer,
            end_km: vehicle.current_odometer + 1,
            distance_km: 1,
            notes: String::new(),
            created_at: now,
        });
        self.trip_is_new = true;
        self.error = None;
    }

    /// Opens a trip for editing.
    pub fn edit_trip(&mut self, id: Uuid) {
        self.trip_draft = self.trips.iter().find(|trip| trip.id == id).cloned();
        self.trip_is_new = false;
        self.error = None;
    }

    /// Saves a trip and lets the store update the vehicle odometer on insert.
    pub fn save_trip(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(mut trip) = self.trip_draft.clone() else { return Ok(()); };
        let vehicle = store.fleet_vehicle(trip.vehicle_id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(trip.vehicle_id.to_string()))?;
        trip.vehicle_plate = vehicle.license_plate.clone();
        trip.driver = trip.driver.trim().to_string();
        trip.date = trip.date.trim().to_string();
        trip.start_time = trip.start_time.trim().to_string();
        trip.end_time = trip.end_time.trim().to_string();
        trip.start_location = trip.start_location.trim().to_string();
        trip.end_location = trip.end_location.trim().to_string();
        trip.reason = trip.reason.trim().to_string();
        trip.customer_name = trip.customer_name.trim().to_string();
        trip.notes = trip.notes.trim().to_string();
        trip.distance_km = FleetTrip::distance(trip.start_km, trip.end_km);
        trip.validate().map_err(socdof_core::CoreError::Validation)?;
        if self.trip_is_new {
            store.insert_fleet_trip(&trip)?;
        } else {
            store.update_fleet_trip(&trip)?;
        }
        self.trip_draft = None;
        self.status = Some("fleet_trip_saved".to_string());
        self.refresh(store)
    }

    /// Deletes a logbook entry.
    pub fn delete_trip(&mut self, store: &Store, id: Uuid) -> socdof_core::CoreResult<()> {
        store.delete_fleet_trip(id)?;
        self.confirm_delete = None;
        self.status = Some("fleet_trip_deleted".to_string());
        self.refresh(store)
    }

    /// Starts a fuel or charging receipt.
    pub fn start_fuel(&mut self, now: i64) {
        let Some(vehicle) = self.vehicles.iter().find(|vehicle| Some(vehicle.id) == self.selected_vehicle)
            .or_else(|| self.vehicles.first()) else {
                self.error = Some("fleet_vehicle_required".to_string());
                return;
            };
        self.fuel_draft = Some(FleetFuel {
            id: Uuid::new_v4(),
            vehicle_id: vehicle.id,
            vehicle_plate: vehicle.license_plate.clone(),
            date: socdof_core::domain::project::iso_date(now),
            odometer: vehicle.current_odometer,
            units_milli: 0,
            total_cost_cents: 0,
            price_per_unit_milli: 0,
            fuel_station: String::new(),
            notes: String::new(),
            created_at: now,
        });
        self.fuel_is_new = true;
        self.error = None;
    }

    /// Opens a receipt for editing.
    pub fn edit_fuel(&mut self, id: Uuid) {
        self.fuel_draft = self.fuel.iter().find(|entry| entry.id == id).cloned();
        self.fuel_is_new = false;
        self.error = None;
    }

    /// Saves a validated fuel or charging receipt.
    pub fn save_fuel(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(mut entry) = self.fuel_draft.clone() else { return Ok(()); };
        let vehicle = store.fleet_vehicle(entry.vehicle_id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(entry.vehicle_id.to_string()))?;
        entry.vehicle_plate = vehicle.license_plate;
        entry.date = entry.date.trim().to_string();
        entry.fuel_station = entry.fuel_station.trim().to_string();
        entry.notes = entry.notes.trim().to_string();
        entry.price_per_unit_milli = FleetFuel::price_per_unit(entry.total_cost_cents, entry.units_milli);
        entry.validate().map_err(socdof_core::CoreError::Validation)?;
        if self.fuel_is_new {
            store.insert_fleet_fuel(&entry)?;
        } else {
            store.update_fleet_fuel(&entry)?;
        }
        self.fuel_draft = None;
        self.status = Some("fleet_fuel_saved".to_string());
        self.refresh(store)
    }

    /// Deletes a fuel receipt.
    pub fn delete_fuel(&mut self, store: &Store, id: Uuid) -> socdof_core::CoreResult<()> {
        store.delete_fleet_fuel(id)?;
        self.confirm_delete = None;
        self.status = Some("fleet_fuel_deleted".to_string());
        self.refresh(store)
    }

    /// Exports the complete logbook with the core GoBD CSV format.
    pub fn export_csv(&self, path: &std::path::Path) -> socdof_core::CoreResult<u64> {
        let content = csv(&self.trips);
        if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
        std::fs::write(path, content.as_bytes())?;
        Ok(content.len() as u64)
    }
}

fn money(cents: i64, currency: &str) -> String { format!("{:.2} {}", cents as f64 / 100.0, currency) }
fn km(value: i64) -> String { format!("{value} km") }
fn hours_time(value: &str) -> &str { value }
fn purpose_key(value: &str) -> &'static str {
    match value { "private" => "fleet_purpose_private", "commute" => "fleet_purpose_commute", _ => "fleet_purpose_business" }
}
fn vehicle_status_key(value: &str) -> &'static str {
    match value { "maintenance" => "fleet_vehicle_maintenance", "retired" => "fleet_vehicle_retired", _ => "fleet_vehicle_active" }
}
fn task_status_tone(value: &str) -> Tone {
    match value { "retired" => Tone::Neutral, "maintenance" => Tone::Warning, _ => Tone::Success }
}
fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &FleetState) {
    if let Some(error) = &state.error { ui.label(RichText::new(error).size(FONT_SMALL).color(theme.palette.danger)); }
    if let Some(status) = &state.status { ui.label(RichText::new(texts.get(status)).size(FONT_SMALL).color(theme.palette.success)); }
}

/// Renders the native fleet register, logbook, fuel ledger and analytics.
pub fn fleet(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut FleetState,
    store: &Store,
    now: i64,
) {
    if ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        if state.vehicle_draft.is_some() { state.vehicle_draft = None; }
        else if state.trip_draft.is_some() { state.trip_draft = None; }
        else if state.fuel_draft.is_some() { state.fuel_draft = None; }
        else { state.back = true; }
    }
    if let Err(error) = state.refresh(store) { state.error = Some(error.to_string()); }

    let currency = store.company_profile().map(|profile| profile.currency).unwrap_or_else(|_| "EUR".to_string());
    let stats = metrics(&state.trips, &state.fuel, &state.vehicles);
    let query = state.query.trim().to_lowercase();
    let mut add_vehicle = false;
    let mut add_trip = false;
    let mut add_fuel = false;
    let mut save_vehicle = false;
    let mut save_trip = false;
    let mut save_fuel = false;
    let mut cancel_form = false;
    let mut export_clicked = false;
    let mut edit_vehicle: Option<Uuid> = None;
    let mut edit_trip: Option<Uuid> = None;
    let mut edit_fuel: Option<Uuid> = None;
    let mut delete_action: Option<(&'static str, Uuid)> = None;
    let visible_vehicles: Vec<FleetVehicle> = state.vehicles.iter().filter(|v| query.is_empty() || v.license_plate.to_lowercase().contains(&query) || v.make.to_lowercase().contains(&query) || v.model.to_lowercase().contains(&query) || v.assigned_driver.to_lowercase().contains(&query)).cloned().collect();
    let visible_trips: Vec<FleetTrip> = state.trips.iter().filter(|trip| query.is_empty() || trip.vehicle_plate.to_lowercase().contains(&query) || trip.driver.to_lowercase().contains(&query) || trip.start_location.to_lowercase().contains(&query) || trip.end_location.to_lowercase().contains(&query) || trip.customer_name.to_lowercase().contains(&query)).cloned().collect();
    let visible_fuel: Vec<FleetFuel> = state.fuel.iter().filter(|entry| query.is_empty() || entry.vehicle_plate.to_lowercase().contains(&query) || entry.fuel_station.to_lowercase().contains(&query)).cloned().collect();

    egui::CentralPanel::default()
        .frame(egui::Frame::none().fill(theme.palette.background).inner_margin(egui::Margin::same(24.0)))
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                crate::chrome::module_header(
                    ui, theme, texts, focus,
                    crate::chrome::ModuleHeader {
                        app: crate::chrome::app_chrome("fleet"),
                        title: texts.get("fleet_title"),
                        subtitle: texts.get("fleet_subtitle"),
                        status: None,
                    },
                    &mut state.back,
                );
                ui.horizontal_wrapped(|ui| {
                    card(ui, theme, |ui| {
                        ui.label(RichText::new(texts.get("fleet_kpi_vehicles")).size(FONT_SMALL).color(theme.palette.text_muted));
                        ui.heading(stats.active_vehicles.to_string());
                    });
                    card(ui, theme, |ui| {
                        ui.label(RichText::new(texts.get("fleet_kpi_distance")).size(FONT_SMALL).color(theme.palette.text_muted));
                        ui.heading(km(stats.total_km));
                    });
                    card(ui, theme, |ui| {
                        ui.label(RichText::new(texts.get("fleet_kpi_fuel")).size(FONT_SMALL).color(theme.palette.text_muted));
                        ui.heading(money(stats.fuel_cost_cents, &currency));
                    });
                    card(ui, theme, |ui| {
                        ui.label(RichText::new(texts.get("fleet_kpi_allowance")).size(FONT_SMALL).color(theme.palette.text_muted));
                        ui.heading(money(stats.tax_allowance_cents, &currency));
                    });
                });
                messages(ui, theme, texts, state);
                ui.horizontal_wrapped(|ui| {
                    for (view, key) in [
                        (FleetView::Logbook, "fleet_tab_logbook"),
                        (FleetView::Vehicles, "fleet_tab_vehicles"),
                        (FleetView::Fuel, "fleet_tab_fuel"),
                        (FleetView::Analytics, "fleet_tab_analytics"),
                    ] {
                        if ui.selectable_label(state.view == view, texts.get(key)).clicked() { state.view = view; }
                    }
                    ui.separator();
                    ui.label(texts.get("fleet_search"));
                    ui.text_edit_singleline(&mut state.query);
                });

                if let Some(vehicle) = state.vehicle_draft.as_mut() {
                    card(ui, theme, |ui| {
                        ui.heading(texts.get("fleet_vehicle_form"));
                        egui::Grid::new("fleet-vehicle-form").num_columns(2).show(ui, |ui| {
                            ui.label(texts.get("fleet_plate")); ui.text_edit_singleline(&mut vehicle.license_plate); ui.end_row();
                            ui.label(texts.get("fleet_make")); ui.text_edit_singleline(&mut vehicle.make); ui.end_row();
                            ui.label(texts.get("fleet_model")); ui.text_edit_singleline(&mut vehicle.model); ui.end_row();
                            ui.label(texts.get("fleet_type"));
                            egui::ComboBox::from_id_source("fleet-vehicle-type").selected_text(vehicle.vehicle_type.clone()).show_ui(ui, |ui| {
                                for value in ["car","van","truck","motorcycle","electric"] { ui.selectable_value(&mut vehicle.vehicle_type,value.to_string(),value); }
                            }); ui.end_row();
                            ui.label(texts.get("fleet_fuel_type"));
                            egui::ComboBox::from_id_source("fleet-fuel-type").selected_text(vehicle.fuel_type.clone()).show_ui(ui, |ui| {
                                for value in ["diesel","petrol","electric","hybrid","cng"] { ui.selectable_value(&mut vehicle.fuel_type,value.to_string(),value); }
                            }); ui.end_row();
                            ui.label(texts.get("fleet_vin")); ui.text_edit_singleline(&mut vehicle.vin); ui.end_row();
                            ui.label(texts.get("fleet_odometer")); ui.add(egui::DragValue::new(&mut vehicle.current_odometer).range(0..=i64::MAX)); ui.end_row();
                            ui.label(texts.get("fleet_driver")); ui.text_edit_singleline(&mut vehicle.assigned_driver); ui.end_row();
                            ui.label(texts.get("fleet_year"));
                            let mut year = vehicle.year.unwrap_or(2026);
                            if ui.add(egui::DragValue::new(&mut year).range(1900..=2100)).changed() { vehicle.year = Some(year); }
                            ui.end_row();
                            ui.label(texts.get("fleet_inspection")); ui.text_edit_singleline(&mut vehicle.next_inspection_due); ui.end_row();
                            ui.label(texts.get("fleet_vehicle_status"));
                            egui::ComboBox::from_id_source("fleet-vehicle-status").selected_text(texts.get(vehicle_status_key(&vehicle.status))).show_ui(ui, |ui| {
                                for (value,key) in [("active","fleet_vehicle_active"),("maintenance","fleet_vehicle_maintenance"),("retired","fleet_vehicle_retired")] { ui.selectable_value(&mut vehicle.status,value.to_string(),texts.get(key)); }
                            }); ui.end_row();
                            ui.label(texts.get("fleet_notes")); ui.text_edit_multiline(&mut vehicle.notes); ui.end_row();
                        });
                        ui.horizontal(|ui| {
                            if button(ui,theme,focus,texts.get("fleet_save"),ButtonVariant::Primary).activated { save_vehicle=true; }
                            if button(ui,theme,focus,texts.get("fleet_cancel"),ButtonVariant::Ghost).activated { cancel_form=true; }
                        });
                    });
                }

                if let Some(trip) = state.trip_draft.as_mut() {
                    card(ui, theme, |ui| {
                        ui.heading(texts.get("fleet_trip_form"));
                        egui::Grid::new("fleet-trip-form").num_columns(2).show(ui, |ui| {
                            ui.label(texts.get("fleet_vehicle"));
                            egui::ComboBox::from_id_source("fleet-trip-vehicle").selected_text(state.vehicles.iter().find(|v|v.id==trip.vehicle_id).map(|v|v.license_plate.clone()).unwrap_or_default()).show_ui(ui, |ui| {
                                for vehicle in &state.vehicles { ui.selectable_value(&mut trip.vehicle_id,vehicle.id,vehicle.license_plate.clone()); }
                            }); ui.end_row();
                            ui.label(texts.get("fleet_driver")); ui.text_edit_singleline(&mut trip.driver); ui.end_row();
                            ui.label(texts.get("fleet_date")); ui.text_edit_singleline(&mut trip.date); ui.end_row();
                            ui.label(texts.get("fleet_start_time")); ui.text_edit_singleline(&mut trip.start_time); ui.end_row();
                            ui.label(texts.get("fleet_end_time")); ui.text_edit_singleline(&mut trip.end_time); ui.end_row();
                            ui.label(texts.get("fleet_start_location")); ui.text_edit_singleline(&mut trip.start_location); ui.end_row();
                            ui.label(texts.get("fleet_end_location")); ui.text_edit_singleline(&mut trip.end_location); ui.end_row();
                            ui.label(texts.get("fleet_purpose"));
                            egui::ComboBox::from_id_source("fleet-trip-purpose").selected_text(texts.get(purpose_key(&trip.purpose))).show_ui(ui, |ui| {
                                for (value,key) in [("business","fleet_purpose_business"),("private","fleet_purpose_private"),("commute","fleet_purpose_commute")] { ui.selectable_value(&mut trip.purpose,value.to_string(),texts.get(key)); }
                            }); ui.end_row();
                            ui.label(texts.get("fleet_reason")); ui.text_edit_singleline(&mut trip.reason); ui.end_row();
                            ui.label(texts.get("fleet_customer")); ui.text_edit_singleline(&mut trip.customer_name); ui.end_row();
                            ui.label(texts.get("fleet_start_km")); ui.add(egui::DragValue::new(&mut trip.start_km).range(0..=i64::MAX)); ui.end_row();
                            ui.label(texts.get("fleet_end_km")); ui.add(egui::DragValue::new(&mut trip.end_km).range(0..=i64::MAX)); ui.end_row();
                            ui.label(texts.get("fleet_distance")); ui.label(km(FleetTrip::distance(trip.start_km,trip.end_km))); ui.end_row();
                            ui.label(texts.get("fleet_notes")); ui.text_edit_multiline(&mut trip.notes); ui.end_row();
                        });
                        ui.horizontal(|ui| {
                            if button(ui,theme,focus,texts.get("fleet_save"),ButtonVariant::Primary).activated { save_trip=true; }
                            if button(ui,theme,focus,texts.get("fleet_cancel"),ButtonVariant::Ghost).activated { cancel_form=true; }
                        });
                    });
                }

                if let Some(entry) = state.fuel_draft.as_mut() {
                    card(ui, theme, |ui| {
                        ui.heading(texts.get("fleet_fuel_form"));
                        egui::Grid::new("fleet-fuel-form").num_columns(2).show(ui, |ui| {
                            ui.label(texts.get("fleet_vehicle"));
                            egui::ComboBox::from_id_source("fleet-fuel-vehicle").selected_text(state.vehicles.iter().find(|v|v.id==entry.vehicle_id).map(|v|v.license_plate.clone()).unwrap_or_default()).show_ui(ui, |ui| {
                                for vehicle in &state.vehicles { ui.selectable_value(&mut entry.vehicle_id,vehicle.id,vehicle.license_plate.clone()); }
                            }); ui.end_row();
                            ui.label(texts.get("fleet_date")); ui.text_edit_singleline(&mut entry.date); ui.end_row();
                            ui.label(texts.get("fleet_odometer")); ui.add(egui::DragValue::new(&mut entry.odometer).range(0..=i64::MAX)); ui.end_row();
                            ui.label(texts.get("fleet_units"));
                            let mut units = format!("{:.3}",entry.units_milli as f64/1000.0);
                            if ui.text_edit_singleline(&mut units).changed() { entry.units_milli=(units.replace(',',".").parse::<f64>().unwrap_or(0.0).max(0.0)*1000.0).round() as i64; }
                            ui.end_row();
                            ui.label(texts.get("fleet_total_cost"));
                            let mut total = format!("{:.2}",entry.total_cost_cents as f64/100.0);
                            if ui.text_edit_singleline(&mut total).changed() { entry.total_cost_cents=(total.replace(',',".").parse::<f64>().unwrap_or(0.0).max(0.0)*100.0).round() as i64; }
                            ui.end_row();
                            ui.label(texts.get("fleet_price_per_unit")); ui.label(money(entry.price_per_unit_milli*100/1000,&currency)); ui.end_row();
                            ui.label(texts.get("fleet_station")); ui.text_edit_singleline(&mut entry.fuel_station); ui.end_row();
                            ui.label(texts.get("fleet_notes")); ui.text_edit_multiline(&mut entry.notes); ui.end_row();
                        });
                        ui.horizontal(|ui| {
                            if button(ui,theme,focus,texts.get("fleet_save"),ButtonVariant::Primary).activated { save_fuel=true; }
                            if button(ui,theme,focus,texts.get("fleet_cancel"),ButtonVariant::Ghost).activated { cancel_form=true; }
                        });
                    });
                }

                if state.vehicle_draft.is_none() && state.trip_draft.is_none() && state.fuel_draft.is_none() {
                    match state.view {
                        FleetView::Vehicles => {
                            ui.horizontal(|ui| {
                                ui.heading(texts.get("fleet_vehicles"));
                                if button(ui,theme,focus,texts.get("fleet_add_vehicle"),ButtonVariant::Primary).activated { add_vehicle=true; }
                            });
                            for vehicle in &visible_vehicles {
                                card(ui,theme,|ui| {
                                    ui.horizontal(|ui| {
                                        ui.heading(format!("{} · {} {}",vehicle.license_plate,vehicle.make,vehicle.model));
                                        badge(ui,theme,texts.get(vehicle_status_key(&vehicle.status)),task_status_tone(&vehicle.status));
                                    });
                                    ui.label(format!("{} · {} · {}",vehicle.vehicle_type,vehicle.fuel_type,km(vehicle.current_odometer)));
                                    ui.label(format!("{}: {}",texts.get("fleet_driver"),vehicle.assigned_driver));
                                    ui.label(format!("{}: {}",texts.get("fleet_inspection"),if vehicle.next_inspection_due.is_empty(){"—"}else{&vehicle.next_inspection_due}));
                                    ui.horizontal(|ui| {
                                        if button(ui,theme,focus,texts.get("fleet_edit"),ButtonVariant::Secondary).activated { edit_vehicle=Some(vehicle.id); }
                                        if button(ui,theme,focus,texts.get("fleet_delete"),ButtonVariant::Danger).activated { delete_action=Some(("vehicle",vehicle.id)); }
                                    });
                                });
                            }
                            if visible_vehicles.is_empty() { ui.label(texts.get("fleet_empty_vehicles")); }
                        }
                        FleetView::Logbook => {
                            ui.horizontal(|ui| {
                                ui.heading(texts.get("fleet_tab_logbook"));
                                #[cfg(feature="dialogs")]
                                if button(ui,theme,focus,texts.get("fleet_export"),ButtonVariant::Secondary).activated { export_clicked=true; }
                                if button(ui,theme,focus,texts.get("fleet_add_trip"),ButtonVariant::Primary).activated { add_trip=true; }
                            });
                            for trip in &visible_trips {
                                card(ui,theme,|ui| {
                                    ui.horizontal(|ui| {
                                        ui.heading(format!("{} · {} → {}",trip.date,trip.start_location,trip.end_location));
                                        badge(ui,theme,texts.get(purpose_key(&trip.purpose)),if trip.purpose=="business"{Tone::Success}else{Tone::Neutral});
                                    });
                                    ui.label(format!("{} · {} · {}–{}",trip.vehicle_plate,trip.driver,hours_time(&trip.start_time),hours_time(&trip.end_time)));
                                    ui.label(format!("{} · {} · {}",km(trip.distance_km),trip.reason,money(trip.allowance_cents(),&currency)));
                                    if !trip.customer_name.is_empty(){ui.label(format!("{}: {}",texts.get("fleet_customer"),trip.customer_name));}
                                    ui.horizontal(|ui| {
                                        if button(ui,theme,focus,texts.get("fleet_edit"),ButtonVariant::Secondary).activated { edit_trip=Some(trip.id); }
                                        if button(ui,theme,focus,texts.get("fleet_delete"),ButtonVariant::Danger).activated { delete_action=Some(("trip",trip.id)); }
                                    });
                                });
                            }
                            if visible_trips.is_empty(){ui.label(texts.get("fleet_empty_trips"));}
                        }
                        FleetView::Fuel => {
                            ui.horizontal(|ui| {
                                ui.heading(texts.get("fleet_tab_fuel"));
                                if button(ui,theme,focus,texts.get("fleet_add_fuel"),ButtonVariant::Primary).activated { add_fuel=true; }
                            });
                            for entry in &visible_fuel {
                                card(ui,theme,|ui| {
                                    ui.horizontal(|ui| {
                                        ui.heading(format!("{} · {}",entry.date,entry.vehicle_plate));
                                        ui.label(money(entry.total_cost_cents,&currency));
                                    });
                                    ui.label(format!("{} · {} · {} km",entry.fuel_station,entry.units_milli as f64/1000.0,entry.odometer));
                                    ui.label(format!("{}: {:.3} {}",texts.get("fleet_price_per_unit"),entry.price_per_unit_milli as f64/1000.0,currency));
                                    ui.horizontal(|ui| {
                                        if button(ui,theme,focus,texts.get("fleet_edit"),ButtonVariant::Secondary).activated { edit_fuel=Some(entry.id); }
                                        if button(ui,theme,focus,texts.get("fleet_delete"),ButtonVariant::Danger).activated { delete_action=Some(("fuel",entry.id)); }
                                    });
                                });
                            }
                            if visible_fuel.is_empty(){ui.label(texts.get("fleet_empty_fuel"));}
                        }
                        FleetView::Analytics => {
                            ui.heading(texts.get("fleet_tab_analytics"));
                            egui::Grid::new("fleet-analytics").num_columns(2).striped(true).show(ui,|ui|{
                                ui.label(texts.get("fleet_kpi_vehicles"));ui.label(stats.active_vehicles.to_string());ui.end_row();
                                ui.label(texts.get("fleet_total_distance"));ui.label(km(stats.total_km));ui.end_row();
                                ui.label(texts.get("fleet_business_km"));ui.label(format!("{} ({}%)",km(stats.business_km),stats.business_pct));ui.end_row();
                                ui.label(texts.get("fleet_private_km"));ui.label(format!("{} ({}%)",km(stats.private_km),stats.private_pct));ui.end_row();
                                ui.label(texts.get("fleet_commute_km"));ui.label(format!("{} ({}%)",km(stats.commute_km),stats.commute_pct));ui.end_row();
                                ui.label(texts.get("fleet_kpi_fuel"));ui.label(money(stats.fuel_cost_cents,&currency));ui.end_row();
                                ui.label(texts.get("fleet_kpi_allowance"));ui.label(money(stats.tax_allowance_cents,&currency));ui.end_row();
                                ui.label(texts.get("fleet_allowance_rate"));ui.label(money(COST_PER_KM_CENTS,&currency));ui.end_row();
                            });
                        }
                    }
                }

                if let Some((kind,id)) = state.confirm_delete {
                    card(ui,theme,|ui|{
                        ui.label(texts.get("fleet_delete_confirm"));
                        if button(ui,theme,focus,texts.get("fleet_delete_yes"),ButtonVariant::Danger).activated { delete_action=Some((kind,id)); }
                        if button(ui,theme,focus,texts.get("fleet_cancel"),ButtonVariant::Ghost).activated { state.confirm_delete=None; }
                    });
                }
            });
        });

    if add_vehicle { state.start_vehicle(now); }
    if add_trip { state.start_trip(now); }
    if add_fuel { state.start_fuel(now); }
    if cancel_form { state.vehicle_draft=None; state.trip_draft=None; state.fuel_draft=None; }
    if save_vehicle { if let Err(error)=state.save_vehicle(store){state.error=Some(error.to_string());} }
    if save_trip { if let Err(error)=state.save_trip(store){state.error=Some(error.to_string());} }
    if save_fuel { if let Err(error)=state.save_fuel(store){state.error=Some(error.to_string());} }
    if let Some(id)=edit_vehicle { state.selected_vehicle=Some(id); if let Some(vehicle)=state.vehicles.iter().find(|v|v.id==id).cloned(){state.vehicle_draft=Some(vehicle);state.vehicle_is_new=false;} }
    if let Some(id)=edit_trip { state.edit_trip(id); }
    if let Some(id)=edit_fuel { state.edit_fuel(id); }
    if let Some((kind,id))=delete_action {
        let result=match kind {
            "vehicle"=>state.delete_vehicle(store,id),
            "trip"=>state.delete_trip(store,id),
            _=>state.delete_fuel(store,id),
        };
        if let Err(error)=result {state.error=Some(error.to_string());}
    }
    #[cfg(feature="dialogs")]
    if export_clicked {
        let company=store.company_profile().map(|profile|profile.name).unwrap_or_default();
        let suggested=csv_file_name(&company,now);
        if let Some(path)=rfd::FileDialog::new().set_file_name(&suggested).save_file(){
            match state.export_csv(&path){Ok(_)=>state.status=Some("fleet_exported".to_string()),Err(error)=>state.error=Some(error.to_string())}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fleet_vehicle_trip_and_fuel_crud_persist() {
        let store=Store::open_in_memory().expect("store");
        let mut state=FleetState::new();
        state.refresh(&store).expect("refresh");
        state.start_vehicle(1_800_000_000_000);
        let mut vehicle=state.vehicle_draft.clone().expect("vehicle");
        vehicle.license_plate="M-SO 2026".to_string();
        vehicle.make="VW".to_string();
        vehicle.model="ID.4".to_string();
        vehicle.vehicle_type="electric".to_string();
        vehicle.fuel_type="electric".to_string();
        vehicle.current_odometer=12_000;
        state.vehicle_draft=Some(vehicle);
        state.save_vehicle(&store).expect("save vehicle");
        let vehicle_id=state.selected_vehicle.expect("vehicle id");

        state.start_trip(1_800_000_000_001);
        let mut trip=state.trip_draft.clone().expect("trip");
        trip.start_location="Bozen".to_string();
        trip.end_location="Meran".to_string();
        trip.end_km=12_030;
        state.trip_draft=Some(trip);
        state.save_trip(&store).expect("save trip");
        assert_eq!(state.trips[0].distance_km,30);
        assert_eq!(store.fleet_vehicle(vehicle_id).expect("vehicle").expect("vehicle").current_odometer,12_030);

        state.start_fuel(1_800_000_000_002);
        let mut fuel=state.fuel_draft.clone().expect("fuel");
        fuel.units_milli=40_000;
        fuel.total_cost_cents=8_000;
        fuel.fuel_station="Station".to_string();
        state.fuel_draft=Some(fuel);
        state.save_fuel(&store).expect("save fuel");
        assert_eq!(state.fuel[0].price_per_unit_milli,2_000);

        let trip_id=state.trips[0].id;
        let fuel_id=state.fuel[0].id;
        state.delete_trip(&store,trip_id).expect("delete trip");
        state.delete_fuel(&store,fuel_id).expect("delete fuel");
        state.delete_vehicle(&store,vehicle_id).expect("delete vehicle");
        assert!(state.vehicles.is_empty());
        assert!(state.trips.is_empty());
        assert!(state.fuel.is_empty());
    }

    #[test]
    fn invalid_fleet_records_do_not_persist() {
        let store=Store::open_in_memory().expect("store");
        let mut state=FleetState::new();
        state.start_vehicle(1_800_000_000_000);
        assert!(state.save_vehicle(&store).is_err());
        assert!(store.fleet_vehicles().expect("vehicles").is_empty());
    }
}
