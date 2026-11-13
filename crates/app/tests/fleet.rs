//! End-to-end proof for the fleet webview commands of the desktop window.
//!
//! The test drives vehicles, logbook trips and fuel receipts through [`DesktopState`], exactly like
//! the Tauri commands do, and reopens the database to prove that the records are persisted.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};

use socdof_app::desktop::DesktopState;
use socdof_app::fleet_bridge::{FleetFuelInput, FleetTripInput, FleetVehicleInput};

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn temp_dir(tag: &str) -> PathBuf {
    let unique = format!(
        "socdof-fleet-{tag}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let dir = std::env::temp_dir().join(unique);
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

fn vehicle_input() -> FleetVehicleInput {
    FleetVehicleInput {
        id: None,
        license_plate: "  m-so 2026 ".to_string(),
        make: "VW".to_string(),
        model: "ID.4".to_string(),
        vehicle_type: "electric".to_string(),
        fuel_type: "electric".to_string(),
        vin: "WVWZZZ1JZXW000001".to_string(),
        current_odometer: 12_000,
        assigned_driver: "Meyer".to_string(),
        year: Some(2024),
        next_inspection_due: "2027-06-01".to_string(),
        notes: "Poolfahrzeug".to_string(),
        status: "active".to_string(),
    }
}

#[test]
fn fleet_roundtrip_persists_and_calculates() {
    let dir = temp_dir("roundtrip");
    let database = dir.join("socdof.sqlite");
    let state = DesktopState::open(&database).expect("state");

    let created = state.save_fleet_vehicle(&vehicle_input()).expect("create");
    assert_eq!(created.license_plate, "M-SO 2026");
    assert_eq!(created.current_odometer, 12_000);
    assert_eq!(created.status, "active");

    let mut edit = vehicle_input();
    edit.id = Some(created.id);
    edit.current_odometer = 12_345;
    edit.status = "maintenance".to_string();
    edit.notes = "Werkstatt".to_string();
    let edited = state.save_fleet_vehicle(&edit).expect("update");
    assert_eq!(edited.current_odometer, 12_345);
    assert_eq!(edited.status, "maintenance");
    assert_eq!(edited.notes, "Werkstatt");

    let trip = state
        .save_fleet_trip(&FleetTripInput {
            id: None,
            vehicle_id: Some(created.id),
            driver: "Meyer".to_string(),
            date: "2026-11-11".to_string(),
            start_time: "08:30".to_string(),
            end_time: "09:30".to_string(),
            start_location: "Berlin".to_string(),
            end_location: "Potsdam".to_string(),
            purpose_type: "business".to_string(),
            reason: "Kundentermin".to_string(),
            customer_name: "Beispiel GmbH".to_string(),
            start_km: 12_345,
            end_km: 12_375,
            notes: String::new(),
        })
        .expect("trip");
    assert_eq!(trip.distance_km, 30);
    assert!((trip.calculated_cost - 9.0).abs() < 0.001);
    assert_eq!(trip.vehicle_plate, "M-SO 2026");

    let overview = state.fleet_overview().expect("overview");
    assert_eq!(overview.vehicles[0].current_odometer, 12_375);
    assert_eq!(overview.metrics.total_km, 30);
    assert_eq!(overview.metrics.business_km, 30);
    assert_eq!(overview.metrics.business_pct, 100);
    assert_eq!(overview.metrics.tax_allowance_cents, 900);
    assert_eq!(overview.metrics.active_vehicles, 0);

    let fuel = state
        .save_fleet_fuel(&FleetFuelInput {
            id: None,
            vehicle_id: Some(created.id),
            date: "2026-11-11".to_string(),
            odometer: 12_375,
            liters_or_kwh: 40.0,
            total_cost: 80.0,
            fuel_station: "Tankstelle".to_string(),
            notes: String::new(),
        })
        .expect("fuel");
    assert_eq!(fuel.price_per_unit, 2.0);
    let overview = state.fleet_overview().expect("overview with fuel");
    assert_eq!(overview.metrics.fuel_cost_cents, 8_000);

    let csv_path = dir.join("fahrtenbuch.csv");
    let report = state.export_fleet_csv(&csv_path).expect("csv");
    assert_eq!(report.rows, 1);
    let csv = std::fs::read_to_string(&csv_path).expect("csv file");
    assert!(csv.starts_with('\u{feff}'));
    assert!(csv.contains("Dienstfahrt"));
    assert!(csv.contains("M-SO 2026"));
    assert!(csv.contains("9.00"));

    state.release_lock();
    drop(state);

    let reopened = DesktopState::open(&database).expect("reopen");
    let persisted = reopened.fleet_overview().expect("persisted overview");
    assert_eq!(persisted.vehicles.len(), 1);
    assert_eq!(persisted.trips.len(), 1);
    assert_eq!(persisted.fuel.len(), 1);
    assert_eq!(persisted.vehicles[0].notes, "Werkstatt");

    // The TypeScript module deletes only the vehicle record. Historical logbook
    // entries and fuel receipts must remain available after the vehicle is removed.
    reopened
        .delete_fleet_vehicle(created.id)
        .expect("delete vehicle");
    let without_vehicle = reopened.fleet_overview().expect("history after vehicle deletion");
    assert!(without_vehicle.vehicles.is_empty());
    assert_eq!(without_vehicle.trips.len(), 1);
    assert_eq!(without_vehicle.fuel.len(), 1);
    assert_eq!(without_vehicle.trips[0].vehicle_plate, "M-SO 2026");
    assert_eq!(without_vehicle.fuel[0].vehicle_plate, "M-SO 2026");

    reopened.delete_fleet_trip(trip.id).expect("delete trip");
    reopened.delete_fleet_fuel(fuel.id).expect("delete fuel");
    let empty = reopened.fleet_overview().expect("empty overview");
    assert!(empty.vehicles.is_empty());
    assert!(empty.trips.is_empty());
    assert!(empty.fuel.is_empty());
    reopened.release_lock();
}

#[test]
fn fleet_rejects_invalid_vehicle_trip_and_fuel() {
    let dir = temp_dir("validation");
    let state = DesktopState::open(dir.join("socdof.sqlite")).expect("state");

    let mut invalid = vehicle_input();
    invalid.license_plate = "   ".to_string();
    assert!(state.save_fleet_vehicle(&invalid).is_err());

    let vehicle = state.save_fleet_vehicle(&vehicle_input()).expect("vehicle");
    let invalid_trip = FleetTripInput {
        id: None,
        vehicle_id: Some(vehicle.id),
        driver: "Meyer".to_string(),
        date: "2026-11-11".to_string(),
        start_time: "08:30".to_string(),
        end_time: "09:30".to_string(),
        start_location: "Berlin".to_string(),
        end_location: "Potsdam".to_string(),
        purpose_type: "business".to_string(),
        reason: String::new(),
        customer_name: String::new(),
        start_km: 100,
        end_km: 100,
        notes: String::new(),
    };
    assert!(state.save_fleet_trip(&invalid_trip).is_err());

    let invalid_fuel = FleetFuelInput {
        id: None,
        vehicle_id: Some(vehicle.id),
        date: "2026-11-11".to_string(),
        odometer: 100,
        liters_or_kwh: 0.0,
        total_cost: 10.0,
        fuel_station: String::new(),
        notes: String::new(),
    };
    assert!(state.save_fleet_fuel(&invalid_fuel).is_err());
    state.release_lock();
}
