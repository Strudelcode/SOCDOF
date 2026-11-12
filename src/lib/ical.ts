import { Invoice, CompanyProfile } from '../types';

export interface SocdofCalendarEvent {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD or ISO
  endDate?: string;
  startTime?: string; // HH:mm
  endTime?: string;
  description?: string;
  location?: string;
  category?: 'invoice' | 'appointment' | 'tax' | 'general';
  source?: 'socdof' | 'imported';
  uid?: string;
}

export type CustomCalendarEvent = SocdofCalendarEvent;

const STORAGE_KEY = 'socdof_custom_calendar_events';

/**
 * Retrieves custom/imported calendar events from local persistence.
 */
export function getStoredCalendarEvents(): SocdofCalendarEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves custom/imported calendar events to local persistence.
 */
export function saveStoredCalendarEvents(events: SocdofCalendarEvent[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {}
}

/**
 * Clears custom/imported calendar events.
 */
export function clearStoredCalendarEvents() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string.
 */
export function generateIcsCalendar(invoices: Invoice[], company?: CompanyProfile): string {
  const companyName = company?.name || 'SOCDOF';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SOCDOF//DE//SOCDOF Business Suite 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${companyName} - Fälligkeiten & Termine`,
    `X-WR-CALDESC:Rechnungsfälligkeiten und Geschäftstermine aus SOCDOF (${companyName})`,
    'X-WR-TIMEZONE:Europe/Berlin'
  ];

  const now = new Date();
  const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // 1. Add invoices with due dates
  invoices.forEach((inv) => {
    if (!inv.due_date && !inv.date) return;
    const dueStr = inv.due_date || inv.date;
    const dueDate = new Date(dueStr);
    if (isNaN(dueDate.getTime())) return;

    const formattedDate = dueStr.replace(/-/g, '');
    const isPaid = inv.status === 'paid';
    const totalFormatted = (inv.total || 0).toFixed(2);
    const currency = company?.currency || '€';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:socdof-inv-${inv.id || inv.number}-${inv.date}@socdof.local`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${formattedDate}`);
    // All-day event ends next day per iCalendar spec
    const nextDay = new Date(dueDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
    lines.push(`DTEND;VALUE=DATE:${nextDayStr}`);

    const contactName = inv.contact_name || inv.contact_company || 'Kunde';
    lines.push(`SUMMARY:${isPaid ? '✓ Bezahlt' : '⚠️ Fälligkeit'}: ${inv.number} - ${contactName} (${totalFormatted} ${currency})`);
    lines.push(`DESCRIPTION:Rechnung: ${inv.number}\\nKunde: ${contactName}\\nBetrag: ${totalFormatted} ${currency}\\nStatus: ${inv.status === 'paid' ? 'Bezahlt' : 'Offen'}\\nFällig am: ${dueStr}`);
    lines.push(`STATUS:${isPaid ? 'CANCELLED' : 'CONFIRMED'}`);
    lines.push('CATEGORIES:Rechnung,Finanzen,SOCDOF');

    // Add reminder alarms for unpaid items (1 day prior and 1 hour prior)
    if (!isPaid) {
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-P1D');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Morgen fällig: Rechnung ${inv.number} (${totalFormatted} ${currency})`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  });

  // 2. Add custom stored events
  const customEvents = getStoredCalendarEvents();
  customEvents.forEach((evt) => {
    if (!evt.startDate) return;
    const dateFormatted = evt.startDate.replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.uid || `socdof-evt-${evt.id}@socdof.local`}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dateFormatted}`);
    lines.push(`SUMMARY:${evt.title.replace(/\n/g, ' ')}`);
    if (evt.description) {
      lines.push(`DESCRIPTION:${evt.description.replace(/\n/g, '\\n')}`);
    }
    if (evt.location) {
      lines.push(`LOCATION:${evt.location.replace(/\n/g, ' ')}`);
    }
    lines.push('STATUS:CONFIRMED');
    lines.push(`CATEGORIES:${evt.category || 'Termin'},SOCDOF`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers browser download of an .ics file.
 */
export function downloadIcsCalendar(invoices: Invoice[], company?: CompanyProfile) {
  const icsContent = generateIcsCalendar(invoices, company);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `SOCDOF_Kalender_${new Date().toISOString().slice(0, 10)}.ics`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses an imported .ics text string and extracts VEVENT entries.
 */
export function parseIcsText(icsContent: string): SocdofCalendarEvent[] {
  const events: SocdofCalendarEvent[] = [];
  const lines = icsContent.replace(/\r\n /g, '').split(/\r\n|\n|\r/);

  let inEvent = false;
  let currentEvent: Partial<SocdofCalendarEvent> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        id: 'imp_' + Math.random().toString(36).substring(2, 9),
        source: 'imported'
      };
      continue;
    }

    if (line === 'END:VEVENT') {
      if (inEvent && currentEvent.title && currentEvent.startDate) {
        events.push(currentEvent as SocdofCalendarEvent);
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }

    if (!inEvent) continue;

    if (line.startsWith('SUMMARY:')) {
      currentEvent.title = line.substring(8).replace(/\\n/g, ' ').replace(/\\,/g, ',');
    } else if (line.startsWith('DESCRIPTION:')) {
      currentEvent.description = line.substring(12).replace(/\\n/g, '\n').replace(/\\,/g, ',');
    } else if (line.startsWith('LOCATION:')) {
      currentEvent.location = line.substring(9).replace(/\\,/g, ',');
    } else if (line.startsWith('UID:')) {
      currentEvent.uid = line.substring(4);
    } else if (line.startsWith('DTSTART')) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const rawDate = parts[1];
        // Handles YYYYMMDD or YYYYMMDDTHHMMSSZ
        if (rawDate.length >= 8) {
          const y = rawDate.substring(0, 4);
          const m = rawDate.substring(4, 6);
          const d = rawDate.substring(6, 8);
          currentEvent.startDate = `${y}-${m}-${d}`;
        }
      }
    } else if (line.startsWith('DTEND')) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const rawDate = parts[1];
        if (rawDate.length >= 8) {
          const y = rawDate.substring(0, 4);
          const m = rawDate.substring(4, 6);
          const d = rawDate.substring(6, 8);
          currentEvent.endDate = `${y}-${m}-${d}`;
        }
      }
    }
  }

  return events;
}

/**
 * Returns webcal and web subscribe URLs.
 */
export function getCalendarSubscribeUrls() {
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  const webcalUrl = `webcal://${host}/api/calendar/socdof-feed.ics`;
  const httpsUrl = `https://${host}/api/calendar/socdof-feed.ics`;
  const googleCalendarAddUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;
  const outlookAddUrl = `https://outlook.live.com/calendar/0/addcalendar`;

  return {
    webcalUrl,
    httpsUrl,
    googleCalendarAddUrl,
    outlookAddUrl
  };
}
