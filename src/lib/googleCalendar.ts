import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { CalendarAppEvent, GoogleCalendarItem, Invoice } from '../types';

// 1. Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// 2. Configure Google Provider with required Calendar scopes
export const googleCalendarProvider = new GoogleAuthProvider();
googleCalendarProvider.addScope('https://www.googleapis.com/auth/calendar');
googleCalendarProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleCalendarProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
googleCalendarProvider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

// 3. In-memory access token cache
let cachedAccessToken: string | null = null;
let currentGoogleUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
} | null = null;

// Auth state listeners
type AuthChangeListener = (user: typeof currentGoogleUser, token: string | null) => void;
const authListeners: Set<AuthChangeListener> = new Set();

export const subscribeToGoogleAuth = (listener: AuthChangeListener) => {
  authListeners.add(listener);
  listener(currentGoogleUser, cachedAccessToken);
  return () => {
    authListeners.delete(listener);
  };
};

const notifyAuthListeners = () => {
  authListeners.forEach(listener => listener(currentGoogleUser, cachedAccessToken));
};

// Sync status event listeners
type SyncStatusListener = (status: {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  eventCount: number;
}) => void;

let syncStatus = {
  isSyncing: false,
  lastSyncedAt: typeof localStorage !== 'undefined' ? localStorage.getItem('odoo_gcal_last_sync') : null,
  error: null as string | null,
  eventCount: 0
};

const syncListeners: Set<SyncStatusListener> = new Set();

export const subscribeToSyncStatus = (listener: SyncStatusListener) => {
  syncListeners.add(listener);
  listener(syncStatus);
  return () => {
    syncListeners.delete(listener);
  };
};

const updateSyncStatus = (patch: Partial<typeof syncStatus>) => {
  syncStatus = { ...syncStatus, ...patch };
  if (patch.lastSyncedAt) {
    try {
      localStorage.setItem('odoo_gcal_last_sync', patch.lastSyncedAt);
    } catch {}
  }
  syncListeners.forEach(l => l(syncStatus));
};

// Listen to Firebase Auth state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentGoogleUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
    try {
      localStorage.setItem('odoo_gcal_user_meta', JSON.stringify(currentGoogleUser));
    } catch {}
  } else {
    currentGoogleUser = null;
    cachedAccessToken = null;
    try {
      localStorage.removeItem('odoo_gcal_user_meta');
    } catch {}
  }
  notifyAuthListeners();
});

// Restore saved meta for fast UI rendering
export const getCachedGoogleUserMeta = () => {
  if (currentGoogleUser) return currentGoogleUser;
  try {
    const saved = localStorage.getItem('odoo_gcal_user_meta');
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
};

// Get current Access Token
export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Google Sign-In with popup
export const signInWithGoogleCalendar = async (): Promise<{ user: User; accessToken: string | null }> => {
  try {
    updateSyncStatus({ error: null });
    const result = await signInWithPopup(auth, googleCalendarProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || null;
    
    if (token) {
      cachedAccessToken = token;
    }
    
    currentGoogleUser = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL
    };
    try {
      localStorage.setItem('odoo_gcal_user_meta', JSON.stringify(currentGoogleUser));
    } catch {}

    notifyAuthListeners();
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('Google Sign-In failed:', error);
    updateSyncStatus({ error: error.message || 'Google Sign-In failed' });
    throw error;
  }
};

// Google Sign-Out
export const signOutGoogleCalendar = async (): Promise<void> => {
  try {
    await signOut(auth);
    cachedAccessToken = null;
    currentGoogleUser = null;
    try {
      localStorage.removeItem('odoo_gcal_user_meta');
      localStorage.removeItem('odoo_gcal_events_cache');
    } catch {}
    notifyAuthListeners();
    updateSyncStatus({ eventCount: 0, error: null });
  } catch (error) {
    console.error('Google Sign-Out failed:', error);
    throw error;
  }
};

// -------------------------------------------------------------
// Timezone-Safe Local Date Utilities
// -------------------------------------------------------------

export const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0])) return new Date();
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
};

export const isSameCalendarDay = (d1: Date, d2: Date): boolean => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const isEventOnDate = (event: CalendarAppEvent, dateStr: string): boolean => {
  const start = event.startDate;
  const end = event.endDate || event.startDate;
  return dateStr >= start && dateStr <= end;
};

// -------------------------------------------------------------
// Google Calendar REST API Client
// -------------------------------------------------------------

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// 1. Fetch user's Google Calendars list
export const fetchGoogleCalendarsList = async (token?: string): Promise<GoogleCalendarItem[]> => {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error('Google Calendar access token is missing. Please sign in with Google.');
  }

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${activeToken}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to fetch calendars (${response.status})`);
  }

  const data = await response.json();
  const items: GoogleCalendarItem[] = (data.items || []).map((cal: any) => ({
    id: cal.id,
    summary: cal.summary || 'Unbenannter Kalender',
    description: cal.description || '',
    primary: Boolean(cal.primary),
    backgroundColor: cal.backgroundColor || '#4f46e5',
    foregroundColor: cal.foregroundColor || '#ffffff',
    accessRole: cal.accessRole || 'reader',
    selected: Boolean(cal.selected)
  }));

  // Cache calendars
  try {
    localStorage.setItem('odoo_gcal_list_cache', JSON.stringify(items));
  } catch {}

  return items;
};

// 2. Fetch Events from a specific Google Calendar
export const fetchGoogleCalendarEvents = async (
  calendarId: string = 'primary',
  options?: { timeMin?: string; timeMax?: string; maxResults?: number },
  token?: string
): Promise<CalendarAppEvent[]> => {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    // Return cached events if offline
    return getCachedGoogleEvents();
  }

  const now = new Date();
  // Default range: 3 months back to 6 months forward
  const defaultMin = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
  const defaultMax = new Date(now.getFullYear(), now.getMonth() + 7, 0).toISOString();

  const timeMin = options?.timeMin || defaultMin;
  const timeMax = options?.timeMax || defaultMax;
  const maxResults = options?.maxResults || 250;

  const url = new URL(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('maxResults', maxResults.toString());

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${activeToken}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to fetch events (${response.status})`);
  }

  const data = await response.json();
  const events: CalendarAppEvent[] = (data.items || []).map((item: any) => {
    const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
    
    let startDate = '';
    let startTime = '';
    let endDate = '';
    let endTime = '';

    if (isAllDay) {
      startDate = (item.start?.date || '').slice(0, 10);
      endDate = (item.end?.date || startDate).slice(0, 10);
    } else {
      if (item.start?.dateTime) {
        const sDate = new Date(item.start.dateTime);
        if (!isNaN(sDate.getTime())) {
          startDate = formatLocalDate(sDate);
          startTime = `${String(sDate.getHours()).padStart(2, '0')}:${String(sDate.getMinutes()).padStart(2, '0')}`;
        } else {
          startDate = item.start.dateTime.slice(0, 10);
        }
      }
      if (item.end?.dateTime) {
        const eDate = new Date(item.end.dateTime);
        if (!isNaN(eDate.getTime())) {
          endDate = formatLocalDate(eDate);
          endTime = `${String(eDate.getHours()).padStart(2, '0')}:${String(eDate.getMinutes()).padStart(2, '0')}`;
        } else {
          endDate = startDate;
        }
      }
    }

    if (!startDate) {
      startDate = formatLocalDate(new Date());
    }
    if (!endDate) {
      endDate = startDate;
    }

    // Determine category / type
    const summary = item.summary || 'Termin ohne Titel';
    const isInvoiceEvent = summary.includes('[SOCDOF #') || (item.description && item.description.includes('[SOCDOF #'));
    
    return {
      id: `gcal_${item.id}`,
      title: summary,
      description: item.description || '',
      location: item.location || '',
      startDate,
      startTime: startTime || undefined,
      endDate: endDate || startDate,
      endTime: endTime || undefined,
      isAllDay,
      category: isInvoiceEvent ? 'invoice' : 'google',
      color: item.colorId ? '#4f46e5' : '#3b82f6',
      source: 'google',
      googleCalendarId: calendarId,
      googleEventId: item.id,
      htmlLink: item.htmlLink,
      syncedAt: new Date().toISOString(),
      updatedAt: item.updated
    };
  });

  // Save to cache
  saveCachedGoogleEvents(events);
  return events;
};

// 3. Create a new event in Google Calendar
export const createGoogleCalendarEvent = async (
  calendarId: string = 'primary',
  event: {
    title: string;
    description?: string;
    location?: string;
    startDate: string; // YYYY-MM-DD
    startTime?: string; // HH:mm
    endDate?: string;
    endTime?: string;
    isAllDay?: boolean;
    colorId?: string;
  },
  token?: string
): Promise<CalendarAppEvent> => {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error('Google Calendar access token is missing. Please sign in with Google.');
  }

  const isAllDay = event.isAllDay || (!event.startTime && !event.endTime);
  let startPayload: any;
  let endPayload: any;

  if (isAllDay) {
    startPayload = { date: event.startDate };
    // Google Calendar all-day end dates are exclusive, so add 1 day
    const endDateParsed = parseLocalDate(event.endDate || event.startDate);
    endDateParsed.setDate(endDateParsed.getDate() + 1);
    endPayload = { date: formatLocalDate(endDateParsed) };
  } else {
    // Format local ISO datetime strings with browser timezone or local representation
    const startIso = `${event.startDate}T${event.startTime || '09:00'}:00`;
    const endTargetDate = event.endDate || event.startDate;
    const endIso = `${endTargetDate}T${event.endTime || '10:00'}:00`;
    
    // Create Date objects from local parts
    const sDate = new Date(startIso);
    const eDate = new Date(endIso);

    startPayload = { dateTime: sDate.toISOString() };
    endPayload = { dateTime: eDate.toISOString() };
  }

  const requestBody: any = {
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
    start: startPayload,
    end: endPayload
  };

  if (event.colorId) {
    requestBody.colorId = event.colorId;
  }

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to create Google Calendar event (${response.status})`);
  }

  const data = await response.json();
  return {
    id: `gcal_${data.id}`,
    title: data.summary,
    description: data.description,
    location: data.location,
    startDate: event.startDate,
    startTime: event.startTime,
    endDate: event.endDate || event.startDate,
    endTime: event.endTime,
    isAllDay,
    category: 'google',
    source: 'google',
    googleCalendarId: calendarId,
    googleEventId: data.id,
    htmlLink: data.htmlLink,
    syncedAt: new Date().toISOString()
  };
};

// 4. Update an existing event in Google Calendar
export const updateGoogleCalendarEvent = async (
  calendarId: string = 'primary',
  googleEventId: string,
  event: {
    title: string;
    description?: string;
    location?: string;
    startDate: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    isAllDay?: boolean;
  },
  token?: string
): Promise<CalendarAppEvent> => {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error('Google Calendar access token is missing. Please sign in with Google.');
  }

  const isAllDay = event.isAllDay || (!event.startTime && !event.endTime);
  let startPayload: any;
  let endPayload: any;

  if (isAllDay) {
    startPayload = { date: event.startDate };
    const endDateParsed = parseLocalDate(event.endDate || event.startDate);
    endDateParsed.setDate(endDateParsed.getDate() + 1);
    endPayload = { date: formatLocalDate(endDateParsed) };
  } else {
    const startIso = `${event.startDate}T${event.startTime || '09:00'}:00`;
    const endTargetDate = event.endDate || event.startDate;
    const endIso = `${endTargetDate}T${event.endTime || '10:00'}:00`;
    
    startPayload = { dateTime: new Date(startIso).toISOString() };
    endPayload = { dateTime: new Date(endIso).toISOString() };
  }

  const requestBody: any = {
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
    start: startPayload,
    end: endPayload
  };

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to update Google Calendar event (${response.status})`);
  }

  const data = await response.json();
  return {
    id: `gcal_${data.id}`,
    title: data.summary,
    description: data.description,
    location: data.location,
    startDate: event.startDate,
    startTime: event.startTime,
    endDate: event.endDate || event.startDate,
    endTime: event.endTime,
    isAllDay,
    source: 'google',
    googleCalendarId: calendarId,
    googleEventId: data.id,
    htmlLink: data.htmlLink,
    syncedAt: new Date().toISOString()
  };
};

// 5. Delete an event in Google Calendar
export const deleteGoogleCalendarEvent = async (
  calendarId: string = 'primary',
  googleEventId: string,
  token?: string
): Promise<boolean> => {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    throw new Error('Google Calendar access token is missing. Please sign in with Google.');
  }

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${activeToken}`
    }
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to delete Google Calendar event (${response.status})`);
  }

  // Remove from cache
  const cached = getCachedGoogleEvents();
  const updated = cached.filter(e => e.googleEventId !== googleEventId);
  saveCachedGoogleEvents(updated);

  return true;
};

// -------------------------------------------------------------
// Invoices to Google Calendar 2-Way Sync Engine
// -------------------------------------------------------------

export const syncInvoicesToGoogleCalendar = async (
  invoices: Invoice[],
  calendarId: string = 'primary',
  currency: string = 'EUR',
  token?: string
): Promise<{ pushedCount: number; updatedCount: number; errors: string[] }> => {
  const activeToken = token || cachedAccessToken;
  if (!activeToken) {
    return { pushedCount: 0, updatedCount: 0, errors: ['Not signed in with Google'] };
  }

  let pushedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  try {
    // 1. Fetch existing events in calendar to match invoice tags
    const existingEvents = await fetchGoogleCalendarEvents(calendarId, undefined, activeToken);
    
    // 2. Iterate through invoices that have a due_date
    const invoicesWithDueDate = invoices.filter(inv => inv.due_date && inv.status !== 'cancelled');

    for (const inv of invoicesWithDueDate) {
      const tag = `[SOCDOF #${inv.number}]`;
      const invoiceTitle = `Fälligkeit: Rechnung #${inv.number} (${inv.contact_name || inv.contact_company || ''}) - ${inv.total?.toFixed(2) || '0.00'} ${currency}`;
      const invoiceDesc = `SOCDOF Faktura-Fälligkeit\nStatus: ${inv.status.toUpperCase()}\nBetrag: ${inv.total?.toFixed(2) || '0.00'} ${currency}\nKunde/Partner: ${inv.contact_name || inv.contact_company || ''}\n${tag}`;

      // Check if this invoice is already in Google Calendar
      const matchedEvent = existingEvents.find(
        e => (e.title && e.title.includes(tag)) || (e.description && e.description.includes(tag))
      );

      if (matchedEvent && matchedEvent.googleEventId) {
        // Update if due date or title changed
        if (matchedEvent.startDate !== inv.due_date || matchedEvent.title !== invoiceTitle) {
          try {
            await updateGoogleCalendarEvent(calendarId, matchedEvent.googleEventId, {
              title: invoiceTitle,
              description: invoiceDesc,
              startDate: inv.due_date,
              isAllDay: true
            }, activeToken);
            updatedCount++;
          } catch (e: any) {
            errors.push(`Update error #${inv.number}: ${e.message}`);
          }
        }
      } else {
        // Create new all-day event for invoice due date
        try {
          await createGoogleCalendarEvent(calendarId, {
            title: invoiceTitle,
            description: invoiceDesc,
            startDate: inv.due_date,
            isAllDay: true
          }, activeToken);
          pushedCount++;
        } catch (e: any) {
          errors.push(`Create error #${inv.number}: ${e.message}`);
        }
      }
    }
  } catch (err: any) {
    errors.push(err.message || 'Sync failed');
  }

  return { pushedCount, updatedCount, errors };
};

// -------------------------------------------------------------
// Local Events & Unified Calendar Event Store
// -------------------------------------------------------------

export const getStoredCustomCalendarEvents = (): CalendarAppEvent[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const data = localStorage.getItem('odoo_custom_calendar_events');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveStoredCustomCalendarEvents = (events: CalendarAppEvent[]): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('odoo_custom_calendar_events', JSON.stringify(events));
  } catch {}
};

export const getCachedGoogleEvents = (): CalendarAppEvent[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const data = localStorage.getItem('odoo_gcal_events_cache');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveCachedGoogleEvents = (events: CalendarAppEvent[]): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('odoo_gcal_events_cache', JSON.stringify(events));
  } catch {}
};

// Build unified event list from Invoices, Local Custom Events, and Google Calendar events
export const buildUnifiedCalendarEvents = (
  invoices: Invoice[] = [],
  currency: string = 'EUR'
): CalendarAppEvent[] => {
  const localEvents = getStoredCustomCalendarEvents();
  const gcalEvents = getCachedGoogleEvents();

  // Map invoices into calendar events
  const invoiceEvents: CalendarAppEvent[] = invoices
    .filter(inv => inv.due_date && inv.status !== 'cancelled')
    .map(inv => {
      const isPaid = inv.status === 'paid';
      const isOverdue = !isPaid && new Date(inv.due_date) < new Date();
      return {
        id: `invoice_${inv.id || inv.number}`,
        title: `Rechnung #${inv.number}: ${inv.contact_name || inv.contact_company || ''}`,
        description: `Fällige Rechnung über ${inv.total?.toFixed(2) || '0.00'} ${currency} (Status: ${inv.status.toUpperCase()})`,
        startDate: inv.due_date,
        endDate: inv.due_date,
        isAllDay: true,
        category: 'invoice',
        color: isPaid ? '#10b981' : isOverdue ? '#ef4444' : '#6366f1',
        source: 'invoice',
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        createdAt: inv.date
      };
    });

  // Deduplicate: If an invoice is already present in Google Calendar (matched by tag), prefer the invoice version or merge
  const gcalFiltered = gcalEvents.filter(ge => {
    const hasTag = ge.title.includes('[SOCDOF #') || (ge.description && ge.description.includes('[SOCDOF #'));
    return !hasTag;
  });

  const all = [...invoiceEvents, ...localEvents, ...gcalFiltered];

  // Sort chronologically
  return all.sort((a, b) => {
    const dateComp = a.startDate.localeCompare(b.startDate);
    if (dateComp !== 0) return dateComp;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
};

// Perform full live sync cycle (Pull Google Events + Push Invoices)
export const performFullGoogleCalendarSync = async (
  invoices: Invoice[] = [],
  targetCalendarId: string = 'primary',
  currency: string = 'EUR'
): Promise<{ success: boolean; eventCount: number; message: string }> => {
  if (!cachedAccessToken) {
    return { success: false, eventCount: 0, message: 'Google Account not connected' };
  }

  updateSyncStatus({ isSyncing: true, error: null });

  try {
    // 1. Pull events from Google Calendar
    const events = await fetchGoogleCalendarEvents(targetCalendarId);
    
    // 2. Push invoice due dates to Google Calendar
    await syncInvoicesToGoogleCalendar(invoices, targetCalendarId, currency);

    const nowIso = new Date().toISOString();
    updateSyncStatus({
      isSyncing: false,
      lastSyncedAt: nowIso,
      eventCount: events.length,
      error: null
    });

    return {
      success: true,
      eventCount: events.length,
      message: `Synchronisation erfolgreich! ${events.length} Google-Termine geladen.`
    };
  } catch (err: any) {
    console.error('Full Google Calendar sync error:', err);
    updateSyncStatus({
      isSyncing: false,
      error: err.message || 'Sync failed'
    });
    return {
      success: false,
      eventCount: 0,
      message: err.message || 'Sync failed'
    };
  }
};

// -------------------------------------------------------------
// iCalendar (.ics) Exporter
// -------------------------------------------------------------

export const generateICSContent = (events: CalendarAppEvent[]): string => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SOCDOF//DE//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SOCDOF Kalender'
  ];

  for (const evt of events) {
    const cleanStart = evt.startDate.replace(/-/g, '');
    const cleanEnd = (evt.endDate || evt.startDate).replace(/-/g, '');
    
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.id}@socdof.app`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`);
    
    if (evt.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${cleanStart}`);
      // For all-day events, DTEND is exclusive
      const endD = parseLocalDate(evt.endDate || evt.startDate);
      endD.setDate(endD.getDate() + 1);
      const nextDayStr = formatLocalDate(endD).replace(/-/g, '');
      lines.push(`DTEND;VALUE=DATE:${nextDayStr}`);
    } else {
      const sTime = (evt.startTime || '09:00').replace(':', '') + '00';
      const eTime = (evt.endTime || '10:00').replace(':', '') + '00';
      lines.push(`DTSTART:${cleanStart}T${sTime}`);
      lines.push(`DTEND:${cleanEnd}T${eTime}`);
    }

    lines.push(`SUMMARY:${(evt.title || '').replace(/\n/g, ' ')}`);
    if (evt.description) {
      lines.push(`DESCRIPTION:${evt.description.replace(/\n/g, '\\n')}`);
    }
    if (evt.location) {
      lines.push(`LOCATION:${evt.location.replace(/\n/g, ' ')}`);
    }
    lines.push(`CATEGORIES:${(evt.category || 'GENERAL').toUpperCase()}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

export const downloadICSFile = (events: CalendarAppEvent[], filename: string = 'socdof-kalender.ics'): void => {
  const icsData = generateICSContent(events);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
