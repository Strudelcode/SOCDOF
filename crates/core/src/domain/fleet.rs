//! Fleet vehicles, the GoBD logbook and fuel records, ported from `FleetModule.tsx`.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Tax allowance per business kilometre, as in the TypeScript logbook (0.30 EUR).
pub const COST_PER_KM_CENTS: i64 = 30;

/// A vehicle of the fleet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FleetVehicle {
    /// Stable identifier.
    pub id: Uuid,
    /// Licence plate, stored uppercase.
    pub license_plate: String,
    /// Manufacturer.
    pub make: String,
    /// Model name.
    pub model: String,
    /// Body type (`car`, `van`, `truck`, `motorcycle`, `electric`).
    #[serde(rename = "type")]
    pub vehicle_type: String,
    /// Drive (`diesel`, `petrol`, `electric`, `hybrid`, `cng`).
    pub fuel_type: String,
    /// Vehicle identification number.
    pub vin: String,
    /// Current odometer in kilometres.
    pub current_odometer: i64,
    /// Regular driver.
    pub assigned_driver: String,
    /// Year of manufacture.
    pub year: Option<i64>,
    /// Next TÜV/HU date (`YYYY-MM-DD`), empty when unknown.
    pub next_inspection_due: String,
    /// Free-form notes.
    pub notes: String,
    /// `active`, `maintenance` or `retired`.
    pub status: String,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

impl FleetVehicle {
    /// Trims and uppercases the plate, trims the text fields.
    pub fn normalize(&mut self) {
        self.license_plate = self.license_plate.trim().to_uppercase();
        self.make = self.make.trim().to_string();
        self.model = self.model.trim().to_string();
        self.vin = self.vin.trim().to_string();
        self.assigned_driver = self.assigned_driver.trim().to_string();
        self.next_inspection_due = self.next_inspection_due.trim().to_string();
        self.notes = self.notes.trim().to_string();
        self.vehicle_type = self.vehicle_type.trim().to_lowercase();
        self.fuel_type = self.fuel_type.trim().to_lowercase();
        self.status = self.status.trim().to_lowercase();
    }

    /// Validates the fields the TypeScript modal requires and keeps the enumerations closed.
    pub fn validate(&self) -> Result<(), String> {
        if self.license_plate.trim().is_empty() {
            return Err("Kennzeichen ist erforderlich".to_string());
        }
        if self.make.trim().is_empty() {
            return Err("Hersteller ist erforderlich".to_string());
        }
        if !matches!(
            self.vehicle_type.as_str(),
            "car" | "van" | "truck" | "motorcycle" | "electric"
        ) {
            return Err(format!("Unbekannter Fahrzeugtyp: {}", self.vehicle_type));
        }
        if !matches!(
            self.fuel_type.as_str(),
            "diesel" | "petrol" | "electric" | "hybrid" | "cng"
        ) {
            return Err(format!("Unbekannter Antrieb: {}", self.fuel_type));
        }
        if !matches!(self.status.as_str(), "active" | "maintenance" | "retired") {
            return Err(format!("Unbekannter Fahrzeugstatus: {}", self.status));
        }
        if self.current_odometer < 0 {
            return Err("Kilometerstand darf nicht negativ sein".to_string());
        }
        if let Some(year) = self.year {
            if !(1900..=2100).contains(&year) {
                return Err("Baujahr liegt ausserhalb des gueltigen Bereichs".to_string());
            }
        }
        if !self.next_inspection_due.is_empty() && !is_iso_date(&self.next_inspection_due) {
            return Err("TÜV-Datum muss ein gueltiges Datum (YYYY-MM-DD) sein".to_string());
        }
        Ok(())
    }
}

/// One entry of the digital logbook.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FleetTrip {
    /// Stable identifier.
    pub id: Uuid,
    /// Vehicle used for the trip.
    pub vehicle_id: Uuid,
    /// Plate copied at creation time.
    pub vehicle_plate: String,
    /// Driver name.
    pub driver: String,
    /// Date (`YYYY-MM-DD`).
    pub date: String,
    /// Departure time (`HH:MM`).
    pub start_time: String,
    /// Arrival time (`HH:MM`).
    pub end_time: String,
    /// Start location.
    pub start_location: String,
    /// Destination.
    pub end_location: String,
    /// `business`, `private` or `commute`.
    #[serde(rename = "purposeType")]
    pub purpose: String,
    /// Reason of the trip.
    pub reason: String,
    /// Customer visited on the trip.
    pub customer_name: String,
    /// Odometer at departure.
    pub start_km: i64,
    /// Odometer at arrival.
    pub end_km: i64,
    /// Distance in kilometres.
    pub distance_km: i64,
    /// Free-form notes.
    pub notes: String,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

impl FleetTrip {
    /// Distance between start and end, never negative.
    pub fn distance(start_km: i64, end_km: i64) -> i64 {
        (end_km - start_km).max(0)
    }

    /// Tax allowance of the trip in cents (`0.30 EUR` per kilometre).
    pub fn allowance_cents(&self) -> i64 {
        self.distance_km * COST_PER_KM_CENTS
    }

    /// Validates the fields of the trip modal.
    pub fn validate(&self) -> Result<(), String> {
        if self.driver.trim().is_empty() {
            return Err("Fahrer ist erforderlich".to_string());
        }
        if !is_iso_date(&self.date) {
            return Err("Fahrtdatum muss ein gueltiges Datum (YYYY-MM-DD) sein".to_string());
        }
        if self.start_location.trim().is_empty() || self.end_location.trim().is_empty() {
            return Err("Start- und Zielort sind erforderlich".to_string());
        }
        if !matches!(self.purpose.as_str(), "business" | "private" | "commute") {
            return Err(format!("Unbekannte Fahrtart: {}", self.purpose));
        }
        if self.start_km < 0 || self.end_km < self.start_km {
            return Err("Endkilometerstand muss groesser oder gleich dem Start sein".to_string());
        }
        if self.distance_km <= 0 {
            return Err("Die Strecke muss groesser als 0 km sein".to_string());
        }
        if !is_time(&self.start_time) || !is_time(&self.end_time) {
            return Err("Zeiten muessen im Format HH:MM vorliegen".to_string());
        }
        Ok(())
    }
}

/// One fuel or charging receipt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FleetFuel {
    /// Stable identifier.
    pub id: Uuid,
    /// Vehicle the receipt belongs to.
    pub vehicle_id: Uuid,
    /// Plate copied at creation time.
    pub vehicle_plate: String,
    /// Date (`YYYY-MM-DD`).
    pub date: String,
    /// Odometer in kilometres.
    pub odometer: i64,
    /// Quantity in thousandths of a litre or kWh.
    pub units_milli: i64,
    /// Total amount in cents.
    pub total_cost_cents: i64,
    /// Price per unit in thousandths of a euro.
    pub price_per_unit_milli: i64,
    /// Petrol station or charging point.
    pub fuel_station: String,
    /// Free-form notes.
    pub notes: String,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
}

impl FleetFuel {
    /// Price per unit in thousandths of a euro, rounded like `toFixed(3)`.
    pub fn price_per_unit(total_cost_cents: i64, units_milli: i64) -> i64 {
        if units_milli <= 0 {
            return 0;
        }
        (total_cost_cents * 10_000 + units_milli / 2) / units_milli
    }

    /// Validates the fields of the receipt modal.
    pub fn validate(&self) -> Result<(), String> {
        if !is_iso_date(&self.date) {
            return Err("Belegdatum muss ein gueltiges Datum (YYYY-MM-DD) sein".to_string());
        }
        if self.odometer < 0 {
            return Err("Kilometerstand darf nicht negativ sein".to_string());
        }
        if self.units_milli <= 0 {
            return Err("Menge muss groesser als 0 sein".to_string());
        }
        if self.total_cost_cents < 0 {
            return Err("Gesamtbetrag darf nicht negativ sein".to_string());
        }
        Ok(())
    }
}

/// Aggregated values of the KPI strip and the analytics tab.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FleetMetrics {
    /// Sum of all filtered trips.
    pub total_km: i64,
    /// Business kilometres.
    pub business_km: i64,
    /// Private kilometres.
    pub private_km: i64,
    /// Commute kilometres.
    pub commute_km: i64,
    /// Business share in percent.
    pub business_pct: i64,
    /// Private share in percent.
    pub private_pct: i64,
    /// Commute share in percent.
    pub commute_pct: i64,
    /// Sum of all fuel receipts in cents.
    pub fuel_cost_cents: i64,
    /// Tax allowance of the business trips in cents.
    pub tax_allowance_cents: i64,
    /// Number of vehicles with status `active`.
    pub active_vehicles: i64,
}

/// Computes the KPI values exactly like the TypeScript `useMemo` block.
pub fn metrics(trips: &[FleetTrip], fuel: &[FleetFuel], vehicles: &[FleetVehicle]) -> FleetMetrics {
    let total_km: i64 = trips.iter().map(|trip| trip.distance_km).sum();
    let business_km: i64 = trips
        .iter()
        .filter(|trip| trip.purpose == "business")
        .map(|trip| trip.distance_km)
        .sum();
    let private_km: i64 = trips
        .iter()
        .filter(|trip| trip.purpose == "private")
        .map(|trip| trip.distance_km)
        .sum();
    let commute_km: i64 = trips
        .iter()
        .filter(|trip| trip.purpose == "commute")
        .map(|trip| trip.distance_km)
        .sum();
    let percentage = |part: i64| {
        if total_km > 0 {
            ((part as f64 / total_km as f64) * 100.0).round() as i64
        } else {
            0
        }
    };
    FleetMetrics {
        total_km,
        business_km,
        private_km,
        commute_km,
        business_pct: percentage(business_km),
        private_pct: percentage(private_km),
        commute_pct: percentage(commute_km),
        fuel_cost_cents: fuel.iter().map(|entry| entry.total_cost_cents).sum(),
        tax_allowance_cents: business_km * COST_PER_KM_CENTS,
        active_vehicles: vehicles
            .iter()
            .filter(|vehicle| vehicle.status == "active")
            .count() as i64,
    }
}

/// Escapes one CSV field with the `;` separator and the TypeScript quoting rules.
fn csv_field(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

/// GoBD logbook CSV, including the UTF-8 BOM the TypeScript export writes.
pub fn csv(trips: &[FleetTrip]) -> String {
    let headers = [
        "Datum",
        "Uhrzeit",
        "Fahrzeug",
        "Fahrer",
        "Startort",
        "Zielort",
        "Anlass / Grund",
        "Kunde",
        "Art",
        "Start-km",
        "End-km",
        "Gefahrene km",
        "Pauschale (0.30€)",
    ];
    let mut lines = vec![headers.join(";")];
    for trip in trips {
        let purpose = match trip.purpose.as_str() {
            "business" => "Dienstfahrt",
            "private" => "Privatfahrt",
            _ => "Arbeitsweg",
        };
        lines.push(format!(
            "{};{};{};{};{};{};{};{};{};{};{};{};{:.2}",
            trip.date,
            csv_field(&format!("{} - {}", trip.start_time, trip.end_time)),
            csv_field(&trip.vehicle_plate),
            csv_field(&trip.driver),
            csv_field(&trip.start_location),
            csv_field(&trip.end_location),
            csv_field(&trip.reason),
            csv_field(&trip.customer_name),
            purpose,
            trip.start_km,
            trip.end_km,
            trip.distance_km,
            trip.distance_km as f64 * 0.30
        ));
    }
    format!("\u{feff}{}", lines.join("\n"))
}

/// Suggested CSV file name of the logbook.
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
    format!("Fahrtenbuch_{safe}_{year:04}-{month:02}-{day:02}.csv")
}

fn is_iso_date(text: &str) -> bool {
    let text = text.trim();
    if text.len() != 10 {
        return false;
    }
    let mut parts = text.split('-');
    let (Some(year), Some(month), Some(day), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return false;
    };
    let (Ok(year), Ok(month), Ok(day)) = (
        year.parse::<i64>(),
        month.parse::<u32>(),
        day.parse::<u32>(),
    ) else {
        return false;
    };
    if !(1900..=2100).contains(&year) || !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return false;
    }
    let days = crate::date::days_from_civil(year, month, day);
    crate::date::civil_from_millis(days * 86_400_000) == (year, month, day)
}

fn is_time(text: &str) -> bool {
    let text = text.trim();
    let Some((hours, minutes)) = text.split_once(':') else {
        return false;
    };
    matches!((hours.parse::<u32>(), minutes.parse::<u32>()), (Ok(h), Ok(m)) if h < 24 && m < 60)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vehicle(id: Uuid) -> FleetVehicle {
        FleetVehicle {
            id,
            license_plate: "M-SO 2026".to_string(),
            make: "VW".to_string(),
            model: "ID.4".to_string(),
            vehicle_type: "electric".to_string(),
            fuel_type: "electric".to_string(),
            vin: "WVWZZZ".to_string(),
            current_odometer: 12_000,
            assigned_driver: "Meyer".to_string(),
            year: Some(2024),
            next_inspection_due: "2027-06-01".to_string(),
            notes: String::new(),
            status: "active".to_string(),
            created_at: 1_760_000_000_000,
        }
    }

    fn trip(id: Uuid, vehicle_id: Uuid, purpose: &str, km: i64) -> FleetTrip {
        FleetTrip {
            id,
            vehicle_id,
            vehicle_plate: "M-SO 2026".to_string(),
            driver: "Meyer".to_string(),
            date: "2026-11-11".to_string(),
            start_time: "08:30".to_string(),
            end_time: "09:30".to_string(),
            start_location: "Berlin".to_string(),
            end_location: "Potsdam".to_string(),
            purpose: purpose.to_string(),
            reason: "Kundentermin".to_string(),
            customer_name: "Beispiel GmbH".to_string(),
            start_km: 12_000,
            end_km: 12_000 + km,
            distance_km: km,
            notes: String::new(),
            created_at: 1_760_000_000_000,
        }
    }

    #[test]
    fn validates_the_modal_fields_and_normalizes_the_plate() {
        let mut vehicle = vehicle(Uuid::nil());
        vehicle.license_plate = "  m-so 2026 ".to_string();
        vehicle.normalize();
        assert_eq!(vehicle.license_plate, "M-SO 2026");
        assert!(vehicle.validate().is_ok());

        let mut invalid = vehicle.clone();
        invalid.license_plate.clear();
        assert!(invalid.validate().is_err());
        let mut invalid = vehicle.clone();
        invalid.status = "unknown".to_string();
        assert!(invalid.validate().is_err());
        let mut invalid = vehicle.clone();
        invalid.next_inspection_due = "2026-02-31".to_string();
        assert!(invalid.validate().is_err());

        let mut trip = trip(Uuid::nil(), Uuid::nil(), "business", 30);
        assert!(trip.validate().is_ok());
        trip.end_km = trip.start_km;
        trip.distance_km = 0;
        assert!(trip.validate().is_err());
        trip.distance_km = 10;
        trip.purpose = "holiday".to_string();
        assert!(trip.validate().is_err());
    }

    #[test]
    fn computes_distance_price_metrics_and_csv() {
        let vehicle = vehicle(Uuid::nil());
        let trips = vec![
            trip(Uuid::new_v4(), vehicle.id, "business", 30),
            trip(Uuid::new_v4(), vehicle.id, "private", 10),
            trip(Uuid::new_v4(), vehicle.id, "commute", 60),
        ];
        let fuel = vec![FleetFuel {
            id: Uuid::new_v4(),
            vehicle_id: vehicle.id,
            vehicle_plate: vehicle.license_plate.clone(),
            date: "2026-11-11".to_string(),
            odometer: 12_100,
            units_milli: 40_000,
            total_cost_cents: 8_000,
            price_per_unit_milli: FleetFuel::price_per_unit(8_000, 40_000),
            fuel_station: "Test".to_string(),
            notes: String::new(),
            created_at: 0,
        }];
        let metrics = metrics(&trips, &fuel, std::slice::from_ref(&vehicle));
        assert_eq!(metrics.total_km, 100);
        assert_eq!(metrics.business_km, 30);
        assert_eq!(metrics.private_km, 10);
        assert_eq!(metrics.commute_km, 60);
        assert_eq!(metrics.business_pct, 30);
        assert_eq!(metrics.private_pct, 10);
        assert_eq!(metrics.commute_pct, 60);
        assert_eq!(metrics.fuel_cost_cents, 8_000);
        assert_eq!(metrics.tax_allowance_cents, 900);
        assert_eq!(metrics.active_vehicles, 1);
        assert_eq!(FleetFuel::price_per_unit(8_000, 40_000), 2_000);

        let csv = csv(&trips);
        assert!(csv.starts_with("\u{feff}Datum;Uhrzeit;Fahrzeug"));
        assert!(csv.contains("\"Berlin\";\"Potsdam\""));
        assert!(csv.contains("Dienstfahrt"));
        assert!(csv.contains("9.00"));
        assert!(csv_file_name("Beispiel GmbH", 1_760_000_000_000)
            .starts_with("Fahrtenbuch_Beispiel_GmbH_"));
        assert_eq!(FleetTrip::distance(100, 90), 0);
    }
}
