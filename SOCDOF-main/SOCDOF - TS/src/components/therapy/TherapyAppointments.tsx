import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Search, 
  Plus, 
  Clock, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Users
} from 'lucide-react';
import { Appointment, Client } from './types';
import { useLanguage } from '../../lib/i18n';

interface TherapyAppointmentsProps {
  appointments: Appointment[];
  clients: Client[];
  onSaveAppointment: (appointment: Appointment) => void;
  onDeleteAppointment: (id: string) => void;
  onSelectClient: (clientId: string) => void;
  onShowToast: (msg: string) => void;
}

export const TherapyAppointments: React.FC<TherapyAppointmentsProps> = ({
  appointments,
  clients,
  onSaveAppointment,
  onDeleteAppointment,
  onSelectClient,
  onShowToast
}) => {
  const lang = useLanguage();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const client = clients.find(c => c.id === a.clientId);
      const clientName = client ? client.name.toLowerCase() : '';
      const q = search.toLowerCase().trim();

      const matchesSearch = !q ||
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        clientName.includes(q);

      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [appointments, clients, search, statusFilter]);

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  return (
    <div className="space-y-5">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'de' ? 'Termine & Klienten suchen...' : 'Search appointments...'}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">{lang === 'de' ? 'Alle Status' : 'All Status'}</option>
            <option value="scheduled">{lang === 'de' ? 'Geplant' : 'Scheduled'}</option>
            <option value="attended">{lang === 'de' ? 'Wahrgenommen' : 'Attended'}</option>
            <option value="cancelled">{lang === 'de' ? 'Abgesagt' : 'Cancelled'}</option>
            <option value="missed">{lang === 'de' ? 'Versäumt' : 'Missed'}</option>
          </select>
        </div>

        <button
          onClick={() => {
            const defaultClient = clients[0];
            setEditingAppointment({
              id: `appt_${Date.now()}`,
              clientId: defaultClient?.id || '',
              date: new Date().toISOString().slice(0, 10),
              time: '14:00',
              status: 'scheduled',
              notes: ''
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'de' ? '+ Neuer Termin' : '+ New Appointment'}</span>
        </button>
      </div>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {lang === 'de' ? 'Keine Termine eingetragen' : 'No appointments found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {lang === 'de' ? 'Planen Sie Praxis-Termine mit Ihren Klienten.' : 'Schedule therapy appointments with clients.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredAppointments.map(appt => {
            const client = getClient(appt.clientId);

            return (
              <div
                key={appt.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition shadow-sm flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div 
                    onClick={() => onSelectClient(appt.clientId)}
                    className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-indigo-600 cursor-pointer transition"
                  >
                    {client ? client.name : 'Unbekannter Klient'}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{appt.date}</span>
                    {appt.time && <span>• {appt.time} Uhr</span>}
                  </div>

                  {appt.notes && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {appt.notes}
                    </div>
                  )}

                  <div className="pt-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                      appt.status === 'attended' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                      appt.status === 'cancelled' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' :
                      appt.status === 'missed' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    }`}>
                      {appt.status === 'attended' ? (lang === 'de' ? 'Wahrgenommen' : 'Attended') :
                       appt.status === 'cancelled' ? (lang === 'de' ? 'Abgesagt' : 'Cancelled') :
                       appt.status === 'missed' ? (lang === 'de' ? 'Versäumt' : 'Missed') :
                       (lang === 'de' ? 'Geplant' : 'Scheduled')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingAppointment(appt);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(lang === 'de' ? 'Termin löschen?' : 'Delete appointment?')) {
                        onDeleteAppointment(appt.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && editingAppointment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span>{lang === 'de' ? 'Termin planen / anpassen' : 'Schedule Appointment'}</span>
            </h3>

            <form onSubmit={e => {
              e.preventDefault();
              onSaveAppointment(editingAppointment);
              setIsModalOpen(false);
              setEditingAppointment(null);
              onShowToast(lang === 'de' ? 'Termin gespeichert' : 'Appointment saved');
            }} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Klient' : 'Client'} *
                </label>
                <select
                  value={editingAppointment.clientId}
                  onChange={e => setEditingAppointment({ ...editingAppointment, clientId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Datum' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    value={editingAppointment.date}
                    onChange={e => setEditingAppointment({ ...editingAppointment, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Uhrzeit' : 'Time'}
                  </label>
                  <input
                    type="time"
                    value={editingAppointment.time || ''}
                    onChange={e => setEditingAppointment({ ...editingAppointment, time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Status' : 'Status'}
                </label>
                <select
                  value={editingAppointment.status}
                  onChange={e => setEditingAppointment({ ...editingAppointment, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="scheduled">{lang === 'de' ? 'Geplant' : 'Scheduled'}</option>
                  <option value="attended">{lang === 'de' ? 'Wahrgenommen' : 'Attended'}</option>
                  <option value="cancelled">{lang === 'de' ? 'Abgesagt' : 'Cancelled'}</option>
                  <option value="missed">{lang === 'de' ? 'Versäumt' : 'Missed'}</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Notizen / Raum' : 'Notes / Room'}
                </label>
                <textarea
                  rows={2}
                  value={editingAppointment.notes || ''}
                  onChange={e => setEditingAppointment({ ...editingAppointment, notes: e.target.value })}
                  placeholder={lang === 'de' ? 'z.B. Praxisraum 1, Vorbesprechung...' : 'e.g. Room 1, initial session...'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingAppointment(null);
                  }}
                  className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm"
                >
                  {lang === 'de' ? 'Termin speichern' : 'Save Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
