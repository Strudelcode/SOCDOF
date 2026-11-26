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
 * Validates and normalizes raw parsed JSON or universal mobile export into a valid MobileCompanionSyncPayload
 */
export function validateMobilePayload(raw: unknown): { isValid: boolean; error?: string; data?: MobileCompanionSyncPayload } {
  if (!raw) {
    return { isValid: false, error: 'Ungültiges Datenformat: Leere Daten übermittelt.' };
  }

  let obj: Record<string, any> = {};

  // If passed an array directly
  if (Array.isArray(raw)) {
    obj = { sessions: raw };
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, any>;
    // Check if payload is wrapped inside data/payload/export
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      obj = { ...obj, ...obj.data };
    } else if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
      obj = { ...obj, ...obj.payload };
    } else if (obj.export && typeof obj.export === 'object' && !Array.isArray(obj.export)) {
      obj = { ...obj, ...obj.export };
    }
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return validateMobilePayload(parsed);
    } catch {
      // Create a ticket from text lines
      const textLines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      return {
        isValid: true,
        data: {
          protocol: 'SOCDOF_MOBILE_COMPANION_V1',
          exportTimestamp: new Date().toISOString(),
          appName: 'Text / Raw Import',
          tickets: [{
            id: `text_import_${Date.now()}`,
            ticket_number: `IMP-${Date.now().toString().slice(-4)}`,
            title: textLines[0] || 'Mobiler Notiz-Import',
            description: raw,
            customer_name: 'Mobiler Direktimport',
            status: 'in_progress',
            priority: 1,
            team: 'Kundendienst & Außendienst',
            assigned_staff: 'Außendienst',
            created_at: new Date().toISOString(),
            timesheets: [{
              id: `ts_${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              staff: 'Außendienst',
              description: textLines[0] || 'Mobiler Import',
              hours: 1,
              hourly_rate: 65,
              billable: true
            }]
          }]
        }
      };
    }
  }

  const tickets: MobileCompanionTicketItem[] = [];
  const standalone_timesheets: MobileCompanionTimesheetItem[] = [];
  const standalone_expenses: MobileCompanionExpenseItem[] = [];

  // Look for sessions under various keys (sessions, records, items, time_entries, entries, logs, work_logs)
  const rawSessions: any[] = Array.isArray(obj.sessions) ? obj.sessions :
                             Array.isArray(obj.records) ? obj.records :
                             Array.isArray(obj.items) ? obj.items :
                             Array.isArray(obj.time_entries) ? obj.time_entries :
                             Array.isArray(obj.entries) ? obj.entries :
                             Array.isArray(obj.logs) ? obj.logs :
                             Array.isArray(obj.work_logs) ? obj.work_logs : [];

  const rawTrips: any[] = Array.isArray(obj.trips) ? obj.trips :
                          Array.isArray(obj.fahrten) ? obj.fahrten :
                          Array.isArray(obj.gps_routes) ? obj.gps_routes : [];

  const rawCustomers: any[] = Array.isArray(obj.customers) ? obj.customers :
                              Array.isArray(obj.kunden) ? obj.kunden :
                              Array.isArray(obj.contacts) ? obj.contacts : [];

  // 1. Process Mobile Sessions (from TimeTracking structure)
  if (rawSessions.length > 0) {
    rawSessions.forEach((session, index) => {
      const customerName = session.customerName || session.customer || session.kunde || session.company || session.client || 'Kunde';
      const customer = rawCustomers.find(c => c.id === session.customerId || c.companyName === customerName || c.name === customerName);
      
      // Build Description Notes
      let noteParts: string[] = [];
      let expensesList: MobileCompanionExpenseItem[] = [];

      if (session.notes && typeof session.notes === 'object') {
        const n = session.notes as MobileSessionNotes;
        if (n.task) noteParts.push(`📌 **Auftrag:** ${n.task}`);
        if (n.objective) noteParts.push(`🎯 **Ziel:** ${n.objective}`);
        if (n.onSiteReport) noteParts.push(`📝 **Tätigkeitsbericht vor Ort:**\n${n.onSiteReport}`);
        if (n.materialAndExpenses) {
          noteParts.push(`🛠️ **Material & Spesen:** ${n.materialAndExpenses}`);
          expensesList.push({
            id: `exp_${session.id || index}_${Date.now()}`,
            date: session.date || new Date().toISOString().split('T')[0],
            title: n.materialAndExpenses,
            amount: Number(session.materialCost || session.expenseAmount || 0),
            category: 'material',
            notes: n.materialAndExpenses,
            billable: true
          });
        }
        if (n.remarks) noteParts.push(`ℹ️ **Besonderheiten & Abnahme:** ${n.remarks}`);
      } else if (typeof session.notes === 'string' && session.notes.trim()) {
        noteParts.push(session.notes);
      } else if (session.description || session.beschreibung || session.memo) {
        noteParts.push(session.description || session.beschreibung || session.memo);
      }

      // Check matching trips
      const matchingTrips = rawTrips.filter(t => 
        (t.customerId && t.customerId === session.customerId) || 
        (t.customerName && t.customerName === customerName) ||
        (t.date && session.date && t.date === session.date)
      );

      const totalTripKm = matchingTrips.reduce((acc, t) => acc + (Number(t.distanceKm || t.km || t.distance) || 0), 0);
      const firstTrip = matchingTrips[0];

      // Calculate hours
      let hours = 0;
      if (typeof session.durationMinutes === 'number') {
        hours = session.durationMinutes / 60;
      } else if (typeof session.durationSeconds === 'number') {
        hours = session.durationSeconds / 3600;
      } else if (typeof session.hours === 'number') {
        hours = session.hours;
      } else if (typeof session.duration === 'number') {
        hours = session.duration > 20 ? session.duration / 60 : session.duration;
      } else if (session.startTime && session.endTime) {
        const diffMs = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
        if (diffMs > 0) hours = diffMs / (1000 * 60 * 60);
      }
      if (hours <= 0) hours = 1; // Minimum 1h fallback

      const timesheet: MobileCompanionTimesheetItem = {
        id: `ts_${session.id || index}_${Date.now()}`,
        date: session.date || session.datum || new Date().toISOString().split('T')[0],
        staff: session.staff || session.mitarbeiter || session.user || 'Mobile Außendienst',
        description: session.title || session.name || session.titel || 'Vor-Ort Einsatz',
        hours: Number(hours.toFixed(2)),
        hourly_rate: session.hourlyRate || session.rate || customer?.customHourlyRate || 65,
        billable: session.billable !== false,
        started_at: session.startTime || session.start,
        ended_at: session.endTime || session.end,
        travel_km: Number(session.kilometers || session.km || totalTripKm || 0),
        location_name: firstTrip?.endLocation || session.location || (customer ? `${customer.street || ''}, ${customer.zipCity || ''}`.trim() : undefined),
        geo_latitude: customer?.latitude || session.latitude,
        geo_longitude: customer?.longitude || session.longitude
      };

      // Add trip expenses
      matchingTrips.forEach(trip => {
        const tripCost = Number(trip.calculatedCost || trip.cost || 0);
        if (tripCost > 0) {
          expensesList.push({
            id: `exp_trip_${trip.id || Math.random().toString(36).slice(2)}`,
            date: trip.date || session.date || new Date().toISOString().split('T')[0],
            title: `Fahrtkosten (${trip.distanceKm || trip.km || 0} km, ${trip.startLocation || 'Start'} ➔ ${trip.endLocation || 'Ziel'})`,
            amount: tripCost,
            category: 'travel',
            notes: trip.notes || `Fahrtzeit: ${trip.durationMinutes || 0} Min.`,
            billable: true
          });
        }
      });

      const fullDescription = noteParts.length > 0 ? noteParts.join('\n\n') : (session.title || 'Mobiler Einsatzbericht');

      const ticketItem: MobileCompanionTicketItem = {
        id: `mob_sess_${session.id || index}_${Date.now()}`,
        ticket_number: `MOB-${session.id || String(index + 101).padStart(3, '0')}`,
        title: session.title || session.name || session.titel || `Einsatz bei ${customerName}`,
        customer_name: customerName,
        customer_email: customer?.email || session.customerEmail || session.email,
        customer_phone: customer?.phone || session.customerPhone || session.phone,
        customer_company: customer?.companyName || session.customerCompany || customerName,
        customer_address: customer ? `${customer.street || ''}, ${customer.zipCity || ''}`.trim() : session.address,
        description: fullDescription,
        status: 'in_progress',
        priority: session.priority !== undefined ? Number(session.priority) as any : 1,
        team: 'Kundendienst & Außendienst',
        assigned_staff: session.staff || session.mitarbeiter || 'Außendienst',
        created_at: session.startTime || session.date || new Date().toISOString(),
        location_name: firstTrip?.endLocation || session.location || (customer ? `${customer.street || ''}, ${customer.zipCity || ''}`.trim() : undefined),
        geo_latitude: customer?.latitude || session.latitude,
        geo_longitude: customer?.longitude || session.longitude,
        travel_km: totalTripKm || session.kilometers || session.km || 0,
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

  // If still empty but obj has at least some identifiable content, wrap as single ticket
  if (tickets.length === 0 && standalone_timesheets.length === 0 && standalone_expenses.length === 0 && rawTrips.length === 0) {
    if (obj.title || obj.name || obj.titel || obj.customer || obj.kunde || obj.description || obj.message) {
      tickets.push({
        id: `mob_single_${Date.now()}`,
        ticket_number: `MOB-${Math.floor(100 + Math.random() * 900)}`,
        title: obj.title || obj.name || obj.titel || 'Mobiler Service-Einsatz',
        customer_name: obj.customer || obj.kunde || obj.client || 'Kunde',
        description: obj.description || obj.notes || obj.message || JSON.stringify(obj, null, 2),
        status: 'in_progress',
        priority: 1,
        team: 'Kundendienst & Außendienst',
        assigned_staff: 'Außendienst',
        created_at: obj.date || new Date().toISOString(),
        timesheets: [{
          id: `ts_${Date.now()}`,
          date: obj.date || new Date().toISOString().split('T')[0],
          staff: 'Außendienst',
          description: obj.title || 'Mobiler Vor-Ort Einsatz',
          hours: Number(obj.hours || obj.durationMinutes ? obj.durationMinutes / 60 : 1),
          hourly_rate: 65,
          billable: true
        }]
      });
    } else {
      return { isValid: false, error: 'Keine verwertbaren Datensätze im übermittelten Format gefunden.' };
    }
  }

  const payload: MobileCompanionSyncPayload = {
    protocol: 'SOCDOF_MOBILE_COMPANION_V1',
    export_version: obj.exportVersion || obj.export_version || '1.0',
    exportTimestamp: obj.exportTimestamp || obj.exported_at || new Date().toISOString(),
    appName: obj.appName || obj.app_name || 'SOCDOF Mobile Companion',
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
