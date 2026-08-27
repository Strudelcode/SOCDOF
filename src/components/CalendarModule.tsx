import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  RefreshCw, 
  Check, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  Clock, 
  MapPin, 
  Filter, 
  CalendarDays, 
  UserCheck, 
  LogOut, 
  Receipt,
  Search,
  X,
  Download,
  Copy,
  CalendarCheck2,
  ListFilter,
  Layers,
  Sparkles,
  CalendarRange,
  ChevronDown,
  Printer
} from 'lucide-react';
import { 
  CalendarAppEvent, 
  GoogleCalendarItem, 
  Invoice, 
  CompanyProfile 
} from '../types';
import { 
  signInWithGoogleCalendar, 
  signOutGoogleCalendar, 
  fetchGoogleCalendarsList, 
  createGoogleCalendarEvent, 
  updateGoogleCalendarEvent, 
  deleteGoogleCalendarEvent, 
  performFullGoogleCalendarSync, 
  buildUnifiedCalendarEvents, 
  getStoredCustomCalendarEvents, 
  saveStoredCustomCalendarEvents, 
  subscribeToGoogleAuth, 
  subscribeToSyncStatus,
  getCachedGoogleUserMeta,
  getGoogleAccessToken,
  formatLocalDate,
  parseLocalDate,
  isEventOnDate,
  downloadICSFile
} from '../lib/googleCalendar';
import { DynamicCalendarIcon } from './DynamicCalendarIcon';
import { useLanguage, t } from '../lib/i18n';
import { sounds } from '../lib/sound';

interface CalendarModuleProps {
  invoices: Invoice[];
  company: CompanyProfile;
  onOpenInvoice?: (invoiceId: number) => void;
  onUpdateCompany?: (patch: Partial<CompanyProfile>) => void;
}

export type CalendarViewMode = 'month' | 'workweek' | 'week' | 'day' | 'agenda';

const HOURS_RANGE = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 to 22:00

// Helper to get formatted current time and +1 hour
function getCurrentTimeFormatted(): { start: string; end: string } {
  const now = new Date();
  const currentH = now.getHours();
  const currentM = String(now.getMinutes()).padStart(2, '0');
  const start = `${String(currentH).padStart(2, '0')}:${currentM}`;
  const end = addMinutesToTime(start, 60);
  return { start, end };
}

// Helper to calculate human readable duration
function getEventDurationString(
  startDate: string,
  startTime?: string,
  endDate?: string,
  endTime?: string,
  isAllDay?: boolean
): string {
  if (isAllDay) return 'Ganztägig';
  if (!startTime) return 'Ohne feste Uhrzeit';

  const endD = endDate || startDate;
  const endT = endTime || startTime;

  if (endD !== startDate) {
    const d1 = parseLocalDate(startDate);
    const d2 = parseLocalDate(endD);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return `${diffDays + 1} Tage (${startTime} - ${endT})`;
  }

  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endT.split(':').map(Number);
  const startMins = (sh || 0) * 60 + (sm || 0);
  const endMins = (eh || 0) * 60 + (em || 0);
  const diffMins = endMins - startMins;

  if (diffMins <= 0) return '0 Min.';
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours > 0 && mins > 0) {
    return `${hours} Std. ${mins} Min.`;
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
  }
  return `${mins} Minuten`;
}

// Helper to add minutes to HH:mm
function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const [h, m] = (timeStr || '10:00').split(':').map(Number);
  const totalMins = (h || 0) * 60 + (m || 0) + minutesToAdd;
  const newH = Math.floor((totalMins / 60) % 24);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export const CalendarModule: React.FC<CalendarModuleProps> = ({
  invoices,
  company,
  onOpenInvoice,
  onUpdateCompany
}) => {
  const currentLang = useLanguage();

  // Auth & Sync State
  const [googleUser, setGoogleUser] = useState<any>(getCachedGoogleUserMeta());
  const [accessToken, setAccessToken] = useState<string | null>(getGoogleAccessToken());
  const [syncState, setSyncState] = useState<{
    isSyncing: boolean;
    lastSyncedAt: string | null;
    error: string | null;
    eventCount: number;
  }>({
    isSyncing: false,
    lastSyncedAt: typeof localStorage !== 'undefined' ? localStorage.getItem('odoo_gcal_last_sync') : null,
    error: null as string | null,
    eventCount: 0
  });

  // Calendar Selection State
  const [calendarsList, setCalendarsList] = useState<GoogleCalendarItem[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(
    company.google_cal_target_calendar_id || 'primary'
  );

  // View Mode & Current Focused Date
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [focusedDate, setFocusedDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [miniCalendarMonth, setMiniCalendarMonth] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Category & Filter Toggles
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({
    invoice: true,
    customer: true,
    meeting: true,
    deadline: true,
    personal: true,
    general: true,
    google: true
  });
  const [showInvoicesOnly, setShowInvoicesOnly] = useState(false);

  // Modals & Inspection State
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<CalendarAppEvent | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Event Form State with full start/end time and duration
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventStartDate, setNewEventStartDate] = useState(formatLocalDate(new Date()));
  const [newEventStartTime, setNewEventStartTime] = useState(() => getCurrentTimeFormatted().start);
  const [newEventEndDate, setNewEventEndDate] = useState(formatLocalDate(new Date()));
  const [newEventEndTime, setNewEventEndTime] = useState(() => getCurrentTimeFormatted().end);
  const [newEventIsAllDay, setNewEventIsAllDay] = useState(false);
  const [newEventCategory, setNewEventCategory] = useState<'invoice' | 'customer' | 'meeting' | 'deadline' | 'personal' | 'general'>('general');
  const [newEventTarget, setNewEventTarget] = useState<'google' | 'local'>('google');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unified Events State
  const [events, setEvents] = useState<CalendarAppEvent[]>(() => buildUnifiedCalendarEvents(invoices, company.currency));

  // Reload events from all sources
  const refreshUnifiedEvents = useCallback(() => {
    const updated = buildUnifiedCalendarEvents(invoices, company.currency);
    setEvents(updated);
  }, [invoices, company.currency]);

  // Keep mini-calendar month synchronized when main focused date changes significantly
  useEffect(() => {
    setMiniCalendarMonth(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), 1));
  }, [focusedDate]);

  // Subscribe to Auth and Sync changes
  useEffect(() => {
    const unsubAuth = subscribeToGoogleAuth((user, token) => {
      setGoogleUser(user);
      setAccessToken(token);
      if (token) {
        fetchGoogleCalendarsList(token)
          .then(list => setCalendarsList(list))
          .catch(e => console.warn('Could not fetch calendar list:', e));
      }
    });

    const unsubSync = subscribeToSyncStatus((status) => {
      setSyncState(status);
      refreshUnifiedEvents();
    });

    return () => {
      unsubAuth();
      unsubSync();
    };
  }, [refreshUnifiedEvents]);

  // Initial event population
  useEffect(() => {
    refreshUnifiedEvents();
  }, [refreshUnifiedEvents, invoices]);

  // Periodic automatic sync every 2 minutes when user is connected
  useEffect(() => {
    if (!accessToken) return;

    performFullGoogleCalendarSync(invoices, selectedCalendarId, company.currency);

    const intervalMinutes = company.google_cal_sync_interval_mins || 2;
    const timer = setInterval(() => {
      performFullGoogleCalendarSync(invoices, selectedCalendarId, company.currency);
    }, intervalMinutes * 60 * 1000);

    return () => clearInterval(timer);
  }, [accessToken, selectedCalendarId, invoices, company.currency, company.google_cal_sync_interval_mins]);

  // Handle Google Login Click
  const handleConnectGoogle = async () => {
    try {
      sounds.playClick();
      const res = await signInWithGoogleCalendar();
      setStatusNotification({
        text: `Google Konto erfolgreich verbunden (${res.user.email})`,
        type: 'success'
      });
      sounds.playSuccess();
      if (res.accessToken) {
        performFullGoogleCalendarSync(invoices, selectedCalendarId, company.currency);
      }
    } catch (err: any) {
      sounds.playWarning();
      setStatusNotification({
        text: err.message || 'Google Verbindung fehlgeschlagen',
        type: 'error'
      });
    }
  };

  // Handle Google Logout
  const handleDisconnectGoogle = async () => {
    try {
      sounds.playClick();
      await signOutGoogleCalendar();
      setGoogleUser(null);
      setAccessToken(null);
      setCalendarsList([]);
      sounds.playPop();
      setStatusNotification({
        text: 'Google Konto erfolgreich getrennt.',
        type: 'success'
      });
      refreshUnifiedEvents();
    } catch (err: any) {
      sounds.playWarning();
      setStatusNotification({
        text: err.message || 'Fehler beim Abmelden',
        type: 'error'
      });
    }
  };

  // Handle Manual Sync Click
  const handleManualSync = async () => {
    sounds.playClick();
    const res = await performFullGoogleCalendarSync(invoices, selectedCalendarId, company.currency);
    if (res.success) {
      sounds.playSuccess();
      setStatusNotification({
        text: res.message,
        type: 'success'
      });
      refreshUnifiedEvents();
    } else {
      sounds.playWarning();
      setStatusNotification({
        text: res.message,
        type: 'error'
      });
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      // 1. Invoice Only filter
      if (showInvoicesOnly && evt.source !== 'invoice') return false;

      // 2. Category filter
      const cat = evt.category || (evt.source === 'google' ? 'google' : 'general');
      if (enabledCategories[cat] === false) return false;

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (evt.title || '').toLowerCase().includes(q);
        const matchDesc = (evt.description || '').toLowerCase().includes(q);
        const matchLoc = (evt.location || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchLoc) return false;
      }

      return true;
    });
  }, [events, showInvoicesOnly, enabledCategories, searchQuery]);

  // Upcoming top 4 events for Outlook sidebar
  const upcomingSidebarEvents = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    return filteredEvents
      .filter(e => (e.endDate || e.startDate) >= todayStr)
      .sort((a, b) => {
        const dComp = a.startDate.localeCompare(b.startDate);
        if (dComp !== 0) return dComp;
        return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
      })
      .slice(0, 4);
  }, [filteredEvents]);

  // Category Color & Styling Map
  const categoryColorMap: Record<string, { bg: string; text: string; dot: string; border: string; accentBar: string; label: string }> = {
    invoice: { 
      bg: 'bg-indigo-50/90 dark:bg-indigo-950/70', 
      text: 'text-indigo-900 dark:text-indigo-100', 
      dot: 'bg-indigo-600', 
      border: 'border-indigo-200 dark:border-indigo-800',
      accentBar: 'border-l-4 border-l-indigo-600',
      label: 'Fällige Rechnung' 
    },
    customer: { 
      bg: 'bg-emerald-50/90 dark:bg-emerald-950/70', 
      text: 'text-emerald-900 dark:text-emerald-100', 
      dot: 'bg-emerald-600', 
      border: 'border-emerald-200 dark:border-emerald-800',
      accentBar: 'border-l-4 border-l-emerald-600',
      label: 'Kundentermin' 
    },
    meeting: { 
      bg: 'bg-amber-50/90 dark:bg-amber-950/70', 
      text: 'text-amber-900 dark:text-amber-100', 
      dot: 'bg-amber-500', 
      border: 'border-amber-200 dark:border-amber-800',
      accentBar: 'border-l-4 border-l-amber-500',
      label: 'Meeting / Besprechung' 
    },
    deadline: { 
      bg: 'bg-rose-50/90 dark:bg-rose-950/70', 
      text: 'text-rose-900 dark:text-rose-100', 
      dot: 'bg-rose-600', 
      border: 'border-rose-200 dark:border-rose-800',
      accentBar: 'border-l-4 border-l-rose-600',
      label: 'Frist & Abgabe' 
    },
    personal: { 
      bg: 'bg-purple-50/90 dark:bg-purple-950/70', 
      text: 'text-purple-900 dark:text-purple-100', 
      dot: 'bg-purple-600', 
      border: 'border-purple-200 dark:border-purple-800',
      accentBar: 'border-l-4 border-l-purple-600',
      label: 'Privater Termin' 
    },
    google: { 
      bg: 'bg-blue-50/90 dark:bg-blue-950/70', 
      text: 'text-blue-900 dark:text-blue-100', 
      dot: 'bg-blue-600', 
      border: 'border-blue-200 dark:border-blue-800',
      accentBar: 'border-l-4 border-l-blue-600',
      label: 'Google Kalender' 
    },
    general: { 
      bg: 'bg-slate-100 dark:bg-slate-800', 
      text: 'text-slate-800 dark:text-slate-200', 
      dot: 'bg-slate-500', 
      border: 'border-slate-200 dark:border-slate-700',
      accentBar: 'border-l-4 border-l-slate-500',
      label: 'Allgemein' 
    }
  };

  // Main Navigation Handlers (Month, WorkWeek, Week, Day, Agenda)
  const handlePrev = () => {
    sounds.playClick();
    const d = new Date(focusedDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'workweek' || viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else if (viewMode === 'day') {
      d.setDate(d.getDate() - 1);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setFocusedDate(d);
  };

  const handleNext = () => {
    sounds.playClick();
    const d = new Date(focusedDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'workweek' || viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else if (viewMode === 'day') {
      d.setDate(d.getDate() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setFocusedDate(d);
  };

  const handleToday = () => {
    sounds.playPop();
    const now = new Date();
    setFocusedDate(now);
    setSelectedDay(now);
    setMiniCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Mini-Calendar Left/Right Month Flippers (Outlook top-left mini arrows)
  const handleMiniPrevMonth = () => {
    sounds.playClick();
    setMiniCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleMiniNextMonth = () => {
    sounds.playClick();
    setMiniCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const isSameDay = (d1: Date, d2: Date) => (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );

  // Month Grid Calculation (Strictly 42 cells, timezone-safe)
  const monthGridDays = useMemo(() => {
    const year = focusedDate.getFullYear();
    const month = focusedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: Date;
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      events: CalendarAppEvent[];
    }> = [];

    const now = new Date();

    // Previous month padding
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dStr = formatLocalDate(d);
      const dayEvts = filteredEvents.filter(e => isEventOnDate(e, dStr));
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: isSameDay(d, now),
        isSelected: isSameDay(d, selectedDay),
        events: dayEvts
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dStr = formatLocalDate(d);
      const dayEvts = filteredEvents.filter(e => isEventOnDate(e, dStr));
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: true,
        isToday: isSameDay(d, now),
        isSelected: isSameDay(d, selectedDay),
        events: dayEvts
      });
    }

    // Next month padding to reach exactly 42 cells
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dStr = formatLocalDate(d);
      const dayEvts = filteredEvents.filter(e => isEventOnDate(e, dStr));
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: isSameDay(d, now),
        isSelected: isSameDay(d, selectedDay),
        events: dayEvts
      });
    }

    return cells;
  }, [focusedDate, selectedDay, filteredEvents]);

  // Mini-Calendar Independent Grid Calculation (42 cells based on miniCalendarMonth)
  const miniCalendarDays = useMemo(() => {
    const year = miniCalendarMonth.getFullYear();
    const month = miniCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const cells = [];
    const now = new Date();

    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dStr = formatLocalDate(d);
      const hasEvents = filteredEvents.some(e => isEventOnDate(e, dStr));
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: isSameDay(d, now),
        isSelected: isSameDay(d, focusedDate),
        hasEvents
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dStr = formatLocalDate(d);
      const hasEvents = filteredEvents.some(e => isEventOnDate(e, dStr));
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: true,
        isToday: isSameDay(d, now),
        isSelected: isSameDay(d, focusedDate),
        hasEvents
      });
    }

    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dStr = formatLocalDate(d);
      const hasEvents = filteredEvents.some(e => isEventOnDate(e, dStr));
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: isSameDay(d, now),
        isSelected: isSameDay(d, focusedDate),
        hasEvents
      });
    }

    return cells;
  }, [miniCalendarMonth, focusedDate, filteredEvents]);

  // Week & Work-Week View Days Calculation (Monday to Sunday or Monday to Friday)
  const currentWeekDays = useMemo(() => {
    const current = new Date(focusedDate);
    const dayOfWeek = (current.getDay() + 6) % 7; // Monday = 0
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - dayOfWeek);

    const now = new Date();
    const count = viewMode === 'workweek' ? 5 : 7;
    const days = [];

    for (let i = 0; i < count; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dStr = formatLocalDate(d);
      const dayEvts = filteredEvents.filter(e => isEventOnDate(e, dStr));
      days.push({
        date: d,
        dateStr: dStr,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString(currentLang === 'de' ? 'de-DE' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' }),
        isToday: isSameDay(d, now),
        isSelected: isSameDay(d, selectedDay),
        events: dayEvts
      });
    }
    return days;
  }, [focusedDate, selectedDay, filteredEvents, viewMode, currentLang]);

  // Open New Event Modal with pre-filled date & hour & automatic +1h end time based on current time
  const openNewEventModalWithDate = (dateStr?: string, defaultHour?: string) => {
    sounds.playPop();
    const d = dateStr || formatLocalDate(focusedDate);
    
    let startH = defaultHour;
    let endH = '';

    if (startH) {
      endH = addMinutesToTime(startH, 60);
    } else {
      const { start, end } = getCurrentTimeFormatted();
      startH = start;
      endH = end;
    }

    setNewEventTitle('');
    setNewEventDesc('');
    setNewEventLocation('');
    setNewEventStartDate(d);
    setNewEventStartTime(startH);
    setNewEventEndDate(d);
    setNewEventEndTime(endH);
    setNewEventIsAllDay(false);
    setNewEventCategory('general');
    setNewEventTarget(accessToken ? 'google' : 'local');
    setIsNewEventModalOpen(true);
  };

  // Quick duration setter for Create modal
  const handleQuickDuration = (minutes: number) => {
    sounds.playClick();
    if (minutes === -1) {
      setNewEventIsAllDay(true);
      return;
    }
    setNewEventIsAllDay(false);
    setNewEventEndDate(newEventStartDate);
    setNewEventEndTime(addMinutesToTime(newEventStartTime, minutes));
  };

  // Submit Create New Event
  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    setIsSubmitting(true);
    try {
      if (newEventTarget === 'google' && accessToken) {
        await createGoogleCalendarEvent(selectedCalendarId, {
          title: newEventTitle.trim(),
          description: newEventDesc.trim(),
          location: newEventLocation.trim(),
          startDate: newEventStartDate,
          startTime: newEventIsAllDay ? undefined : newEventStartTime,
          endDate: newEventEndDate || newEventStartDate,
          endTime: newEventIsAllDay ? undefined : newEventEndTime,
          isAllDay: newEventIsAllDay
        });
        sounds.playSuccess();
        setStatusNotification({
          text: `Termin "${newEventTitle}" in Google Kalender angelegt.`,
          type: 'success'
        });
        await performFullGoogleCalendarSync(invoices, selectedCalendarId, company.currency);
      } else {
        const newLocalEvent: CalendarAppEvent = {
          id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: newEventTitle.trim(),
          description: newEventDesc.trim(),
          location: newEventLocation.trim(),
          startDate: newEventStartDate,
          startTime: newEventIsAllDay ? undefined : newEventStartTime,
          endDate: newEventEndDate || newEventStartDate,
          endTime: newEventIsAllDay ? undefined : newEventEndTime,
          isAllDay: newEventIsAllDay,
          category: newEventCategory,
          source: 'local',
          createdAt: new Date().toISOString()
        };
        const existing = getStoredCustomCalendarEvents();
        saveStoredCustomCalendarEvents([...existing, newLocalEvent]);
        sounds.playSuccess();
        setStatusNotification({
          text: `Lokaler Termin "${newEventTitle}" gespeichert.`,
          type: 'success'
        });
      }

      refreshUnifiedEvents();
      setIsNewEventModalOpen(false);
    } catch (err: any) {
      sounds.playWarning();
      setStatusNotification({
        text: err.message || 'Fehler beim Erstellen des Termins',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Update Event
  const handleUpdateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForDetail || !selectedEventForDetail.title.trim()) return;

    setIsSubmitting(true);
    try {
      if (selectedEventForDetail.source === 'google' && selectedEventForDetail.googleEventId && accessToken) {
        await updateGoogleCalendarEvent(
          selectedEventForDetail.googleCalendarId || selectedCalendarId,
          selectedEventForDetail.googleEventId,
          {
            title: selectedEventForDetail.title,
            description: selectedEventForDetail.description,
            location: selectedEventForDetail.location,
            startDate: selectedEventForDetail.startDate,
            startTime: selectedEventForDetail.isAllDay ? undefined : selectedEventForDetail.startTime,
            endDate: selectedEventForDetail.endDate || selectedEventForDetail.startDate,
            endTime: selectedEventForDetail.isAllDay ? undefined : selectedEventForDetail.endTime,
            isAllDay: selectedEventForDetail.isAllDay
          }
        );
        sounds.playSuccess();
        setStatusNotification({
          text: 'Google Kalender Termin aktualisiert.',
          type: 'success'
        });
        await performFullGoogleCalendarSync(invoices, selectedCalendarId, company.currency);
      } else if (selectedEventForDetail.source === 'local') {
        const stored = getStoredCustomCalendarEvents();
        const updated = stored.map(evt => evt.id === selectedEventForDetail.id ? selectedEventForDetail : evt);
        saveStoredCustomCalendarEvents(updated);
        sounds.playSuccess();
        setStatusNotification({
          text: 'Lokaler Termin aktualisiert.',
          type: 'success'
        });
      }

      refreshUnifiedEvents();
      setIsEditingEvent(false);
      setSelectedEventForDetail(null);
    } catch (err: any) {
      sounds.playWarning();
      setStatusNotification({
        text: err.message || 'Fehler beim Aktualisieren',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Duplicate Event
  const handleDuplicateEvent = (event: CalendarAppEvent) => {
    sounds.playPop();
    const newEvt: CalendarAppEvent = {
      ...event,
      id: `local_${Date.now()}_dup`,
      title: `${event.title} (Kopie)`,
      source: 'local',
      createdAt: new Date().toISOString()
    };
    delete newEvt.googleCalendarId;
    delete newEvt.googleEventId;
    delete newEvt.htmlLink;

    const existing = getStoredCustomCalendarEvents();
    saveStoredCustomCalendarEvents([...existing, newEvt]);
    sounds.playSuccess();
    setStatusNotification({
      text: `Termin "${event.title}" erfolgreich dupliziert.`,
      type: 'success'
    });
    refreshUnifiedEvents();
    setSelectedEventForDetail(null);
  };

  // Delete Event with explicit confirmation
  const handleDeleteEvent = async (event: CalendarAppEvent) => {
    sounds.playDelete();
    setIsSubmitting(true);
    try {
      if (event.source === 'google' && event.googleEventId && accessToken) {
        await deleteGoogleCalendarEvent(
          event.googleCalendarId || selectedCalendarId,
          event.googleEventId
        );
        setStatusNotification({
          text: 'Termin aus Google Kalender gelöscht.',
          type: 'success'
        });
        await performFullGoogleCalendarSync(invoices, selectedCalendarId, company.currency);
      } else if (event.source === 'local') {
        const stored = getStoredCustomCalendarEvents();
        const updated = stored.filter(e => e.id !== event.id);
        saveStoredCustomCalendarEvents(updated);
        setStatusNotification({
          text: 'Lokaler Termin gelöscht.',
          type: 'success'
        });
      }

      refreshUnifiedEvents();
      setSelectedEventForDetail(null);
      setConfirmDeleteId(null);
    } catch (err: any) {
      sounds.playWarning();
      setStatusNotification({
        text: err.message || 'Fehler beim Löschen des Termins',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download ICS File
  const handleExportICS = () => {
    sounds.playClick();
    downloadICSFile(filteredEvents, `socdof-kalender-${formatLocalDate(new Date())}.ics`);
    setStatusNotification({
      text: 'Kalender erfolgreich als .ICS iCalendar-Datei exportiert.',
      type: 'success'
    });
  };

  const formattedMonthYear = useMemo(() => {
    return focusedDate.toLocaleDateString(currentLang === 'de' ? 'de-DE' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-US', {
      month: 'long',
      year: 'numeric'
    });
  }, [focusedDate, currentLang]);

  const focusedDayEvents = useMemo(() => {
    const dStr = formatLocalDate(focusedDate);
    return filteredEvents.filter(e => isEventOnDate(e, dStr));
  }, [focusedDate, filteredEvents]);

  // Current Time for live line in day / week views
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans select-none">
      
      {/* 1. OUTLOOK 365 RIBBON / COMMAND BAR */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        
        {/* Left: App Identity & Primary Action "+ Neuer Termin" */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 pr-3 border-r border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>{t('module.calendar', currentLang, 'Kalender')}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                  OUTLOOK 365
                </span>
              </h2>
            </div>
          </div>

          {/* Primary Action: "+ Neuer Termin" */}
          <button
            onClick={() => openNewEventModalWithDate()}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            title={t('calendar.new_event', currentLang, 'Neuen Termin, Besprechung oder Frist anlegen')}
          >
            <Plus className="w-4 h-4" />
            <span>{t('calendar.new_event', currentLang, 'Neuer Termin')}</span>
          </button>

          {/* Today Button & Outlook Chevrons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={handleToday}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              title={t('calendar.reset_today_title', currentLang, 'Zum heutigen Datum springen')}
            >
              <CalendarCheck2 className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('calendar.today_btn', currentLang, 'Heute')}</span>
            </button>

            <div className="flex items-center">
              <button
                onClick={handlePrev}
                title={t('calendar.prev_month', currentLang, 'Vorheriger Zeitraum')}
                className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                title={t('calendar.next_month', currentLang, 'Nächster Zeitraum')}
                className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Formatted Period Display */}
          <span className="text-sm font-black text-slate-900 dark:text-white capitalize tracking-tight hidden md:inline">
            {viewMode === 'day'
              ? focusedDate.toLocaleDateString(currentLang === 'de' ? 'de-DE' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
              : formattedMonthYear}
          </span>
        </div>

        {/* Center: Search & Instant Live Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('calendar.search_placeholder', currentLang, 'Termine, Fristen & Notizen suchen...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-100/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition focus:outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                title="Suche zurücksetzen"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: View Modes Switcher & Export */}
        <div className="flex items-center gap-2">
          
          {/* View Mode Buttons (Outlook Styled) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            {(
              [
                { mode: 'day', label: t('calendar.view_day', currentLang, 'Tag') },
                { mode: 'workweek', label: t('calendar.view_workweek', currentLang, 'Arbeitswoche') },
                { mode: 'week', label: t('calendar.view_week', currentLang, 'Woche') },
                { mode: 'month', label: t('calendar.view_month', currentLang, 'Monat') },
                { mode: 'agenda', label: t('calendar.view_agenda', currentLang, 'Agenda') }
              ] as Array<{ mode: CalendarViewMode; label: string }>
            ).map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => {
                  sounds.playClick();
                  setViewMode(mode);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Print Calendar */}
          <button
            onClick={() => { sounds.playClick(); window.print(); }}
            title="Kalenderansicht drucken / als PDF speichern"
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Export ICS */}
          <button
            onClick={handleExportICS}
            title={t('calendar.export_ics', currentLang, 'Kalender als .ICS iCalendar Datei für Outlook / Apple Kalender exportieren')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">.ICS</span>
          </button>

          {/* Google Sync Pill */}
          {googleUser ? (
            <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <button
                onClick={handleManualSync}
                disabled={syncState.isSyncing}
                title={t('calendar.google_sync_now', currentLang, 'Jetzt live mit Google synchronisieren')}
                className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden xl:inline">Google Sync</span>
              </button>
              <button
                onClick={handleDisconnectGoogle}
                title={t('calendar.disconnect_google', currentLang, 'Google Konto trennen')}
                className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              title={t('calendar.connect_google', currentLang, 'Google Kalender verbinden für 2-Wege Live-Synchronisation')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span className="hidden sm:inline">Google Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification Toast if active */}
      {statusNotification && (
        <div className={`px-4 py-1.5 text-xs font-semibold flex items-center justify-between border-b ${
          statusNotification.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
        }`}>
          <span>{statusNotification.text}</span>
          <button onClick={() => setStatusNotification(null)} className="opacity-70 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE: OUTLOOK LEFT PANE & CALENDAR CANVAS */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* OUTLOOK LEFT NAVIGATION PANE */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 p-3 flex flex-col gap-4 overflow-y-auto hidden md:flex shrink-0">
          
          {/* Outlook Mini Calendar with Dedicated Month Flipping Chevrons */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            
            {/* Mini Calendar Header with Prev / Next Month Arrows */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 capitalize">
                {miniCalendarMonth.toLocaleDateString(currentLang === 'de' ? 'de-DE' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' })}
              </span>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleMiniPrevMonth}
                  title="Vorheriger Monat im Minikalender"
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleMiniNextMonth}
                  title="Nächster Monat im Minikalender"
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">
              <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
            </div>

            {/* 42 Mini-Days Grid */}
            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
              {miniCalendarDays.map((cell, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    sounds.playPop();
                    setFocusedDate(cell.date);
                    setSelectedDay(cell.date);
                  }}
                  className={`h-6 rounded-md flex flex-col items-center justify-center font-medium relative transition cursor-pointer ${
                    cell.isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                      : cell.isToday
                      ? 'ring-1 ring-blue-500 text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40'
                      : cell.isCurrentMonth
                      ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                >
                  <span>{cell.dayNum}</span>
                  {cell.hasEvents && !cell.isSelected && (
                    <span className="w-1 h-1 rounded-full bg-blue-500 absolute bottom-0.5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* "Meine Kalender" (Outlook Category Checkboxes) */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Meine Kalender</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">({filteredEvents.length})</span>
            </div>

            <div className="space-y-1">
              {Object.entries(categoryColorMap).map(([key, meta]) => {
                const count = events.filter(e => {
                  const cat = e.category || (e.source === 'google' ? 'google' : 'general');
                  return cat === key;
                }).length;
                const isChecked = enabledCategories[key] !== false;
                return (
                  <label 
                    key={key} 
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition text-xs select-none"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          sounds.playClick();
                          setEnabledCategories(prev => ({ ...prev, [key]: !isChecked }));
                        }}
                        className="rounded accent-blue-600 cursor-pointer"
                      />
                      <span className={`w-2.5 h-2.5 rounded-sm ${meta.dot}`} />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{meta.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">({count})</span>
                  </label>
                );
              })}
            </div>

            {/* Quick Invoice Only Toggle */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                <Receipt className="w-3 h-3 text-indigo-600" />
                <span>Nur Rechnungen</span>
              </span>
              <input
                type="checkbox"
                checked={showInvoicesOnly}
                onChange={(e) => {
                  sounds.playClick();
                  setShowInvoicesOnly(e.target.checked);
                }}
                className="rounded accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          {/* "Nächste Termine" Widget in Sidebar */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
            <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Nächste Termine</span>
            </div>

            <div className="space-y-1.5">
              {upcomingSidebarEvents.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-1">Keine anstehenden Termine</p>
              ) : (
                upcomingSidebarEvents.map(evt => {
                  const catKey = evt.category || (evt.source === 'google' ? 'google' : 'general');
                  const catMeta = categoryColorMap[catKey] || categoryColorMap.general;
                  return (
                    <div
                      key={evt.id}
                      onClick={() => {
                        sounds.playClick();
                        setSelectedEventForDetail(evt);
                      }}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition hover:scale-[1.02] ${catMeta.accentBar} ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                    >
                      <div className="font-bold truncate text-[11px]">{evt.title}</div>
                      <div className="text-[10px] opacity-75 font-mono flex items-center justify-between mt-0.5">
                        <span>{evt.startDate}</span>
                        <span>{evt.isAllDay ? 'Ganztägig' : `${evt.startTime || '09:00'} - ${evt.endTime || '10:00'}`}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* CALENDAR MAIN WORKSPACE CANVAS */}
        <div className="flex-1 flex flex-col overflow-y-auto p-2 sm:p-3 bg-white dark:bg-slate-950">
          
          {/* VIEW: MONAT (Month Grid with Outlook Style Accent Bars) */}
          {viewMode === 'month' && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden min-h-[580px]">
              
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-center py-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
              </div>

              {/* 6-Row x 7-Col Month Cells */}
              <div className="flex-1 grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-200 dark:divide-slate-800">
                {monthGridDays.map((cell, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDay(cell.date);
                    }}
                    onDoubleClick={() => openNewEventModalWithDate(cell.dateStr)}
                    className={`p-1.5 flex flex-col justify-between transition-colors overflow-hidden group relative cursor-pointer ${
                      cell.isToday
                        ? 'bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-500/50 inset-0'
                        : cell.isSelected
                        ? 'bg-slate-100/70 dark:bg-slate-800/40'
                        : cell.isCurrentMonth
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/50'
                        : 'bg-slate-50/50 dark:bg-slate-950/50 text-slate-400 opacity-60'
                    }`}
                  >
                    {/* Day Number Header & Quick Add */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                        cell.isToday
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : cell.isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-400'
                      }`}>
                        {cell.dayNum}
                      </span>

                      {/* Quick Add Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openNewEventModalWithDate(cell.dateStr);
                        }}
                        title="Termin für diesen Tag anlegen"
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Events List Pills with Outlook Accent Bar */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-22 pr-0.5">
                      {cell.events.slice(0, 3).map((evt) => {
                        const isInv = evt.source === 'invoice';
                        const isGcal = evt.source === 'google';
                        const catKey = evt.category || (isGcal ? 'google' : 'general');
                        const catMeta = categoryColorMap[catKey] || categoryColorMap.general;
                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              sounds.playClick();
                              setSelectedEventForDetail(evt);
                            }}
                            title={`${evt.title} (${evt.isAllDay ? 'Ganztägig' : `${evt.startTime || '09:00'} - ${evt.endTime || '10:00'}`})`}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border truncate flex items-center gap-1 cursor-pointer transition hover:opacity-90 shadow-2xs ${catMeta.accentBar} ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                          >
                            {isInv ? (
                              <Receipt className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                            ) : null}
                            {evt.startTime && !evt.isAllDay && (
                              <span className="font-mono text-[9px] opacity-80 shrink-0">{evt.startTime}</span>
                            )}
                            <span className="truncate">{evt.title}</span>
                          </div>
                        );
                      })}

                      {cell.events.length > 3 && (
                        <div 
                          onClick={() => {
                            setFocusedDate(cell.date);
                            setViewMode('day');
                          }}
                          className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer text-center"
                        >
                          +{cell.events.length - 3} weitere
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: ARBEITSWOCHE (Work Week: Mo-Fr) & WOCHE (Full Week: Mo-So) */}
          {(viewMode === 'workweek' || viewMode === 'week') && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
              
              {/* Day Headers */}
              <div className={`grid ${viewMode === 'workweek' ? 'grid-cols-6' : 'grid-cols-8'} border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 divide-x divide-slate-200 dark:divide-slate-800 text-center py-2`}>
                <div className="text-[11px] font-bold text-slate-400 flex items-center justify-center">
                  Zeit
                </div>
                {currentWeekDays.map((w, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setFocusedDate(w.date);
                      setSelectedDay(w.date);
                    }}
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{w.dayName}</span>
                    <span className={`w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-xs font-bold ${
                      w.isToday ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-800 dark:text-slate-200'
                    }`}>
                      {w.dayNum}
                    </span>
                  </div>
                ))}
              </div>

              {/* All-Day Events Banner Row */}
              <div className={`grid ${viewMode === 'workweek' ? 'grid-cols-6' : 'grid-cols-8'} border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 divide-x divide-slate-200 dark:divide-slate-800 text-xs py-1 px-1`}>
                <div className="text-[10px] font-bold text-slate-400 text-center self-center">
                  Ganztägig
                </div>
                {currentWeekDays.map((w, idx) => {
                  const allDayEvents = w.events.filter(e => e.isAllDay);
                  return (
                    <div key={idx} className="space-y-1 p-0.5 min-h-[26px]">
                      {allDayEvents.map(evt => {
                        const catKey = evt.category || (evt.source === 'google' ? 'google' : 'general');
                        const catMeta = categoryColorMap[catKey] || categoryColorMap.general;
                        return (
                          <div
                            key={evt.id}
                            onClick={() => {
                              sounds.playClick();
                              setSelectedEventForDetail(evt);
                            }}
                            className={`p-1 rounded text-[10px] font-semibold border truncate cursor-pointer transition hover:opacity-90 ${catMeta.accentBar} ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                            title={evt.title}
                          >
                            {evt.title}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Hourly Time Grid with Outlook Time Indicators */}
              <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {HOURS_RANGE.map(hour => {
                    const hourStr = `${String(hour).padStart(2, '0')}:00`;
                    const isCurrentHourSlot = now.getHours() === hour;

                    return (
                      <div key={hour} className={`grid ${viewMode === 'workweek' ? 'grid-cols-6' : 'grid-cols-8'} divide-x divide-slate-100 dark:divide-slate-800/80 min-h-[52px] group relative`}>
                        {/* Time Label */}
                        <div className="text-[11px] font-mono text-slate-400 text-center pt-1 select-none font-semibold">
                          {hourStr}
                        </div>

                        {/* Day slots for this hour */}
                        {currentWeekDays.map((w, dIdx) => {
                          const hourEvents = w.events.filter(e => {
                            if (e.isAllDay) return false;
                            if (!e.startTime) return hour === 9;
                            const startH = parseInt(e.startTime.split(':')[0], 10);
                            return startH === hour;
                          });

                          return (
                            <div
                              key={dIdx}
                              onClick={() => openNewEventModalWithDate(w.dateStr, hourStr)}
                              className="p-1 relative hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition cursor-pointer"
                            >
                              {/* Live Current Time Marker Line on Today's column */}
                              {w.isToday && isCurrentHourSlot && (
                                <div 
                                  className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                                  style={{ top: `${(currentMinute / 60) * 100}%` }}
                                >
                                  <span className="w-2 h-2 rounded-full bg-rose-600 -ml-1 shadow-xs" />
                                  <div className="h-[2px] w-full bg-rose-600/80" />
                                </div>
                              )}

                              {hourEvents.map(evt => {
                                const catKey = evt.category || (evt.source === 'google' ? 'google' : 'general');
                                const catMeta = categoryColorMap[catKey] || categoryColorMap.general;
                                return (
                                  <div
                                    key={evt.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sounds.playClick();
                                      setSelectedEventForDetail(evt);
                                    }}
                                    className={`p-1.5 rounded-lg border text-xs cursor-pointer shadow-2xs transition hover:scale-[1.02] mb-1 ${catMeta.accentBar} ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                                  >
                                    <div className="font-bold text-[11px] truncate">{evt.title}</div>
                                    <div className="text-[9px] opacity-80 flex items-center gap-1 font-mono mt-0.5">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span>{evt.startTime || '09:00'} - {evt.endTime || '10:00'}</span>
                                    </div>
                                    {evt.location && (
                                      <div className="text-[9px] opacity-75 flex items-center gap-1 truncate mt-0.5">
                                        <MapPin className="w-2.5 h-2.5" />
                                        <span className="truncate">{evt.location}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: TAG (Day View with Timeline and Detailed Cards) */}
          {viewMode === 'day' && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-4 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white capitalize">
                    {focusedDate.toLocaleDateString(currentLang === 'de' ? 'de-DE' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {focusedDayEvents.length} {focusedDayEvents.length === 1 ? 'Termin' : 'Termine'} geplant
                  </p>
                </div>
                <button
                  onClick={() => openNewEventModalWithDate(formatLocalDate(focusedDate))}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Termin hinzufügen</span>
                </button>
              </div>

              {/* Day Hourly Slots Grid */}
              <div className="space-y-2.5">
                {focusedDayEvents.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <CalendarDays className="w-10 h-10 mx-auto opacity-40 text-blue-500" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Keine Termine für diesen Tag eingetragen</p>
                    <button
                      onClick={() => openNewEventModalWithDate(formatLocalDate(focusedDate))}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Jetzt ersten Termin für diesen Tag anlegen</span>
                    </button>
                  </div>
                ) : (
                  focusedDayEvents.map(evt => {
                    const catKey = evt.category || (evt.source === 'google' ? 'google' : 'general');
                    const catMeta = categoryColorMap[catKey] || categoryColorMap.general;
                    const durationStr = getEventDurationString(evt.startDate, evt.startTime, evt.endDate, evt.endTime, evt.isAllDay);

                    return (
                      <div
                        key={evt.id}
                        onClick={() => {
                          sounds.playClick();
                          setSelectedEventForDetail(evt);
                        }}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer shadow-2xs transition hover:shadow-md ${catMeta.accentBar} ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${catMeta.dot}`} />
                            <h4 className="text-sm font-bold">{evt.title}</h4>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 font-bold">
                              {evt.source.toUpperCase()}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold">
                              ⏱ {durationStr}
                            </span>
                          </div>
                          {evt.description && (
                            <p className="text-xs opacity-80 line-clamp-2 max-w-xl">{evt.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs opacity-80 pt-1 font-medium">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              <span>{evt.isAllDay ? 'Ganztägig' : `${evt.startTime || '09:00'} - ${evt.endTime || '10:00'} Uhr`}</span>
                            </span>
                            {evt.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                <span>{evt.location}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEventForDetail(evt);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 text-xs font-bold hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                          >
                            Details & Bearbeiten
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW: AGENDA (Chronological Outlook Schedule) */}
          {viewMode === 'agenda' && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-4 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Agenda & Zeitplan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chronologische Übersicht aller Termine, Fälligkeiten und Google Events
                  </p>
                </div>
                <button
                  onClick={() => openNewEventModalWithDate()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Neuer Termin</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {filteredEvents.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <CalendarDays className="w-10 h-10 mx-auto opacity-40 text-blue-500" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Keine anstehenden Termine gefunden</p>
                  </div>
                ) : (
                  filteredEvents.map(evt => {
                    const catKey = evt.category || (evt.source === 'google' ? 'google' : 'general');
                    const catMeta = categoryColorMap[catKey] || categoryColorMap.general;
                    const isInv = evt.source === 'invoice';
                    const durationStr = getEventDurationString(evt.startDate, evt.startTime, evt.endDate, evt.endTime, evt.isAllDay);

                    return (
                      <div
                        key={evt.id}
                        onClick={() => {
                          sounds.playClick();
                          setSelectedEventForDetail(evt);
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer shadow-2xs transition hover:shadow-md ${catMeta.accentBar} ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center w-14 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
                            <span className="block text-[10px] font-bold uppercase text-slate-400">
                              {new Date(evt.startDate).toLocaleDateString(currentLang === 'de' ? 'de-DE' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' })}
                            </span>
                            <span className="block text-sm font-black text-slate-900 dark:text-white">
                              {parseInt(evt.startDate.split('-')[2] || '1', 10)}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              {isInv && <Receipt className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                              <h4 className="text-xs font-bold">{evt.title}</h4>
                            </div>
                            {evt.description && (
                              <p className="text-[11px] opacity-75 line-clamp-1 max-w-md">{evt.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-[10px] font-mono opacity-80 pt-0.5">
                              <span>{evt.startDate}</span>
                              <span>{evt.isAllDay ? 'Ganztägig' : `${evt.startTime || '09:00'} - ${evt.endTime || '10:00'}`}</span>
                              <span className="opacity-70">({durationStr})</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800">
                            {catMeta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. MODAL: CREATE NEW APPOINTMENT (OUTLOOK-STYLE WITH START & END TIME & DURATION) */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-4 animate-scale-in">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600 text-white shadow-2xs">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Neuer Termin</h3>
                  <p className="text-xs text-slate-500">In Google Kalender oder lokaler Datenbank eintragen</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewEventModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEventSubmit} className="space-y-3.5">
              
              {/* Title / Betreff */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Betreff / Titel *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="z.B. Kundengespräch mit Fa. Müller oder Projekt-Review"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                />
              </div>

              {/* Section Header: Times & Ganztägig Toggle */}
              <div className="flex items-center justify-between pt-1 pb-0.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Terminzeitraum & Uhrzeiten
                </span>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setNewEventIsAllDay(prev => {
                      const next = !prev;
                      if (!next && (!newEventStartTime || !newEventEndTime)) {
                        const { start, end } = getCurrentTimeFormatted();
                        setNewEventStartTime(start);
                        setNewEventEndTime(end);
                      }
                      return next;
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    newEventIsAllDay
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60'
                  }`}
                  title="Zwischen genauer Uhrzeit und ganztägigem Termin umschalten"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Ganztägig</span>
                  {newEventIsAllDay && <Check className="w-3 h-3 ml-0.5" />}
                </button>
              </div>

              {/* Start Date & Start Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Startdatum
                  </label>
                  <input
                    type="date"
                    required
                    value={newEventStartDate}
                    onChange={(e) => {
                      setNewEventStartDate(e.target.value);
                      if (newEventEndDate < e.target.value) {
                        setNewEventEndDate(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>

                {!newEventIsAllDay ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Startzeit
                    </label>
                    <input
                      type="time"
                      value={newEventStartTime}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setNewEventStartTime(newStart);
                        // Auto-advance End time by 1 hour
                        setNewEventEndTime(addMinutesToTime(newStart, 60));
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none font-mono font-bold text-blue-600 dark:text-blue-400"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col justify-end pb-0.5">
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                      Ganzer Tag aktiv
                    </span>
                  </div>
                )}
              </div>

              {/* End Date & End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Enddatum
                  </label>
                  <input
                    type="date"
                    required
                    value={newEventEndDate}
                    onChange={(e) => setNewEventEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>

                {!newEventIsAllDay ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Endzeit (+1 Std. Standard)
                    </label>
                    <input
                      type="time"
                      value={newEventEndTime}
                      onChange={(e) => setNewEventEndTime(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none font-mono font-bold text-blue-600 dark:text-blue-400"
                    />
                  </div>
                ) : null}
              </div>

              {/* Quick Duration Buttons & Duration Preview */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400">
                  <span>Dauer:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {getEventDurationString(newEventStartDate, newEventStartTime, newEventEndDate, newEventEndTime, newEventIsAllDay)}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {[
                    { label: '15m', mins: 15 },
                    { label: '30m', mins: 30 },
                    { label: '45m', mins: 45 },
                    { label: '1h', mins: 60 },
                    { label: '2h', mins: 120 },
                    { label: 'Ganztägig', mins: -1 }
                  ].map(({ label, mins }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleQuickDuration(mins)}
                      className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:border-blue-400 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category & Storage Destination */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kategorie
                  </label>
                  <select
                    value={newEventCategory}
                    onChange={(e) => setNewEventCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    <option value="general">Allgemein</option>
                    <option value="customer">Kundentermin</option>
                    <option value="meeting">Meeting / Besprechung</option>
                    <option value="deadline">Frist / Deadline</option>
                    <option value="personal">Privat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Zielspeicher
                  </label>
                  <select
                    value={newEventTarget}
                    onChange={(e) => setNewEventTarget(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none font-semibold"
                  >
                    {accessToken && <option value="google">Google Kalender (Live Sync)</option>}
                    <option value="local">Lokale SOCDOF Datenbank</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ort / Besprechungslink (Optional)
                </label>
                <input
                  type="text"
                  placeholder="z.B. Konferenzraum 2 oder Microsoft Teams / Google Meet Link"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notizen & Agenda (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Agenda, Tagesordnungspunkte, Teilnehmer..."
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Termin speichern</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: EVENT INSPECTOR & MANAGEMENT (FULL START & END TIME EDITING) */}
      {selectedEventForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${categoryColorMap[selectedEventForDetail.category || (selectedEventForDetail.source === 'google' ? 'google' : 'general')]?.dot || 'bg-slate-400'}`} />
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  {selectedEventForDetail.source === 'invoice' ? 'Fakturierung' : selectedEventForDetail.source === 'google' ? 'Google Calendar' : 'Lokaler Termin'}
                </span>
              </div>
              <button 
                onClick={() => {
                  setSelectedEventForDetail(null);
                  setIsEditingEvent(false);
                  setConfirmDeleteId(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isEditingEvent ? (
              <form onSubmit={handleUpdateEventSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Betreff / Titel</label>
                  <input
                    type="text"
                    required
                    value={selectedEventForDetail.title}
                    onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, title: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Startdatum</label>
                    <input
                      type="date"
                      required
                      value={selectedEventForDetail.startDate}
                      onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, startDate: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Startzeit</label>
                    <input
                      type="time"
                      value={selectedEventForDetail.startTime || '09:00'}
                      onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, startTime: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Enddatum</label>
                    <input
                      type="date"
                      required
                      value={selectedEventForDetail.endDate || selectedEventForDetail.startDate}
                      onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, endDate: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Endzeit</label>
                    <input
                      type="time"
                      value={selectedEventForDetail.endTime || '10:00'}
                      onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, endTime: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ort / Besprechungslink</label>
                  <input
                    type="text"
                    value={selectedEventForDetail.location || ''}
                    onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, location: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notizen & Agenda</label>
                  <textarea
                    rows={2}
                    value={selectedEventForDetail.description || ''}
                    onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, description: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingEvent(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Speichern
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">{selectedEventForDetail.title}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>{selectedEventForDetail.startDate} {selectedEventForDetail.endDate && selectedEventForDetail.endDate !== selectedEventForDetail.startDate ? `bis ${selectedEventForDetail.endDate}` : ''}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>{selectedEventForDetail.isAllDay ? 'Ganztägig' : `${selectedEventForDetail.startTime || '09:00'} - ${selectedEventForDetail.endTime || '10:00'} Uhr`}</span>
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      ⏱ Dauer: {getEventDurationString(selectedEventForDetail.startDate, selectedEventForDetail.startTime, selectedEventForDetail.endDate, selectedEventForDetail.endTime, selectedEventForDetail.isAllDay)}
                    </span>
                  </div>
                </div>

                {selectedEventForDetail.location && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 truncate">{selectedEventForDetail.location}</span>
                  </div>
                )}

                {selectedEventForDetail.description && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {selectedEventForDetail.description}
                  </div>
                )}

                {/* Linked Invoice Action Button */}
                {selectedEventForDetail.invoiceId && onOpenInvoice && (
                  <button
                    onClick={() => {
                      onOpenInvoice(selectedEventForDetail.invoiceId!);
                      setSelectedEventForDetail(null);
                    }}
                    className="w-full p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Zugehörige Rechnung #{selectedEventForDetail.invoiceNumber || selectedEventForDetail.invoiceId} öffnen</span>
                  </button>
                )}

                {/* External Google Calendar Link */}
                {selectedEventForDetail.htmlLink && (
                  <a
                    href={selectedEventForDetail.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>In Google Kalender Web öffnen</span>
                  </a>
                )}

                {/* Confirm Delete prompt */}
                {confirmDeleteId === selectedEventForDetail.id ? (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/60 rounded-xl border border-rose-200 dark:border-rose-800 space-y-2">
                    <p className="text-xs text-rose-800 dark:text-rose-200 font-semibold">
                      Möchten Sie diesen Termin wirklich unwiderruflich löschen?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold cursor-pointer"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(selectedEventForDetail)}
                        className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
                      >
                        Ja, löschen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      {selectedEventForDetail.source !== 'invoice' && (
                        <button
                          onClick={() => setConfirmDeleteId(selectedEventForDetail.id)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Löschen</span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDuplicateEvent(selectedEventForDetail)}
                        className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                        title="Diesen Termin als lokale Vorlage duplizieren"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Duplizieren</span>
                      </button>
                    </div>

                    {selectedEventForDetail.source !== 'invoice' && (
                      <button
                        onClick={() => setIsEditingEvent(true)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Bearbeiten</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. OUTLOOK 365 BOTTOM STATUS BAR (With Quick Search Info, Sync State & Count) */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-1.5 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 select-none z-10">
        
        {/* Left: Event Count and Filter Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <CalendarCheck2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>
              {filteredEvents.length} {filteredEvents.length === 1 ? 'Termin / Beleg' : 'Termine / Belege'}
            </span>
          </div>

          {searchQuery && (
            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 text-[11px] font-semibold">
              <Search className="w-3 h-3 text-blue-500" />
              <span>Gefiltert nach: "{searchQuery}"</span>
              <button 
                onClick={() => setSearchQuery('')}
                className="hover:text-blue-900 dark:hover:text-white ml-0.5 cursor-pointer font-bold"
                title="Suchfilter aufheben"
              >
                ✕
              </button>
            </div>
          )}

          {showInvoicesOnly && (
            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
              Nur Rechnungen aktiv
            </span>
          )}
        </div>

        {/* Right: Quick Shortcuts & Sync Status */}
        <div className="flex items-center gap-4 text-[11px]">
          <span className="hidden sm:inline text-slate-400 font-mono">
            Doppelklick = Neuer Termin
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${googleUser ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span>{googleUser ? `Verbunden mit ${googleUser.email || 'Google'}` : 'Offline-Modus'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
