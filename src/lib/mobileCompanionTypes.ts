/**
 * Mobile Companion Payload Types and Validation for SOCDOF
 * 
 * Supports:
 * - Mobile Companion Payload Structure (sessions, trips, customers, 5 note fields)
 * - Direct QR-Code Payload (JSON format)
 * - Automatic conversion into SOCDOF Support Tickets, Timesheets, Travel/GPS & Expenses
 * - Duplicate Detection & Deduplication
 * - Date Range Filter
 */

export interface MobileSessionNotes {
  task?: string;
  objective?: string;
  onSiteReport?: string;
  materialAndExpenses?: string;
  remarks?: string;
}

export interface MobileSessionItem {
  id: number | string;
  date: string;
  customerId?: number | string;
  customerName?: string;
  title: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  durationSeconds?: number;
  pauseDurationMinutes?: number;
  kilometers?: number;
  hourlyRate?: number;
  calculatedCost?: number;
  notes?: MobileSessionNotes | string;
}

export interface MobileTripItem {
  id: number | string;
  date: string;
  customerId?: number | string;
  customerName?: string;
  startLocation?: string;
  endLocation?: string;
  distanceKm?: number;
  durationMinutes?: number;
  standstillMinutes?: number;
  wasStandstillDetected?: boolean;
  isFlatRateOnly?: boolean;
  flatRate?: number;
  costRatePerKm?: number;
  calculatedCost?: number;
  notes?: string;
}

export interface MobileCustomerItem {
  id: number | string;
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  street?: string;
  zipCity?: string;
  customHourlyRate?: number;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
}

export interface MobileCompanionTimesheetItem {
  id?: string;
  ticket_id?: string;
  ticket_number?: string;
  date: string;
  staff: string;
  description: string;
  hours: number;
  hourly_rate?: number;
  billable?: boolean;
  started_at?: string;
  ended_at?: string;
  travel_km?: number;
  location_name?: string;
  geo_latitude?: number;
  geo_longitude?: number;
}

export interface MobileCompanionExpenseItem {
  id?: string;
  ticket_id?: string;
  ticket_number?: string;
  date: string;
  title: string;
  amount: number;
  category?: 'travel' | 'food' | 'material' | 'parking' | 'toll' | 'other';
  notes?: string;
  billable?: boolean;
}

export interface MobileCompanionTicketItem {
  id?: string;
  ticket_number?: string;
  title: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_company?: string;
  customer_address?: string;
  description?: string;
  priority?: 0 | 1 | 2 | 3;
  status?: 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  team?: string;
  assigned_staff?: string;
  created_at?: string;
  location_name?: string;
  geo_latitude?: number;
  geo_longitude?: number;
  travel_km?: number;
  timesheets?: MobileCompanionTimesheetItem[];
  expenses?: MobileCompanionExpenseItem[];
  voice_notes?: Array<{
    id?: string;
    author?: string;
    text_transcript?: string;
    created_at?: string;
  }>;
}

export interface MobileCompanionSyncPayload {
  protocol: 'SOCDOF_MOBILE_COMPANION_V1' | string;
  export_version?: string;
  exportVersion?: string;
  exported_at?: string;
  exportTimestamp?: string;
  app_name?: string;
  appName?: string;
  app_version?: string;
  device_name?: string;
  deviceId?: string;
  exportFilter?: string;
  summary?: {
    totalSessions?: number;
    totalTrips?: number;
    totalCustomers?: number;
    totalWorkDurationMinutes?: number;
    totalWorkHours?: number;
    totalKilometers?: number;
    totalCalculatedCost?: number;
    currency?: string;
  };
  date_range?: {
    from?: string;
    to?: string;
  };
  tickets: MobileCompanionTicketItem[];
  standalone_timesheets?: MobileCompanionTimesheetItem[];
  standalone_expenses?: MobileCompanionExpenseItem[];
  raw_sessions?: MobileSessionItem[];
  raw_trips?: MobileTripItem[];
  raw_customers?: MobileCustomerItem[];
}

/**
 * Validates and normalizes raw parsed JSON into a valid MobileCompanionSyncPayload
 */
export function validateMobilePayload(raw: unknown): { isValid: boolean; error?: string; data?: MobileCompanionSyncPayload } {
  if (!raw || typeof raw !== 'object') {
    return { isValid: false, error: 'Ungültiges Datenformat: Kein JSON-Objekt.' };
  }

  const obj = raw as Record<string, any>;
  const tickets: MobileCompanionTicketItem[] = [];
  const standalone_timesheets: MobileCompanionTimesheetItem[] = [];
  const standalone_expenses: MobileCompanionExpenseItem[] = [];

  const rawSessions: MobileSessionItem[] = Array.isArray(obj.sessions) ? obj.sessions : [];
  const rawTrips: MobileTripItem[] = Array.isArray(obj.trips) ? obj.trips : [];
  const rawCustomers: MobileCustomerItem[] = Array.isArray(obj.customers) ? obj.customers : [];

  // 1. Process Mobile Sessions (from new TimeTracking structure)
  if (rawSessions.length > 0) {
    rawSessions.forEach((session) => {
      const customer = rawCustomers.find(c => c.id === session.customerId || c.companyName === session.customerName);
      
      // Build 5-Part Description Notes
      let noteParts: string[] = [];
      let expensesList: MobileCompanionExpenseItem[] = [];

      if (session.notes && typeof session.notes === 'object') {
        const n = session.notes as MobileSessionNotes;
        if (n.task) noteParts.push(`📌 **Auftrag:** ${n.task}`);
        if (n.objective) noteParts.push(`🎯 **Ziel:** ${n.objective}`);
        if (n.onSiteReport) noteParts.push(`📝 **Tätigkeitsbericht vor Ort:**\n${n.onSiteReport}`);
        if (n.materialAndExpenses) {
          noteParts.push(`🛠️ **Material & Spesen:** ${n.materialAndExpenses}`);
          
          // Check if there is a monetary amount mentioned or create an expense item
          const expenseItem: MobileCompanionExpenseItem = {
            id: `exp_${session.id}_${Date.now()}`,
            date: session.date || new Date().toISOString().split('T')[0],
            title: n.materialAndExpenses,
            amount: 0, // Fallback if not specified separately
            category: 'material',
            notes: n.materialAndExpenses,
            billable: true
          };
          expensesList.push(expenseItem);
        }
        if (n.remarks) noteParts.push(`ℹ️ **Besonderheiten & Abnahme:** ${n.remarks}`);
      } else if (typeof session.notes === 'string' && session.notes.trim()) {
        noteParts.push(session.notes);
      }

      // Check matching trips for this session/customer on the same date
      const matchingTrips = rawTrips.filter(t => 
        (t.customerId && t.customerId === session.customerId) || 
        (t.customerName && t.customerName === session.customerName) ||
        (t.date === session.date)
      );

      const totalTripKm = matchingTrips.reduce((acc, t) => acc + (Number(t.distanceKm) || 0), 0);
      const firstTrip = matchingTrips[0];

      // Build timesheet entry from session duration
      const hours = session.durationMinutes ? session.durationMinutes / 60 : (session.durationSeconds ? session.durationSeconds / 3600 : 0);
      const timesheet: MobileCompanionTimesheetItem = {
        id: `ts_${session.id}`,
        date: session.date,
        staff: 'Mobile Außendienst',
        description: session.title || 'Vor-Ort Einsatz',
        hours: Number(hours.toFixed(2)),
        hourly_rate: session.hourlyRate || customer?.customHourlyRate || 65,
        billable: true,
        started_at: session.startTime,
        ended_at: session.endTime,
        travel_km: session.kilometers || totalTripKm || 0,
        location_name: firstTrip?.endLocation || (customer ? `${customer.street || ''}, ${customer.zipCity || ''}`.trim() : undefined),
        geo_latitude: customer?.latitude,
        geo_longitude: customer?.longitude
      };

      // Add trip cost expenses if any
      matchingTrips.forEach(trip => {
        if (trip.calculatedCost && trip.calculatedCost > 0) {
          expensesList.push({
            id: `exp_trip_${trip.id}`,
            date: trip.date,
            title: `Fahrtkosten (${trip.distanceKm || 0} km, ${trip.startLocation || 'Start'} ➔ ${trip.endLocation || 'Ziel'})`,
            amount: trip.calculatedCost,
            category: 'travel',
            notes: trip.notes || `Fahrtzeit: ${trip.durationMinutes || 0} Min.${trip.wasStandstillDetected ? ` (Stau: ${trip.standstillMinutes} Min.)` : ''}`,
            billable: true
          });
        }
      });

      const fullDescription = noteParts.length > 0 ? noteParts.join('\n\n') : (session.title || 'Keine detaillierten Notizen erfasst.');

      const ticketItem: MobileCompanionTicketItem = {
        id: `mob_sess_${session.id}`,
        ticket_number: `MOB-${session.id}`,
        title: session.title || `Einsatz bei ${session.customerName || 'Kunde'}`,
        customer_name: session.customerName || customer?.companyName || 'Unbekannter Kunde',
        customer_email: customer?.email,
        customer_phone: customer?.phone,
        customer_company: customer?.companyName,
        customer_address: customer ? `${customer.street || ''}, ${customer.zipCity || ''}`.trim() : undefined,
        description: fullDescription,
        status: 'in_progress',
        priority: 1,
        team: 'Kundendienst & Außendienst',
        assigned_staff: 'Außendienst',
        created_at: session.startTime || session.date || new Date().toISOString(),
        location_name: firstTrip?.endLocation || (customer ? `${customer.street || ''}, ${customer.zipCity || ''}`.trim() : undefined),
        geo_latitude: customer?.latitude,
        geo_longitude: customer?.longitude,
        travel_km: totalTripKm || session.kilometers || 0,
        timesheets: [timesheet],
        expenses: expensesList
      };

      tickets.push(ticketItem);
    });
  }

  // 2. Direct tickets / legacy companion format support
  if (Array.isArray(obj.tickets)) {
    tickets.push(...obj.tickets);
  }

  if (Array.isArray(obj.standalone_timesheets)) {
    standalone_timesheets.push(...obj.standalone_timesheets);
  }

  if (Array.isArray(obj.standalone_expenses)) {
    standalone_expenses.push(...obj.standalone_expenses);
  }

  if (tickets.length === 0 && standalone_timesheets.length === 0 && standalone_expenses.length === 0 && rawTrips.length === 0) {
    return { isValid: false, error: 'Keine Datensätze (Einsätze, Zeiten, Fahrten oder Kunden) im Payload gefunden.' };
  }

  const payload: MobileCompanionSyncPayload = {
    protocol: 'SOCDOF_MOBILE_COMPANION_V1',
    export_version: obj.exportVersion || obj.export_version || '1.0',
    exportTimestamp: obj.exportTimestamp || obj.exported_at || new Date().toISOString(),
    appName: obj.appName || obj.app_name || 'SOCDOF TimeTracking Mobile',
    deviceId: obj.deviceId || obj.device_name || 'Mobile Device',
    exportFilter: obj.exportFilter,
    summary: obj.summary,
    date_range: obj.date_range,
    tickets,
    standalone_timesheets,
    standalone_expenses,
    raw_sessions: rawSessions,
    raw_trips: rawTrips,
    raw_customers: rawCustomers
  };

  return { isValid: true, data: payload };
}
