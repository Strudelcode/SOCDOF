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
  AlignLeft, 
  Tag, 
  Filter, 
  Layers, 
  AlertCircle, 
  CalendarDays, 
  UserCheck, 
  LogOut, 
  FileText, 
  Receipt,
  Search,
  X
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
  fetchGoogleCalendarEvents, 
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
  getGoogleAccessToken
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

type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

export const CalendarModule: React.FC<CalendarModuleProps> = ({
  invoices,
  company,
  onOpenInvoice,
  onUpdateCompany
}) => {
  const currentLang = useLanguage();

  // Auth & Sync State
  const [googleUser, setGoogleUser] = useState<any>(getCachedGoogleUserMeta);
  const [accessToken, setAccessToken] = useState<string | null>(getGoogleAccessToken);
  const [syncState, setSyncState] = useState({
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
  const [searchQuery, setSearchQuery] = useState('');

  // Category & Filter Toggles
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({
    invoice: true,
    customer: true,
    meeting: true,
    deadline: true,
    personal: true,
    general: true
  });
  const [showInvoicesOnly, setShowInvoicesOnly] = useState(false);

  // Modals & Inspection State
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<CalendarAppEvent | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Event Form State
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventStartDate, setNewEventStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEventStartTime, setNewEventStartTime] = useState('10:00');
  const [newEventEndDate, setNewEventEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEventEndTime, setNewEventEndTime] = useState('11:00');
  const [newEventIsAllDay, setNewEventIsAllDay] = useState(false);
  const [newEventCategory, setNewEventCategory] = useState<'invoice' | 'customer' | 'meeting' | 'deadline' | 'personal' | 'general'>('general');
  const [newEventTarget, setNewEventTarget] = useState<'google' | 'local'>('google');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Events Cache & State
  const [events, setEvents] = useState<CalendarAppEvent[]>(() => buildUnifiedCalendarEvents(invoices, company.currency));

  // Reload events from all sources
  const refreshUnifiedEvents = useCallback(() => {
    const updated = buildUnifiedCalendarEvents(invoices, company.currency);
    setEvents(updated);
  }, [invoices, company.currency]);

  // Subscribe to Auth and Sync changes
  useEffect(() => {
    const unsubAuth = subscribeToGoogleAuth((user, token) => {
      setGoogleUser(user);
      setAccessToken(token);
      if (token) {
        // Load available calendars
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

    // Trigger initial sync on mount
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
      setCalendarsList([]);
      refreshUnifiedEvents();
      setStatusNotification({
        text: 'Google Konto erfolgreich getrennt.',
        type: 'success'
      });
    } catch (err: any) {
      setStatusNotification({
        text: err.message || 'Abmelden fehlgeschlagen',
        type: 'error'
      });
    }
  };

  // Manual Trigger Sync Now
  const handleManualSync = async () => {
    if (!accessToken) {
      handleConnectGoogle();
      return;
    }
    sounds.playClick();
    const result = await performFullGoogleCalendarSync(invoices, selectedCalendarId, company.currency);
    if (result.success) {
      sounds.playSuccess();
      setStatusNotification({
        text: result.message,
        type: 'success'
      });
    } else {
      sounds.playWarning();
      setStatusNotification({
        text: result.message,
        type: 'error'
      });
    }
    refreshUnifiedEvents();
  };

  // Date Navigation Helpers
  const handlePrev = () => {
    sounds.playPop();
    const next = new Date(focusedDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() - 7);
    } else if (viewMode === 'day') {
      next.setDate(next.getDate() - 1);
    }
    setFocusedDate(next);
  };

  const handleNext = () => {
    sounds.playPop();
    const next = new Date(focusedDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
    } else if (viewMode === 'day') {
      next.setDate(next.getDate() + 1);
    }
    setFocusedDate(next);
  };

  const handleToday = () => {
    sounds.playClick();
    const today = new Date();
    setFocusedDate(today);
    setSelectedDay(today);
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      // Category filter
      const cat = evt.category || 'general';
      if (!enabledCategories[cat]) return false;

      // Invoices only
      if (showInvoicesOnly && evt.source !== 'invoice' && !evt.title.includes('[SOCDOF #')) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = evt.title.toLowerCase().includes(q);
        const matchesDesc = (evt.description || '').toLowerCase().includes(q);
        const matchesLoc = (evt.location || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesLoc) return false;
      }

      return true;
    });
  }, [events, enabledCategories, showInvoicesOnly, searchQuery]);

  // Month Grid Calculation (42 cells)
  const monthGridDays = useMemo(() => {
    const year = focusedDate.getFullYear();
    const month = focusedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const isSameDate = (d1: Date, d2: Date) => (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );

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
      const dStr = d.toISOString().slice(0, 10);
      const dayEvts = filteredEvents.filter(e => e.startDate === dStr);
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: isSameDate(d, now),
        isSelected: isSameDate(d, selectedDay),
        events: dayEvts
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dStr = d.toISOString().slice(0, 10);
      const dayEvts = filteredEvents.filter(e => e.startDate === dStr);
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: true,
        isToday: isSameDate(d, now),
        isSelected: isSameDate(d, selectedDay),
        events: dayEvts
      });
    }

    // Next month padding to reach exactly 42 cells
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dStr = d.toISOString().slice(0, 10);
      const dayEvts = filteredEvents.filter(e => e.startDate === dStr);
      cells.push({
        date: d,
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: isSameDate(d, now),
        isSelected: isSameDate(d, selectedDay),
        events: dayEvts
      });
    }

    return cells;
  }, [focusedDate, selectedDay, filteredEvents]);

  // Week View Days Calculation (Monday to Sunday)
  const weekDays = useMemo(() => {
    const current = new Date(focusedDate);
    const dayOfWeek = (current.getDay() + 6) % 7; // Monday = 0
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - dayOfWeek);

    const isSameDate = (d1: Date, d2: Date) => (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
    const now = new Date();

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      const dayEvts = filteredEvents.filter(e => e.startDate === dStr);
      days.push({
        date: d,
        dateStr: dStr,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        isToday: isSameDate(d, now),
        isSelected: isSameDate(d, selectedDay),
        events: dayEvts
      });
    }
    return days;
  }, [focusedDate, selectedDay, filteredEvents]);

  // Open New Event Modal with optional pre-filled date
  const openNewEventModalWithDate = (dateStr?: string) => {
    sounds.playPop();
    const d = dateStr || new Date().toISOString().slice(0, 10);
    setNewEventTitle('');
    setNewEventDesc('');
    setNewEventLocation('');
    setNewEventStartDate(d);
    setNewEventStartTime('10:00');
    setNewEventEndDate(d);
    setNewEventEndTime('11:00');
    setNewEventIsAllDay(false);
    setNewEventCategory('general');
    setNewEventTarget(accessToken ? 'google' : 'local');
    setIsNewEventModalOpen(true);
  };

  // Submit Create New Event
  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    setIsSubmitting(true);
    try {
      if (newEventTarget === 'google' && accessToken) {
        // Push directly to Google Calendar API
        await createGoogleCalendarEvent(selectedCalendarId, {
          title: newEventTitle.trim(),
          description: newEventDesc.trim(),
          location: newEventLocation.trim(),
          startDate: newEventStartDate,
          startTime: newEventIsAllDay ? undefined : newEventStartTime,
          endDate: newEventEndDate,
          endTime: newEventIsAllDay ? undefined : newEventEndTime,
          isAllDay: newEventIsAllDay
        });
        sounds.playSuccess();
        setStatusNotification({
          text: `Termin "${newEventTitle}" in Google Kalender angelegt.`,
          type: 'success'
        });
        // Sync cache
        await performFullGoogleCalendarSync(invoices, selectedCalendarId, company.currency);
      } else {
        // Save locally to SOCDOF custom events
        const newLocalEvent: CalendarAppEvent = {
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          title: newEventTitle.trim(),
          description: newEventDesc.trim(),
          location: newEventLocation.trim(),
          startDate: newEventStartDate,
          startTime: newEventIsAllDay ? undefined : newEventStartTime,
          endDate: newEventEndDate,
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
            startTime: selectedEventForDetail.startTime,
            endDate: selectedEventForDetail.endDate,
            endTime: selectedEventForDetail.endTime,
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

  // Category Color Map
  const categoryColorMap: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    invoice: { bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500', label: 'Rechnungen' },
    customer: { bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'Kundentermin' },
    meeting: { bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', label: 'Meeting' },
    deadline: { bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', label: 'Frist / Deadline' },
    personal: { bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', label: 'Privat' },
    general: { bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-400', label: 'Allgemein' }
  };

  // Month & Year string formatted in language
  const formattedMonthYear = useMemo(() => {
    return focusedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [focusedDate]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans select-none">
      
      {/* 1. TOP HEADER & GOOGLE LIVE STATUS BAR */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        
        {/* Left: App Title & Dynamic Calendar Icon */}
        <div className="flex items-center gap-3">
          <DynamicCalendarIcon size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Google Kalender & Agenda</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  LIVE 2-WAY
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automatische Live-Synchronisation für Rechnungsfälligkeiten, Termine & Google Events
            </p>
          </div>
        </div>

        {/* Center: Google Account Status Pill & Sync Button */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700">
          {googleUser ? (
            <div className="flex items-center gap-2 px-2.5 py-1">
              {googleUser.photoURL ? (
                <img 
                  src={googleUser.photoURL} 
                  alt="Avatar" 
                  className="w-5 h-5 rounded-full object-cover border border-slate-300 dark:border-slate-600"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserCheck className="w-4 h-4 text-emerald-500" />
              )}
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[140px] truncate">
                {googleUser.email || googleUser.displayName || 'Google Verbunden'}
              </span>

              {/* Target Calendar Selector */}
              {calendarsList.length > 0 && (
                <select
                  value={selectedCalendarId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedCalendarId(nextId);
                    if (onUpdateCompany) {
                      onUpdateCompany({ google_cal_target_calendar_id: nextId });
                    }
                  }}
                  className="text-[11px] font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 max-w-[130px] truncate text-slate-700 dark:text-slate-300 focus:outline-none"
                  title="Zielkalender für Synchronisation auswählen"
                >
                  {calendarsList.map(cal => (
                    <option key={cal.id} value={cal.id}>
                      {cal.summary} {cal.primary ? '(Standard)' : ''}
                    </option>
                  ))}
                </select>
              )}

              {/* Sync Now Button */}
              <button
                onClick={handleManualSync}
                disabled={syncState.isSyncing}
                title="Jetzt live mit Google synchronisieren"
                className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-bold hidden sm:inline">Sync</span>
              </button>

              {/* Disconnect Button */}
              <button
                onClick={handleDisconnectGoogle}
                title="Google Konto trennen"
                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Mit Google verbinden</span>
            </button>
          )}
        </div>

        {/* Right: Primary Action "+ Neuer Termin" */}
        <button
          onClick={() => openNewEventModalWithDate()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Neuer Termin</span>
        </button>
      </div>

      {/* 2. SUBHEADER: NAVIGATION, SEARCH & VIEW SWITCHER */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Navigation: Today, Prev, Next, Month Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition shadow-2xs"
          >
            Heute
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              onClick={handlePrev}
              title="Vorheriger Monat / Woche"
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              title="Nächster Monat / Woche"
              className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-sm font-extrabold text-slate-900 dark:text-white capitalize ml-2">
            {formattedMonthYear}
          </span>
        </div>

        {/* Search & Quick Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Termine & Rechnungen suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* View Mode Tabs (Monat, Woche, Tag, Agenda) */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
          {(['month', 'week', 'day', 'agenda'] as CalendarViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                sounds.playClick();
                setViewMode(mode);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition capitalize ${
                viewMode === mode
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {mode === 'month' ? 'Monat' : mode === 'week' ? 'Woche' : mode === 'day' ? 'Tag' : 'Agenda'}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Toast if active */}
      {statusNotification && (
        <div className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b ${
          statusNotification.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
        }`}>
          <span>{statusNotification.text}</span>
          <button onClick={() => setStatusNotification(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* 3. MAIN WORKSPACE: SIDEBAR & CALENDAR GRID */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Collapsible Categories & Filter Sidebar */}
        <div className="w-60 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-4 flex flex-col gap-5 overflow-y-auto hidden md:flex">
          
          {/* Mini Calendar Widget */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
              <span className="capitalize">{focusedDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
              <span className="text-[10px] font-normal text-slate-400">{filteredEvents.length} Termine</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 mb-1">
              <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
              {monthGridDays.slice(0, 35).map((cell, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    sounds.playPop();
                    setFocusedDate(cell.date);
                    setSelectedDay(cell.date);
                  }}
                  className={`h-6 rounded-md flex items-center justify-center font-medium transition ${
                    cell.isToday
                      ? 'bg-blue-600 text-white font-bold'
                      : cell.isSelected
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold'
                      : cell.isCurrentMonth
                      ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                >
                  {cell.dayNum}
                </button>
              ))}
            </div>
          </div>

          {/* Calendars & Filter Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-500" />
                <span>Kategorien</span>
              </span>
            </div>

            <div className="space-y-1.5">
              {Object.entries(categoryColorMap).map(([key, meta]) => {
                const count = events.filter(e => (e.category || 'general') === key).length;
                const isChecked = Boolean(enabledCategories[key]);
                return (
                  <label 
                    key={key} 
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          sounds.playClick();
                          setEnabledCategories(prev => ({ ...prev, [key]: !prev[key] }));
                        }}
                        className="rounded accent-blue-600 cursor-pointer"
                      />
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{meta.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Invoice Filter Toggle */}
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-indigo-600" />
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
            <p className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
              Hebt alle Fälligkeitstermine offener und bezahlter Kundenrechnungen hervor.
            </p>
          </div>
        </div>

        {/* Calendar View Canvas */}
        <div className="flex-1 flex flex-col overflow-y-auto p-3 sm:p-4">
          
          {/* VIEW: MONTH VIEW (Standard 42-cell Grid) */}
          {viewMode === 'month' && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden min-h-[560px]">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 text-center py-2 text-xs font-bold text-slate-500 dark:text-slate-400">
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
                        ? 'bg-blue-50/30 dark:bg-blue-950/20'
                        : cell.isSelected
                        ? 'bg-slate-100/60 dark:bg-slate-800/40'
                        : cell.isCurrentMonth
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        : 'bg-slate-50/50 dark:bg-slate-950/50 text-slate-400 opacity-60'
                    }`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        cell.isToday
                          ? 'bg-blue-600 text-white shadow-xs'
                          : cell.isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-400'
                      }`}>
                        {cell.dayNum}
                      </span>

                      {/* Quick Add on Hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openNewEventModalWithDate(cell.dateStr);
                        }}
                        title="Termin an diesem Tag anlegen"
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Events List Pills */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-20 pr-0.5">
                      {cell.events.slice(0, 3).map((evt) => {
                        const isInv = evt.source === 'invoice';
                        const isGcal = evt.source === 'google';
                        const catMeta = categoryColorMap[evt.category || 'general'];
                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              sounds.playClick();
                              setSelectedEventForDetail(evt);
                            }}
                            title={`${evt.title} ${evt.startTime ? `(${evt.startTime})` : ''}`}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border truncate flex items-center gap-1 cursor-pointer transition hover:opacity-90 shadow-2xs ${catMeta.bg} ${catMeta.text}`}
                          >
                            {isInv ? (
                              <Receipt className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                            ) : isGcal ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            )}
                            {evt.startTime && <span className="font-mono text-[9px] opacity-75 shrink-0">{evt.startTime}</span>}
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

          {/* VIEW: WEEK VIEW */}
          {viewMode === 'week' && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 divide-x divide-slate-200 dark:divide-slate-800 text-center py-2.5">
                {weekDays.map((w, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">{w.dayName}</span>
                    <span className={`w-7 h-7 mt-1 rounded-full flex items-center justify-center text-xs font-bold ${
                      w.isToday ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-800 dark:text-slate-200'
                    }`}>
                      {w.dayNum}
                    </span>
                  </div>
                ))}
              </div>

              {/* 7 Columns for Week */}
              <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200 dark:divide-slate-800 p-2 overflow-y-auto">
                {weekDays.map((w, idx) => (
                  <div key={idx} className="p-1 space-y-1.5 min-h-[400px]">
                    {w.events.map(evt => {
                      const catMeta = categoryColorMap[evt.category || 'general'];
                      return (
                        <div
                          key={evt.id}
                          onClick={() => {
                            sounds.playClick();
                            setSelectedEventForDetail(evt);
                          }}
                          className={`p-2 rounded-xl border text-xs cursor-pointer shadow-2xs transition hover:scale-[1.02] ${catMeta.bg} ${catMeta.text}`}
                        >
                          <div className="font-bold truncate">{evt.title}</div>
                          {evt.startTime && (
                            <div className="text-[10px] opacity-80 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{evt.startTime} - {evt.endTime || 'Ende'}</span>
                            </div>
                          )}
                          {evt.location && (
                            <div className="text-[10px] opacity-75 flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{evt.location}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button
                      onClick={() => openNewEventModalWithDate(w.dateStr)}
                      className="w-full py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-blue-500 hover:border-blue-400 text-[11px] font-semibold transition"
                    >
                      + Termin
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: DAY VIEW */}
          {viewMode === 'day' && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white capitalize">
                    {focusedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {filteredEvents.filter(e => e.startDate === focusedDate.toISOString().slice(0, 10)).length} Termine an diesem Tag
                  </p>
                </div>
                <button
                  onClick={() => openNewEventModalWithDate(focusedDate.toISOString().slice(0, 10))}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Termin hinzufügen</span>
                </button>
              </div>

              {/* Day Events Timeline List */}
              <div className="space-y-3">
                {filteredEvents.filter(e => e.startDate === focusedDate.toISOString().slice(0, 10)).length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <CalendarDays className="w-10 h-10 mx-auto opacity-40" />
                    <p className="text-sm font-semibold">Keine Termine für diesen Tag geplant</p>
                    <button
                      onClick={() => openNewEventModalWithDate(focusedDate.toISOString().slice(0, 10))}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Jetzt ersten Termin anlegen
                    </button>
                  </div>
                ) : (
                  filteredEvents
                    .filter(e => e.startDate === focusedDate.toISOString().slice(0, 10))
                    .map(evt => {
                      const catMeta = categoryColorMap[evt.category || 'general'];
                      return (
                        <div
                          key={evt.id}
                          onClick={() => {
                            sounds.playClick();
                            setSelectedEventForDetail(evt);
                          }}
                          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer shadow-xs transition hover:shadow-md ${catMeta.bg} ${catMeta.text}`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${catMeta.dot}`} />
                              <h4 className="text-sm font-bold">{evt.title}</h4>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800">
                                {evt.source.toUpperCase()}
                              </span>
                            </div>
                            {evt.description && (
                              <p className="text-xs opacity-80 line-clamp-2 max-w-xl">{evt.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs opacity-75 pt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{evt.isAllDay ? 'Ganztägig' : `${evt.startTime || '09:00'} - ${evt.endTime || '10:00'}`}</span>
                              </span>
                              {evt.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
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
                              className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 text-xs font-semibold hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* VIEW: AGENDA VIEW */}
          {viewMode === 'agenda' && (
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Agenda & Chronologische Terminübersicht
                  </h3>
                  <p className="text-xs text-slate-500">
                    Alle anstehenden Termine, Rechnungsfälligkeiten und Google Events sortiert nach Datum
                  </p>
                </div>
                <button
                  onClick={() => openNewEventModalWithDate()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Neuer Termin</span>
                </button>
              </div>

              <div className="space-y-3">
                {filteredEvents.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <CalendarDays className="w-10 h-10 mx-auto opacity-40" />
                    <p className="text-sm font-semibold">Keine anstehenden Termine gefunden</p>
                  </div>
                ) : (
                  filteredEvents.map(evt => {
                    const catMeta = categoryColorMap[evt.category || 'general'];
                    const isInv = evt.source === 'invoice';
                    return (
                      <div
                        key={evt.id}
                        onClick={() => {
                          sounds.playClick();
                          setSelectedEventForDetail(evt);
                        }}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer shadow-xs transition hover:shadow-md ${catMeta.bg} ${catMeta.text}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center w-14 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
                            <span className="block text-[10px] font-bold uppercase text-slate-400">
                              {new Date(evt.startDate).toLocaleDateString(undefined, { weekday: 'short' })}
                            </span>
                            <span className="block text-sm font-black text-slate-900 dark:text-white">
                              {new Date(evt.startDate).getDate()}
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
                            <span className="text-[10px] font-mono opacity-70">
                              {evt.startDate} {evt.startTime ? `• ${evt.startTime}` : '• Ganztägig'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800">
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

      {/* 4. MODAL: CREATE NEW EVENT */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-fade-in">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Neuer Termin</h3>
                  <p className="text-xs text-slate-500">In Google Kalender oder lokal speichern</p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewEventModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEventSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Titel / Betreff *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Kundengespräch Firma Schmidt"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Startdatum
                  </label>
                  <input
                    type="date"
                    required
                    value={newEventStartDate}
                    onChange={(e) => setNewEventStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>

                {!newEventIsAllDay && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Startzeit
                    </label>
                    <input
                      type="time"
                      value={newEventStartTime}
                      onChange={(e) => setNewEventStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              {/* All Day switch */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Ganztägiger Termin</span>
                <input
                  type="checkbox"
                  checked={newEventIsAllDay}
                  onChange={(e) => setNewEventIsAllDay(e.target.checked)}
                  className="rounded accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Category & Destination */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kategorie
                  </label>
                  <select
                    value={newEventCategory}
                    onChange={(e) => setNewEventCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:outline-none"
                  >
                    <option value="general">Allgemein</option>
                    <option value="customer">Kundentermin</option>
                    <option value="meeting">Meeting</option>
                    <option value="deadline">Frist / Deadline</option>
                    <option value="personal">Privat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Zielspeicher
                  </label>
                  <select
                    value={newEventTarget}
                    onChange={(e) => setNewEventTarget(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:outline-none"
                  >
                    {accessToken && <option value="google">Google Kalender (Live Sync)</option>}
                    <option value="local">Lokale SOCDOF Datenbank</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ort / Link (Optional)
                </label>
                <input
                  type="text"
                  placeholder="z.B. Besprechungsraum 1 oder Google Meet Link"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notizen & Beschreibung (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Zusätzliche Details, Agenda oder Teilnehmer..."
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Termin anlegen</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: EVENT INSPECTOR & MANAGEMENT */}
      {selectedEventForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-5 animate-fade-in">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${categoryColorMap[selectedEventForDetail.category || 'general']?.dot}`} />
                <span className="text-xs font-extrabold uppercase text-slate-400">
                  {selectedEventForDetail.source === 'invoice' ? 'Fakturierung' : selectedEventForDetail.source === 'google' ? 'Google Calendar' : 'Lokaler Termin'}
                </span>
              </div>
              <button 
                onClick={() => {
                  setSelectedEventForDetail(null);
                  setIsEditingEvent(false);
                  setConfirmDeleteId(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {isEditingEvent ? (
              <form onSubmit={handleUpdateEventSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Titel</label>
                  <input
                    type="text"
                    required
                    value={selectedEventForDetail.title}
                    onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Datum</label>
                  <input
                    type="date"
                    required
                    value={selectedEventForDetail.startDate}
                    onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ort</label>
                  <input
                    type="text"
                    value={selectedEventForDetail.location || ''}
                    onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, location: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Beschreibung</label>
                  <textarea
                    rows={2}
                    value={selectedEventForDetail.description || ''}
                    onChange={(e) => setSelectedEventForDetail({ ...selectedEventForDetail, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingEvent(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    Speichern
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedEventForDetail.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
                      <span>{selectedEventForDetail.startDate}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>{selectedEventForDetail.isAllDay ? 'Ganztägig' : `${selectedEventForDetail.startTime || '09:00'} Uhr`}</span>
                    </span>
                  </div>
                </div>

                {selectedEventForDetail.location && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                    <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 truncate">{selectedEventForDetail.location}</span>
                  </div>
                )}

                {selectedEventForDetail.description && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
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
                    className="w-full p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-100 transition"
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
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
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
                        className="px-3 py-1 rounded-lg border border-rose-200 text-rose-700 text-xs"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(selectedEventForDetail)}
                        className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
                      >
                        Ja, löschen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    {selectedEventForDetail.source !== 'invoice' ? (
                      <button
                        onClick={() => setConfirmDeleteId(selectedEventForDetail.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Löschen</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">Verwaltet über Rechnungen</span>
                    )}

                    {selectedEventForDetail.source !== 'invoice' && (
                      <button
                        onClick={() => setIsEditingEvent(true)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
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
    </div>
  );
};
