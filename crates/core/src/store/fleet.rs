//! Fleet vehicles, logbook trips and fuel receipt persistence.

use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::fleet::{FleetFuel, FleetTrip, FleetVehicle};
use crate::error::{CoreError, CoreResult};

const VEHICLE_COLUMNS: &str = "id, license_plate, make, model, vehicle_type, fuel_type, vin, \
    current_odometer, assigned_driver, year, next_inspection_due, notes, status, created_at";
const TRIP_COLUMNS: &str = "id, vehicle_id, vehicle_plate, driver, date, start_time, end_time, \
    start_location, end_location, purpose, reason, customer_name, start_km, end_km, distance_km, \
    notes, created_at";
const FUEL_COLUMNS: &str = "id, vehicle_id, vehicle_plate, date, odometer, units_milli, \
    total_cost_cents, price_per_unit_milli, fuel_station, notes, created_at";

fn vehicle_from_row(row: &Row<'_>) -> rusqlite::Result<FleetVehicle> {
    Ok(FleetVehicle {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        license_plate: row.get(1)?,
        make: row.get(2)?,
        model: row.get(3)?,
        vehicle_type: row.get(4)?,
        fuel_type: row.get(5)?,
        vin: row.get(6)?,
        current_odometer: row.get(7)?,
        assigned_driver: row.get(8)?,
        year: row.get(9)?,
        next_inspection_due: row.get(10)?,
        notes: row.get(11)?,
        status: row.get(12)?,
        created_at: row.get(13)?,
    })
}

fn trip_from_row(row: &Row<'_>) -> rusqlite::Result<FleetTrip> {
    Ok(FleetTrip {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        vehicle_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or(Uuid::nil()),
        vehicle_plate: row.get(2)?,
        driver: row.get(3)?,
        date: row.get(4)?,
        start_time: row.get(5)?,
        end_time: row.get(6)?,
        start_location: row.get(7)?,
        end_location: row.get(8)?,
        purpose: row.get(9)?,
        reason: row.get(10)?,
        customer_name: row.get(11)?,
        start_km: row.get(12)?,
        end_km: row.get(13)?,
        distance_km: row.get(14)?,
        notes: row.get(15)?,
        created_at: row.get(16)?,
    })
}

fn fuel_from_row(row: &Row<'_>) -> rusqlite::Result<FleetFuel> {
    Ok(FleetFuel {
        id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap_or(Uuid::nil()),
        vehicle_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap_or(Uuid::nil()),
        vehicle_plate: row.get(2)?,
        date: row.get(3)?,
        odometer: row.get(4)?,
        units_milli: row.get(5)?,
        total_cost_cents: row.get(6)?,
        price_per_unit_milli: row.get(7)?,
        fuel_station: row.get(8)?,
        notes: row.get(9)?,
        created_at: row.get(10)?,
    })
}

/// Lists all vehicles in insertion order.
pub fn list_vehicles(conn: &Connection) -> CoreResult<Vec<FleetVehicle>> {
    let sql = format!("SELECT {VEHICLE_COLUMNS} FROM fleet_vehicles ORDER BY created_at, rowid");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], vehicle_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Loads one vehicle.
pub fn find_vehicle(conn: &Connection, id: Uuid) -> CoreResult<Option<FleetVehicle>> {
    let sql = format!("SELECT {VEHICLE_COLUMNS} FROM fleet_vehicles WHERE id = ?1");
    Ok(conn
        .query_row(&sql, params![id.to_string()], vehicle_from_row)
        .optional()?)
}

/// Inserts a vehicle.
pub fn insert_vehicle(conn: &Connection, vehicle: &FleetVehicle) -> CoreResult<()> {
    vehicle.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO fleet_vehicles (id, license_plate, make, model, vehicle_type, fuel_type, vin,
            current_odometer, assigned_driver, year, next_inspection_due, notes, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            vehicle.id.to_string(),
            vehicle.license_plate,
            vehicle.make,
            vehicle.model,
            vehicle.vehicle_type,
            vehicle.fuel_type,
            vehicle.vin,
            vehicle.current_odometer,
            vehicle.assigned_driver,
            vehicle.year,
            vehicle.next_inspection_due,
            vehicle.notes,
            vehicle.status,
            vehicle.created_at,
        ],
    )?;
    Ok(())
}

/// Updates a vehicle.
pub fn update_vehicle(conn: &Connection, vehicle: &FleetVehicle) -> CoreResult<()> {
    vehicle.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE fleet_vehicles SET license_plate = ?2, make = ?3, model = ?4, vehicle_type = ?5,
            fuel_type = ?6, vin = ?7, current_odometer = ?8, assigned_driver = ?9, year = ?10,
            next_inspection_due = ?11, notes = ?12, status = ?13 WHERE id = ?1",
        params![
            vehicle.id.to_string(),
            vehicle.license_plate,
            vehicle.make,
            vehicle.model,
            vehicle.vehicle_type,
            vehicle.fuel_type,
            vehicle.vin,
            vehicle.current_odometer,
            vehicle.assigned_driver,
            vehicle.year,
            vehicle.next_inspection_due,
            vehicle.notes,
            vehicle.status,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(vehicle.id.to_string()));
    }
    Ok(())
}

/// Deletes a vehicle. Trips and receipts are kept, like the TypeScript module.
pub fn delete_vehicle(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM fleet_vehicles WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Lists all trips, newest first.
pub fn list_trips(conn: &Connection) -> CoreResult<Vec<FleetTrip>> {
    let sql =
        format!("SELECT {TRIP_COLUMNS} FROM fleet_trips ORDER BY created_at DESC, rowid DESC");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], trip_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Inserts a trip and lifts the odometer when the arrival value is higher.
pub fn insert_trip(conn: &Connection, trip: &FleetTrip) -> CoreResult<()> {
    trip.validate().map_err(CoreError::Validation)?;
    let transaction = conn.unchecked_transaction()?;
    transaction.execute(
        "INSERT INTO fleet_trips (id, vehicle_id, vehicle_plate, driver, date, start_time, end_time,
            start_location, end_location, purpose, reason, customer_name, start_km, end_km,
            distance_km, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            trip.id.to_string(),
            trip.vehicle_id.to_string(),
            trip.vehicle_plate,
            trip.driver,
            trip.date,
            trip.start_time,
            trip.end_time,
            trip.start_location,
            trip.end_location,
            trip.purpose,
            trip.reason,
            trip.customer_name,
            trip.start_km,
            trip.end_km,
            trip.distance_km,
            trip.notes,
            trip.created_at,
        ],
    )?;
    transaction.execute(
        "UPDATE fleet_vehicles SET current_odometer = ?2
         WHERE id = ?1 AND current_odometer < ?2",
        params![trip.vehicle_id.to_string(), trip.end_km],
    )?;
    transaction.commit()?;
    Ok(())
}

/// Updates a trip without touching the odometer.
pub fn update_trip(conn: &Connection, trip: &FleetTrip) -> CoreResult<()> {
    trip.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE fleet_trips SET vehicle_id = ?2, vehicle_plate = ?3, driver = ?4, date = ?5,
            start_time = ?6, end_time = ?7, start_location = ?8, end_location = ?9, purpose = ?10,
            reason = ?11, customer_name = ?12, start_km = ?13, end_km = ?14, distance_km = ?15,
            notes = ?16 WHERE id = ?1",
        params![
            trip.id.to_string(),
            trip.vehicle_id.to_string(),
            trip.vehicle_plate,
            trip.driver,
            trip.date,
            trip.start_time,
            trip.end_time,
            trip.start_location,
            trip.end_location,
            trip.purpose,
            trip.reason,
            trip.customer_name,
            trip.start_km,
            trip.end_km,
            trip.distance_km,
            trip.notes,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(trip.id.to_string()));
    }
    Ok(())
}

/// Deletes a trip.
pub fn delete_trip(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM fleet_trips WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}

/// Lists all fuel receipts, newest first.
pub fn list_fuel(conn: &Connection) -> CoreResult<Vec<FleetFuel>> {
    let sql = format!("SELECT {FUEL_COLUMNS} FROM fleet_fuel ORDER BY created_at DESC, rowid DESC");
    let mut statement = conn.prepare(&sql)?;
    let rows = statement.query_map([], fuel_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Inserts a receipt.
pub fn insert_fuel(conn: &Connection, entry: &FleetFuel) -> CoreResult<()> {
    entry.validate().map_err(CoreError::Validation)?;
    conn.execute(
        "INSERT INTO fleet_fuel (id, vehicle_id, vehicle_plate, date, odometer, units_milli,
            total_cost_cents, price_per_unit_milli, fuel_station, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            entry.id.to_string(),
            entry.vehicle_id.to_string(),
            entry.vehicle_plate,
            entry.date,
            entry.odometer,
            entry.units_milli,
            entry.total_cost_cents,
            entry.price_per_unit_milli,
            entry.fuel_station,
            entry.notes,
            entry.created_at,
        ],
    )?;
    Ok(())
}

/// Updates a receipt.
pub fn update_fuel(conn: &Connection, entry: &FleetFuel) -> CoreResult<()> {
    entry.validate().map_err(CoreError::Validation)?;
    let changed = conn.execute(
        "UPDATE fleet_fuel SET vehicle_id = ?2, vehicle_plate = ?3, date = ?4, odometer = ?5,
            units_milli = ?6, total_cost_cents = ?7, price_per_unit_milli = ?8,
            fuel_station = ?9, notes = ?10 WHERE id = ?1",
        params![
            entry.id.to_string(),
            entry.vehicle_id.to_string(),
            entry.vehicle_plate,
            entry.date,
            entry.odometer,
            entry.units_milli,
            entry.total_cost_cents,
            entry.price_per_unit_milli,
            entry.fuel_station,
            entry.notes,
        ],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(entry.id.to_string()));
    }
    Ok(())
}

/// Deletes a receipt.
pub fn delete_fuel(conn: &Connection, id: Uuid) -> CoreResult<()> {
    let changed = conn.execute(
        "DELETE FROM fleet_fuel WHERE id = ?1",
        params![id.to_string()],
    )?;
    if changed == 0 {
        return Err(CoreError::NotFound(id.to_string()));
    }
    Ok(())
}
