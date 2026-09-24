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
  FileText
} from 'lucide-react';
import { Client, Session, Appointment, Trip, BillingItem } from './types';
import { useLanguage, t } from '../../lib/i18n';

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
  onSelectClient
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
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 text-white p-5 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {lang === 'de' ? 'Praxis-Übersicht & Statistik' : 'Practice Dashboard & Performance'}
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
            {lang === 'de' 
              ? 'Verwaltung von Klienten, Behandlungsdokumentation, Abrechnung & Fahrten' 
              : 'Manage clients, session logs, invoicing and mileage logs'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenCustomerPicker}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-xs sm:text-sm rounded-xl transition shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>{lang === 'de' ? '+ Neuer Klient (Kundenbuch)' : '+ New Client (CRM)'}</span>
          </button>

          <button
            onClick={onOpenNewSession}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-700/60 hover:bg-blue-700 border border-white/20 text-white font-medium text-xs sm:text-sm rounded-xl transition"
          >
            <Clock3 className="w-4 h-4" />
            <span>{lang === 'de' ? '+ Sitzung' : '+ Session'}</span>
          </button>

          <button
            onClick={onOpenNewBilling}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-700/60 hover:bg-blue-700 border border-white/20 text-white font-medium text-xs sm:text-sm rounded-xl transition"
          >
            <CreditCard className="w-4 h-4" />
            <span>{lang === 'de' ? '+ Abrechnung' : '+ Invoice'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div 
          onClick={() => onNavigateTab('clients')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {lang === 'de' ? 'Aktive Klienten' : 'Active Clients'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {clients.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>{lang === 'de' ? 'Aus CRM & Praxis' : 'From CRM & Practice'}</span>
          </p>
        </div>

        <div 
          onClick={() => onNavigateTab('sessions')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700 transition cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {lang === 'de' ? 'Therapiestunden' : 'Session Hours'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-105 transition">
              <Clock3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalHours} <span className="text-sm font-normal text-slate-400">Std</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {sessions.length} {lang === 'de' ? 'dokumentierte Sitzungen' : 'logged sessions'}
          </p>
        </div>

        <div 
          onClick={() => onNavigateTab('billing')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {lang === 'de' ? 'Gesamthonorar' : 'Total Revenue'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalBilled.toFixed(2)} {currency}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            {totalPaid.toFixed(2)} {currency} {lang === 'de' ? 'bereits bezahlt' : 'paid'}
          </p>
        </div>

        <div 
          onClick={() => onNavigateTab('billing')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 transition cursor-pointer shadow-sm group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {lang === 'de' ? 'Offene Forderungen' : 'Pending Invoices'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalPending.toFixed(2)} {currency}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
            {billing.filter(b => b.status !== 'paid').length} {lang === 'de' ? 'Posten offen' : 'pending items'}
          </p>
        </div>
      </div>

      {/* Interactive Monthly Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* SVG Line Chart: Revenue Trend over months */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {lang === 'de' ? 'Umsatz- & Sitzungsverlauf (Letzte 6 Monate)' : 'Revenue & Session Progression (Last 6 Months)'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'de' ? 'Entwicklung der Honorare und durchgeführten Termine' : 'Financial trajectory and therapy volume'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                {lang === 'de' ? 'Umsatz (€)' : 'Revenue'}
              </span>
              <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
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
                    {/* Tooltip on hover */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-slate-900 text-white text-[11px] rounded-lg px-2 py-1 shadow-lg whitespace-nowrap z-10">
                      {d.label}: {d.revenue.toFixed(0)} {currency} ({d.sessions} {lang === 'de' ? 'Sitzungen' : 'sessions'})
                    </div>

                    <div className="flex items-end gap-1.5 w-full max-w-[48px] justify-center">
                      {/* Revenue Bar */}
                      <div 
                        style={{ height: `${revenueHeight}px` }} 
                        className="w-4 bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                      />
                      {/* Session Bar */}
                      <div 
                        style={{ height: `${sessionHeight}px` }} 
                        className="w-4 bg-gradient-to-t from-teal-500 to-emerald-400 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Month labels */}
            <div className="flex items-center justify-between px-2 pt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {chartData.map(d => (
                <span key={d.monthKey} className="flex-1 text-center">{d.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Practice Highlights & Distribution */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              {lang === 'de' ? 'Praxis-Kennzahlen' : 'Practice Metrics'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {lang === 'de' ? 'Übersicht Ihrer Praxisaktivitäten' : 'Overview of current operations'}
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                    <Car className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {lang === 'de' ? 'Fahrtenbuch Distanz' : 'Mileage Logged'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {trips.length} {lang === 'de' ? 'Fahrten erfasst' : 'trips'}
                    </div>
                  </div>
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {totalDistance.toFixed(0)} km
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {lang === 'de' ? 'Durchschnitt pro Sitzung' : 'Avg. per Session'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {sessions.length > 0 ? (totalBilled / sessions.length).toFixed(2) : '0.00'} {currency}
                    </div>
                  </div>
                </div>
                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {sessions.length > 0 ? (totalBilled / sessions.length).toFixed(0) : '0'} {currency}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center">
                    <CalendarDays className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {lang === 'de' ? 'Offene Termine' : 'Scheduled Appointments'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {upcomingAppointments.length} {lang === 'de' ? 'ausstehend' : 'pending'}
                    </div>
                  </div>
                </div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {upcomingAppointments.length}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('billing')}
            className="w-full mt-4 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs rounded-xl transition"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{lang === 'de' ? 'Abrechnungsfenster öffnen' : 'Open Invoicing View'}</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto" />
          </button>
        </div>
      </div>

      {/* Lower Row: Upcoming Appointments & Recent Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Upcoming appointments */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {lang === 'de' ? 'Anstehende Termine' : 'Upcoming Appointments'}
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('appointments')}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              {lang === 'de' ? 'Alle anzeigen' : 'View all'}
            </button>
          </div>

          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              {lang === 'de' ? 'Keine anstehenden Termine eingetragen.' : 'No upcoming appointments.'}
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAppointments.map(app => (
                <div 
                  key={app.id} 
                  onClick={() => onSelectClient(app.clientId)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 border border-slate-100 dark:border-slate-800 transition cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                      {getClientName(app.clientId)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {app.date} {app.time ? `• ${app.time} Uhr` : ''} {app.notes ? `• ${app.notes}` : ''}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    {lang === 'de' ? 'Geplant' : 'Scheduled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {lang === 'de' ? 'Zuletzt dokumentierte Sitzungen' : 'Recent Session Logs'}
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('sessions')}
              className="text-xs text-teal-600 hover:underline font-medium"
            >
              {lang === 'de' ? 'Alle anzeigen' : 'View all'}
            </button>
          </div>

          {recentSessions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              {lang === 'de' ? 'Noch keine Sitzungen dokumentiert.' : 'No session logs yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map(sess => (
                <div 
                  key={sess.id} 
                  onClick={() => onSelectClient(sess.clientId)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 border border-slate-100 dark:border-slate-800 transition cursor-pointer"
                >
                  <div className="truncate max-w-[75%]">
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                      {getClientName(sess.clientId)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {sess.date} • {sess.duration} Min • {sess.intervention || 'Beratung'}
                    </div>
                  </div>
                  {sess.fee ? (
                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                      {sess.fee.toFixed(2)} {currency}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">{sess.duration}m</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
