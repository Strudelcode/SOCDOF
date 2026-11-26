//! Wire layer of the fleet module: TypeScript field names, inputs and views.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use socdof_core::date;
use socdof_core::domain::fleet::{self, FleetFuel, FleetMetrics, FleetTrip, FleetVehicle};
use socdof_core::money::Money;

/// Vehicle as the webview expects it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FleetVehicleView {
    /// Identifier.
    pub id: Uuid,
    /// Licence plate.
    pub license_plate: String,
    /// Manufacturer.
    pub make: String,
    /// Model.
    pub model: String,
    /// Body type.
    #[serde(rename = "type")]
    pub vehicle_type: String,
    /// Drive.
    pub fuel_type: String,
    /// VIN.
    pub vin: String,
    /// Odometer.
    pub current_odometer: i64,
    /// Regular driver.
    pub assigned_driver: String,
    /// Year of manufacture.
    pub year: Option<i64>,
    /// Next inspection date.
    pub next_inspection_due: String,
    /// Notes.
    pub notes: String,
    /// Status.
    pub status: String,
    /// ISO creation timestamp.
    pub created_at: String,
}

/// Trip as the webview expects it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FleetTripView {
    /// Identifier.
    pub id: Uuid,
    /// Vehicle id.
    pub vehicle_id: Uuid,
    /// Plate.
    pub vehicle_plate: String,
    /// Driver.
    pub driver: String,
    /// Date.
    pub date: String,
    /// Departure.
    pub start_time: String,
    /// Arrival.
    pub end_time: String,
    /// Start location.
    pub start_location: String,
    /// Destination.
    pub end_location: String,
    /// Purpose type.
    pub purpose_type: String,
    /// Reason.
    pub reason: String,
    /// Customer.
    pub customer_name: String,
    /// Start odometer.
    pub start_km: i64,
    /// End odometer.
    pub end_km: i64,
    /// Distance.
    pub distance_km: i64,
    /// Allowance in euro.
    pub calculated_cost: f64,
    /// Notes.
    pub notes: String,
    /// ISO creation timestamp.
    pub created_at: String,
}

/// Fuel receipt as the webview expects it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FleetFuelView {
    /// Identifier.
    pub id: Uuid,
    /// Vehicle id.
    pub vehicle_id: Uuid,
    /// Plate.
    pub vehicle_plate: String,
    /// Date.
    pub date: String,
    /// Odometer.
    pub odometer: i64,
    /// Litres or kWh.
    pub liters_or_kwh: f64,
    /// Total in euro.
    pub total_cost: f64,
    /// Price per unit in euro.
    pub price_per_unit: f64,
    /// Station.
    pub fuel_station: String,
    /// Notes.
    pub notes: String,
    /// ISO creation timestamp.
    pub created_at: String,
}

/// Everything the fleet screen needs in one call.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FleetOverviewView {
    /// Vehicles, oldest first.
    pub vehicles: Vec<FleetVehicleView>,
    /// Trips, newest first.
    pub trips: Vec<FleetTripView>,
    /// Receipts, newest first.
    pub fuel: Vec<FleetFuelView>,
    /// KPI values over all trips and receipts.
    pub metrics: FleetMetrics,
    /// Suggested CSV file name.
    pub csv_file_name: String,
}

/// Edited vehicle of the dialog.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct FleetVehicleInput {
    /// Existing id, empty for a new vehicle.
    pub id: Option<Uuid>,
    /// Licence plate.
    pub license_plate: String,
    /// Manufacturer.
    pub make: String,
    /// Model.
    pub model: String,
    /// Body type.
    #[serde(rename = "type")]
    pub vehicle_type: String,
    /// Drive.
    pub fuel_type: String,
    /// VIN.
    pub vin: String,
    /// Odometer.
    pub current_odometer: i64,
    /// Regular driver.
    pub assigned_driver: String,
    /// Year.
    pub year: Option<i64>,
    /// Inspection date.
    pub next_inspection_due: String,
    /// Notes.
    pub notes: String,
    /// Status.
    pub status: String,
}

/// Edited trip of the dialog.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct FleetTripInput {
    /// Existing id, empty for a new trip.
    pub id: Option<Uuid>,
    /// Vehicle.
    pub vehicle_id: Option<Uuid>,
    /// Driver.
    pub driver: String,
    /// Date.
    pub date: String,
    /// Departure.
    pub start_time: String,
    /// Arrival.
    pub end_time: String,
    /// Start location.
    pub start_location: String,
    /// Destination.
    pub end_location: String,
    /// Purpose.
    pub purpose_type: String,
    /// Reason.
    pub reason: String,
    /// Customer.
    pub customer_name: String,
    /// Start odometer.
    pub start_km: i64,
    /// End odometer.
    pub end_km: i64,
    /// Notes.
    pub notes: String,
}

/// Edited fuel receipt of the dialog.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct FleetFuelInput {
    /// Existing id, empty for a new receipt.
    pub id: Option<Uuid>,
    /// Vehicle.
    pub vehicle_id: Option<Uuid>,
    /// Date.
    pub date: String,
    /// Odometer.
    pub odometer: i64,
    /// Litres or kWh.
    pub liters_or_kwh: f64,
    /// Total in euro.
    pub total_cost: f64,
    /// Station.
    pub fuel_station: String,
    /// Notes.
    pub notes: String,
}

/// Written CSV report.
#[derive(Debug, Clone, Serialize)]
pub struct FleetCsvReport {
    /// Written file.
    pub path: String,
    /// Written bytes.
    pub bytes: u64,
    /// Exported rows.
    pub rows: usize,
}

/// Converts a stored vehicle into the wire view.
pub fn vehicle_view(vehicle: &FleetVehicle) -> FleetVehicleView {
    FleetVehicleView {
        id: vehicle.id,
        license_plate: vehicle.license_plate.clone(),
        make: vehicle.make.clone(),
        model: vehicle.model.clone(),
        vehicle_type: vehicle.vehicle_type.clone(),
        fuel_type: vehicle.fuel_type.clone(),
        vin: vehicle.vin.clone(),
        current_odometer: vehicle.current_odometer,
        assigned_driver: vehicle.assigned_driver.clone(),
        year: vehicle.year,
        next_inspection_due: vehicle.next_inspection_due.clone(),
        notes: vehicle.notes.clone(),
        status: vehicle.status.clone(),
        created_at: date::format_iso8601(vehicle.created_at),
    }
}

/// Converts a stored trip into the wire view.
pub fn trip_view(trip: &FleetTrip) -> FleetTripView {
    FleetTripView {
        id: trip.id,
        vehicle_id: trip.vehicle_id,
        vehicle_plate: trip.vehicle_plate.clone(),
        driver: trip.driver.clone(),
        date: trip.date.clone(),
        start_time: trip.start_time.clone(),
        end_time: trip.end_time.clone(),
        start_location: trip.start_location.clone(),
        end_location: trip.end_location.clone(),
        purpose_type: trip.purpose.clone(),
        reason: trip.reason.clone(),
        customer_name: trip.customer_name.clone(),
        start_km: trip.start_km,
        end_km: trip.end_km,
        distance_km: trip.distance_km,
        calculated_cost: trip.distance_km as f64 * 0.30,
        notes: trip.notes.clone(),
        created_at: date::format_iso8601(trip.created_at),
    }
}

/// Converts a stored receipt into the wire view.
pub fn fuel_view(entry: &FleetFuel) -> FleetFuelView {
    FleetFuelView {
        id: entry.id,
        vehicle_id: entry.vehicle_id,
        vehicle_plate: entry.vehicle_plate.clone(),
        date: entry.date.clone(),
        odometer: entry.odometer,
        liters_or_kwh: entry.units_milli as f64 / 1000.0,
        total_cost: entry.total_cost_cents as f64 / 100.0,
        price_per_unit: entry.price_per_unit_milli as f64 / 1000.0,
        fuel_station: entry.fuel_station.clone(),
        notes: entry.notes.clone(),
        created_at: date::format_iso8601(entry.created_at),
    }
}

/// Builds the complete overview.
pub fn overview(
    vehicles: &[FleetVehicle],
    trips: &[FleetTrip],
    fuel: &[FleetFuel],
    csv_file_name: String,
) -> FleetOverviewView {
    FleetOverviewView {
        vehicles: vehicles.iter().map(vehicle_view).collect(),
        trips: trips.iter().map(trip_view).collect(),
        fuel: fuel.iter().map(fuel_view).collect(),
        metrics: fleet::metrics(trips, fuel, vehicles),
        csv_file_name,
    }
}

impl FleetVehicleInput {
    /// Builds the stored model, keeping the creation time of an edit.
    pub fn to_vehicle(&self, now: i64, created_at: Option<i64>) -> FleetVehicle {
        let mut vehicle = FleetVehicle {
            id: self.id.unwrap_or_else(Uuid::new_v4),
            license_plate: self.license_plate.clone(),
            make: self.make.clone(),
            model: self.model.clone(),
            vehicle_type: if self.vehicle_type.trim().is_empty() {
                "car".to_string()
            } else {
                self.vehicle_type.clone()
            },
            fuel_type: if self.fuel_type.trim().is_empty() {
                "diesel".to_string()
            } else {
                self.fuel_type.clone()
            },
            vin: self.vin.clone(),
            current_odometer: self.current_odometer,
            assigned_driver: self.assigned_driver.clone(),
            year: self.year,
            next_inspection_due: self.next_inspection_due.clone(),
            notes: self.notes.clone(),
            status: if self.status.trim().is_empty() {
                "active".to_string()
            } else {
                self.status.clone()
            },
            created_at: created_at.unwrap_or(now),
        };
        vehicle.normalize();
        vehicle
    }
}

impl FleetTripInput {
    /// Builds the stored trip with the plate resolved from the vehicle list.
    pub fn to_trip(&self, now: i64, created_at: Option<i64>, vehicle_plate: String) -> FleetTrip {
        let start_km = self.start_km.max(0);
        let end_km = self.end_km.max(start_km);
        FleetTrip {
            id: self.id.unwrap_or_else(Uuid::new_v4),
            vehicle_id: self.vehicle_id.unwrap_or_else(Uuid::nil),
            vehicle_plate,
            driver: self.driver.trim().to_string(),
            date: self.date.trim().to_string(),
            start_time: self.start_time.trim().to_string(),
            end_time: self.end_time.trim().to_string(),
            start_location: self.start_location.trim().to_string(),
            end_location: self.end_location.trim().to_string(),
            purpose: if self.purpose_type.trim().is_empty() {
                "business".to_string()
            } else {
                self.purpose_type.trim().to_string()
            },
            reason: self.reason.trim().to_string(),
            customer_name: self.customer_name.trim().to_string(),
            start_km,
            end_km,
            distance_km: FleetTrip::distance(start_km, end_km),
            notes: self.notes.trim().to_string(),
            created_at: created_at.unwrap_or(now),
        }
    }
}

impl FleetFuelInput {
    /// Builds the stored receipt with rounded cents and thousandths.
    pub fn to_fuel(&self, now: i64, created_at: Option<i64>, vehicle_plate: String) -> FleetFuel {
        let units_milli = (self.liters_or_kwh.max(0.0) * 1000.0).round() as i64;
        let total_cost_cents = (self.total_cost.max(0.0) * 100.0).round() as i64;
        FleetFuel {
            id: self.id.unwrap_or_else(Uuid::new_v4),
            vehicle_id: self.vehicle_id.unwrap_or_else(Uuid::nil),
            vehicle_plate,
            date: self.date.trim().to_string(),
            odometer: self.odometer.max(0),
            units_milli,
            total_cost_cents,
            price_per_unit_milli: FleetFuel::price_per_unit(total_cost_cents, units_milli),
            fuel_station: self.fuel_station.trim().to_string(),
            notes: self.notes.trim().to_string(),
            created_at: created_at.unwrap_or(now),
        }
    }
}

/// Formats the CSV export bytes.
pub fn csv_bytes(trips: &[FleetTrip]) -> (String, usize) {
    (fleet::csv(trips), trips.len())
}

/// Money helper of the CSV report, kept for the print path.
pub fn total_money(cents: i64) -> Money {
    Money::from_cents(cents)
}
