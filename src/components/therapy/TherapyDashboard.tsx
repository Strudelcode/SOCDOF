import React, { useMemo } from 'react';
import { 
  Users, 
  Clock3, 
  CalendarDays, 
  TrendingUp, 
  CreditCard, 
  Car, 
  ArrowUpRight, 
  Plus, 
  ChevronRight, 
  CheckCircle2, 
  Calendar,
  Sparkles,
  FileText,
  Building2,
  Edit2
} from 'lucide-react';
import { Client, Session, Appointment, Trip, BillingItem } from './types';
import { useLanguage, t } from '../../lib/i18n';
import { formatNumberDE, formatCurrencyDE, formatIntegerDE } from '../../lib/formatters';

interface TherapyDashboardProps {
  clients: Client[];
  sessions: Session[];
  appointments: Appointment[];
  trips: Trip[];
  billing: BillingItem[];
  currency: string;
  onNavigateTab: (tab: 'overview' | 'clients' | 'sessions' | 'appointments' | 'mileage' | 'billing') => void;
  onOpenCustomerPicker: () => void;
  onOpenNewSession: () => void;
  onOpenNewBilling: () => void;
  onOpenNewTrip: () => void;
  onSelectClient: (clientId: string) => void;
  onEditSession?: (session: Session) => void;
}

export const TherapyDashboard: React.FC<TherapyDashboardProps> = ({
  clients,
  sessions,
  appointments,
  trips,
  billing,
  currency,
  onNavigateTab,
  onOpenCustomerPicker,
  onOpenNewSession,
  onOpenNewBilling,
  onOpenNewTrip,
  onSelectClient,
  onEditSession
}) => {
  const lang = useLanguage();

  // Metrics calculation
  const totalBilled = useMemo(() => {
    return billing.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [billing]);

  const totalPaid = useMemo(() => {
    return billing
      .filter(b => b.status === 'paid')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [billing]);

  const totalPending = useMemo(() => {
    return billing
      .filter(b => b.status !== 'paid')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [billing]);

  const totalHours = useMemo(() => {
    const minutes = sessions.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
    return (minutes / 60).toFixed(1);
  }, [sessions]);

  const totalDistance = useMemo(() => {
    return trips.reduce((sum, t) => sum + Math.max(0, (Number(t.endKm) || 0) - (Number(t.startKm) || 0)), 0);
  }, [trips]);

  const upcomingAppointments = useMemo(() => {
    return [...appointments]
      .filter(a => a.status === 'scheduled')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 5);
  }, [appointments]);

  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 5);
  }, [sessions]);

  // Monthly revenue & session stats for the interactive chart (last 6 months)
  const chartData = useMemo(() => {
    const months: { label: string; monthKey: string; revenue: number; sessions: number }[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { month: 'short' });
      
      const monthRevenue = billing
        .filter(b => b.date && b.date.startsWith(monthKey))
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

      const monthSessions = sessions
        .filter(s => s.date && s.date.startsWith(monthKey))
        .length;

      months.push({ label, monthKey, revenue: monthRevenue, sessions: monthSessions });
    }
    return months;
  }, [billing, sessions, lang]);

  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 500);
  const maxSessions = Math.max(...chartData.map(d => d.sessions), 5);

  const getClientName = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    return c ? c.name : 'Unbekannter Klient';
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Banner */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, var(--accent, #4f46e5) 0%, var(--accent-hover, #4338ca) 100%)',
          boxShadow: '0 10px 25px -5px var(--accent-ring, rgba(79, 70, 229, 0.25)), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-white p-5 sm:p-6 rounded-2xl relative overflow-hidden"
      >
        {/* Subtle decorative glow watermark */}
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              {lang === 'de' ? 'Praxis-Übersicht & Statistik' : 'Practice Dashboard & Performance'}
            </h2>
            <p className="text-white/80 text-xs sm:text-sm mt-0.5 font-medium">
              {lang === 'de' 
                ? 'Verwaltung von Klienten, Behandlungsdokumentation, Abrechnung & Fahrten' 
                : 'Manage clients, session logs, invoicing and mileage logs'}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenCustomerPicker}
            style={{ color: 'var(--accent, #4f46e5)' }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 font-bold text-xs sm:text-sm rounded-xl transition shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>{lang === 'de' ? '+ Neuer Klient (Kundenbuch)' : '+ New Client (CRM)'}</span>
          </button>

          <button
            onClick={onOpenNewSession}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold text-xs sm:text-sm rounded-xl transition backdrop-blur-xs cursor-pointer"
          >
            <Clock3 className="w-4 h-4" />
            <span>{lang === 'de' ? '+ Sitzung' : '+ Session'}</span>
          </button>

          <button
            onClick={onOpenNewBilling}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold text-xs sm:text-sm rounded-xl transition backdrop-blur-xs cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>{lang === 'de' ? '+ Abrechnung' : '+ Invoice'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        <div 
          onClick={() => onNavigateTab('clients')}
          className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {lang === 'de' ? 'Aktive Klienten' : 'Active Clients'}
            </span>
            <div 
              style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' }}
              className="w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-105 transition shadow-2xs"
            >
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {clients.length}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
            <span>{lang === 'de' ? 'Aus CRM & Praxis' : 'From CRM & Practice'}</span>
          </p>
        </div>

        <div 
          onClick={() => onNavigateTab('sessions')}
          className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {lang === 'de' ? 'Therapiestunden' : 'Session Hours'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-105 transition shadow-2xs">
              <Clock3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {totalHours} <span className="text-sm font-normal text-slate-400">Std</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {sessions.length} {lang === 'de' ? 'dokumentierte Sitzungen' : 'logged sessions'}
          </p>
        </div>

        <div 
          onClick={() => onNavigateTab('billing')}
          className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {lang === 'de' ? 'Gesamthonorar' : 'Total Revenue'}
            </span>
            <div 
              style={{
                backgroundColor: 'var(--accent-companion-light, rgba(13, 148, 136, 0.18))',
                color: 'var(--accent-companion, #0d9488)'
              }}
              className="w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-105 transition shadow-2xs"
            >
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {formatCurrencyDE(totalBilled, currency)}
          </div>
          <p 
            style={{ color: 'var(--accent-companion, #0d9488)' }}
            className="text-[11px] mt-1 font-medium"
          >
            {formatCurrencyDE(totalPaid, currency)} {lang === 'de' ? 'bereits bezahlt' : 'paid'}
          </p>
        </div>

        <div 
          onClick={() => onNavigateTab('billing')}
          className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {lang === 'de' ? 'Offene Forderungen' : 'Pending Invoices'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition shadow-2xs">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {formatCurrencyDE(totalPending, currency)}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
            {billing.filter(b => b.status !== 'paid').length} {lang === 'de' ? 'Posten offen' : 'pending items'}
          </p>
        </div>
      </div>

      {/* Interactive Monthly Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* SVG Line Chart: Revenue Trend over months */}
        <div className="lg:col-span-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'de' ? 'Umsatz- & Sitzungsverlauf (Letzte 6 Monate)' : 'Revenue & Session Progression (Last 6 Months)'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {lang === 'de' ? 'Entwicklung der Honorare und durchgeführten Termine' : 'Financial trajectory and therapy volume'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--accent, #4f46e5)' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--accent, #4f46e5)' }}></span>
                {lang === 'de' ? `Umsatz (${currency})` : 'Revenue'}
              </span>
              <span className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--accent-companion, #0d9488)' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--accent-companion, #0d9488)' }}></span>
                {lang === 'de' ? 'Sitzungen' : 'Sessions'}
              </span>
            </div>
          </div>

          {/* SVG Line & Area Visualization */}
          <div className="h-52 w-full pt-2">
            <div className="relative h-44 w-full flex items-end justify-between gap-2 px-2 border-b border-slate-200 dark:border-slate-800">
              {chartData.map((d, idx) => {
                const revenueHeight = Math.max(8, Math.round((d.revenue / (maxRevenue || 1)) * 130));
                const sessionHeight = Math.max(8, Math.round((d.sessions / (maxSessions || 1)) * 130));

                return (
                  <div key={d.monthKey} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    {/* Tooltip on hover with European number format: 10.010,00 € or 1.000.000,00 € */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 text-[11px] rounded-lg px-2.5 py-1 shadow-lg whitespace-nowrap z-10 font-medium">
                      {d.label}: {formatCurrencyDE(d.revenue, currency)} ({formatIntegerDE(d.sessions)} {lang === 'de' ? (d.sessions === 1 ? 'Sitzung' : 'Sitzungen') : (d.sessions === 1 ? 'session' : 'sessions')})
                    </div>

                    <div className="flex items-end gap-1.5 w-full max-w-[48px] justify-center">
                      {/* Revenue Bar with dynamic user accent */}
                      <div 
                        style={{ 
                          height: `${revenueHeight}px`,
                          background: 'linear-gradient(to top, var(--accent, #4f46e5), var(--accent-border, #6366f1))'
                        }} 
                        className="w-4 rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-2xs"
                      />
                      {/* Session Bar with dynamic contrasting companion color */}
                      <div 
                        style={{ 
                          height: `${sessionHeight}px`,
                          background: 'linear-gradient(to top, var(--accent-companion, #0d9488), var(--accent-companion-border, #14b8a6))'
                        }} 
                        className="w-4 rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-2xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Month labels */}
            <div className="flex items-center justify-between px-2 pt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {chartData.map(d => (
                <span key={d.monthKey} className="flex-1 text-center">{d.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Practice Highlights & Distribution */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              {lang === 'de' ? 'Praxis-Kennzahlen' : 'Practice Metrics'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
              {lang === 'de' ? 'Übersicht Ihrer Praxisaktivitäten' : 'Overview of current operations'}
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div 
                    style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs"
                  >
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {lang === 'de' ? 'Fahrtenbuch Distanz' : 'Mileage Logged'}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      {formatIntegerDE(trips.length)} {lang === 'de' ? 'Fahrten erfasst' : 'trips'}
                    </div>
                  </div>
                </div>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {formatIntegerDE(totalDistance)} km
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-2xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {lang === 'de' ? 'Durchschnitt pro Sitzung' : 'Avg. per Session'}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      {sessions.length > 0 ? formatCurrencyDE(totalBilled / sessions.length, currency) : `0,00 ${currency}`}
                    </div>
                  </div>
                </div>
                <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                  {sessions.length > 0 ? formatCurrencyDE(totalBilled / sessions.length, currency) : `0,00 ${currency}`}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div 
                    style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs"
                  >
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {lang === 'de' ? 'Offene Termine' : 'Scheduled Appointments'}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      {upcomingAppointments.length} {lang === 'de' ? 'ausstehend' : 'pending'}
                    </div>
                  </div>
                </div>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {upcomingAppointments.length}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('billing')}
            className="w-full mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold text-slate-800 dark:text-slate-200 transition group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
              <span>{lang === 'de' ? 'Abrechnungsfenster öffnen' : 'Open Invoicing View'}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
          </button>
        </div>
      </div>

      {/* Lower Row: Upcoming Appointments & Recent Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Upcoming appointments */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: 'var(--accent, #4f46e5)' }} />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'de' ? 'Anstehende Termine' : 'Upcoming Appointments'}
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('appointments')}
              style={{ color: 'var(--accent, #4f46e5)' }}
              className="text-xs hover:underline font-bold"
            >
              {lang === 'de' ? 'Alle anzeigen' : 'View all'}
            </button>
          </div>

          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-9 px-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <Calendar className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {lang === 'de' ? 'Keine anstehenden Termine eingetragen.' : 'No upcoming appointments.'}
              </p>
              <button
                onClick={() => onNavigateTab('appointments')}
                style={{ color: 'var(--accent, #4f46e5)' }}
                className="text-xs font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{lang === 'de' ? '+ Termin anlegen' : '+ Schedule appointment'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAppointments.map(app => (
                <div 
                  key={app.id} 
                  onClick={() => onSelectClient(app.clientId)}
                  className="group flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800 transition cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                      {getClientName(app.clientId)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {app.date} {app.time ? `• ${app.time} Uhr` : ''} {app.notes ? `• ${app.notes}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' }}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md"
                    >
                      {lang === 'de' ? 'Geplant' : 'Scheduled'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateTab('appointments');
                      }}
                      className="p-1 rounded-md text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition"
                      title={lang === 'de' ? 'Termin anzeigen / bearbeiten' : 'View / edit appointment'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'de' ? 'Zuletzt dokumentierte Sitzungen' : 'Recent Session Logs'}
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('sessions')}
              style={{ color: 'var(--accent, #4f46e5)' }}
              className="text-xs hover:underline font-bold"
            >
              {lang === 'de' ? 'Alle anzeigen' : 'View all'}
            </button>
          </div>

          {recentSessions.length === 0 ? (
            <div className="text-center py-9 px-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <Clock3 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {lang === 'de' ? 'Noch keine Sitzungen dokumentiert.' : 'No session logs yet.'}
              </p>
              <button
                onClick={onOpenNewSession}
                style={{ color: 'var(--accent, #4f46e5)' }}
                className="text-xs font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{lang === 'de' ? '+ Sitzung erfassen' : '+ Record session'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map(sess => (
                <div 
                  key={sess.id} 
                  onClick={() => {
                    if (onEditSession) {
                      onEditSession(sess);
                    } else {
                      onSelectClient(sess.clientId);
                    }
                  }}
                  className="group flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100/90 dark:hover:bg-slate-800/90 border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer"
                  title={t('therapy.clickToEditSession', lang, 'Klicken zum Öffnen und Bearbeiten der Sitzung')}
                >
                  <div className="truncate max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClient(sess.clientId);
                        }}
                        className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate hover:text-teal-600 dark:hover:text-teal-400 transition"
                        title={lang === 'de' ? 'Zum Klientenprofil wechseln' : 'Go to client profile'}
                      >
                        {getClientName(sess.clientId)}
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-medium">
                        {sess.duration} Min
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1.5">
                      <span>{sess.date}</span>
                      {sess.startTime && <span>• {sess.startTime}</span>}
                      <span>• {sess.intervention || (lang === 'de' ? 'Sitzung' : 'Session')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sess.fee ? (
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {formatCurrencyDE(sess.fee, currency)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">{sess.duration}m</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditSession) {
                          onEditSession(sess);
                        } else {
                          onSelectClient(sess.clientId);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:bg-white dark:group-hover:bg-slate-700 transition shadow-2xs"
                      title={t('therapy.editSession', lang, 'Sitzung bearbeiten')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
