import React, { useState, useMemo } from 'react';
import { 
  Clock3, 
  Search, 
  Plus, 
  Calendar, 
  Trash2, 
  Edit2, 
  CreditCard, 
  User, 
  CheckCircle2,
  FileText,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Session, Client, BillingItem } from './types';
import { useLanguage } from '../../lib/i18n';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TherapySessionsProps {
  sessions: Session[];
  clients: Client[];
  currency: string;
  onSaveSession: (session: Session, autoBilling?: boolean) => void;
  onDeleteSession: (id: string) => void;
  onSelectClient: (clientId: string) => void;
  onShowToast: (msg: string) => void;
}

export const TherapySessions: React.FC<TherapySessionsProps> = ({
  sessions,
  clients,
  currency,
  onSaveSession,
  onDeleteSession,
  onSelectClient,
  onShowToast
}) => {
  const lang = useLanguage();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [autoCreateBilling, setAutoCreateBilling] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const client = clients.find(c => c.id === s.clientId);
      const clientName = client ? client.name.toLowerCase() : '';
      const q = search.toLowerCase().trim();

      const matchesSearch = !q ||
        (s.intervention && s.intervention.toLowerCase().includes(q)) ||
        (s.progress && s.progress.toLowerCase().includes(q)) ||
        clientName.includes(q);

      const matchesClient = clientFilter === 'all' || s.clientId === clientFilter;

      return matchesSearch && matchesClient;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [sessions, clients, search, clientFilter]);

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  return (
    <div className="space-y-5">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'de' ? 'Sitzungen, Thema, Klient durchsuchen...' : 'Search sessions...'}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">{lang === 'de' ? 'Alle Klienten' : 'All Clients'}</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Add Session button */}
        <button
          onClick={() => {
            const defaultClient = clients[0];
            setEditingSession({
              id: `sess_${Date.now()}`,
              clientId: defaultClient?.id || '',
              date: new Date().toISOString().slice(0, 10),
              startTime: '10:00',
              endTime: '11:00',
              duration: 60,
              intervention: '',
              progress: '',
              fee: defaultClient?.hourlyRate || 90
            });
            setAutoCreateBilling(true);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'de' ? '+ Neue Sitzung dokumentieren' : '+ Document Session'}</span>
        </button>
      </div>

      {/* Sessions Grid / List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center">
            <Clock3 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {lang === 'de' ? 'Keine Sitzungsdokumentationen vorhanden' : 'No session logs found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {lang === 'de' 
              ? 'Dokumentieren Sie therapeutische Interventionen, Verlauf und Vereinbarungen.' 
              : 'Log therapy interventions, progress notes and next clinical steps.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map(session => {
            const client = getClient(session.clientId);

            return (
              <div
                key={session.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 transition shadow-sm space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-3">
                    <div 
                      onClick={() => onSelectClient(session.clientId)}
                      className="cursor-pointer group flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center">
                        {client ? client.name.substring(0, 2).toUpperCase() : 'KL'}
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-teal-600 transition">
                          {client ? client.name : 'Unbekannter Klient'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {session.date} {session.startTime ? `• ${session.startTime} Uhr` : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                      {session.duration} Min {session.fee ? `• ${session.fee.toFixed(2)} ${currency}` : ''}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingSession(session);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title={lang === 'de' ? 'Bearbeiten' : 'Edit'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSessionToDelete(session)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                        title={lang === 'de' ? 'Löschen' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {session.intervention && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {lang === 'de' ? 'Thema / Intervention' : 'Topic / Intervention'}
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 mt-0.5 font-medium">
                      {session.intervention}
                    </div>
                  </div>
                )}

                {session.progress && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {lang === 'de' ? 'Verlauf & Notizen' : 'Progress & Notes'}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                      {session.progress}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New / Edit Session Modal */}
      {isModalOpen && editingSession && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 my-8">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock3 className="w-5 h-5 text-teal-600" />
              <span>{lang === 'de' ? 'Sitzung dokumentieren' : 'Document Session'}</span>
            </h3>

            <form onSubmit={e => {
              e.preventDefault();
              onSaveSession(editingSession, autoCreateBilling);
              setIsModalOpen(false);
              setEditingSession(null);
              onShowToast(lang === 'de' ? 'Sitzung gespeichert' : 'Session saved');
            }} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Klient' : 'Client'} *
                </label>
                <select
                  value={editingSession.clientId}
                  onChange={e => {
                    const selectedC = clients.find(c => c.id === e.target.value);
                    setEditingSession({
                      ...editingSession,
                      clientId: e.target.value,
                      fee: selectedC?.hourlyRate || editingSession.fee
                    });
                  }}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Datum' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    value={editingSession.date}
                    onChange={e => setEditingSession({ ...editingSession, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Uhrzeit von' : 'Time from'}
                  </label>
                  <input
                    type="time"
                    value={editingSession.startTime || ''}
                    onChange={e => setEditingSession({ ...editingSession, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Dauer (Min)' : 'Duration (min)'}
                  </label>
                  <input
                    type="number"
                    value={editingSession.duration}
                    onChange={e => setEditingSession({ ...editingSession, duration: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              {/* Duration Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">{lang === 'de' ? 'Schnellauswahl:' : 'Quick set:'}</span>
                {[30, 50, 60, 90].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setEditingSession({ ...editingSession, duration: mins })}
                    className={`px-2 py-0.5 text-[11px] rounded-md font-medium transition ${
                      editingSession.duration === mins
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Thema & Methoden / Intervention' : 'Topic & Intervention'}
                </label>
                <input
                  type="text"
                  value={editingSession.intervention}
                  onChange={e => setEditingSession({ ...editingSession, intervention: e.target.value })}
                  placeholder="z.B. Kognitive Umstrukturierung, Klärungsgespräch..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Verlauf, Klientenreaktion & Nächste Schritte' : 'Progress & Clinical Notes'}
                </label>
                <textarea
                  rows={4}
                  value={editingSession.progress}
                  onChange={e => setEditingSession({ ...editingSession, progress: e.target.value })}
                  placeholder={lang === 'de' ? 'Dokumentieren Sie den Verlauf...' : 'Document progress...'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Honorar (€)' : 'Fee'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingSession.fee || ''}
                    onChange={e => setEditingSession({ ...editingSession, fee: Number(e.target.value) || 0 })}
                    placeholder="90.00"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={autoCreateBilling}
                      onChange={e => setAutoCreateBilling(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                    />
                    <span>{lang === 'de' ? 'Abrechnungsposten erzeugen' : 'Auto-create invoice draft'}</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingSession(null);
                  }}
                  className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition shadow-sm"
                >
                  {lang === 'de' ? 'Sitzung speichern' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(sessionToDelete)}
        title={lang === 'de' ? 'Sitzungseintrag löschen?' : 'Delete Session?'}
        itemName={sessionToDelete ? `${sessionToDelete.date} • ${sessionToDelete.intervention || 'Sitzung'}` : ''}
        description={lang === 'de' ? 'Möchten Sie dieses Sitzungsprotokoll wirklich unwiderruflich löschen?' : 'Are you sure you want to permanently delete this clinical session note?'}
        onConfirm={() => {
          if (sessionToDelete) {
            onDeleteSession(sessionToDelete.id);
            setSessionToDelete(null);
          }
        }}
        onClose={() => setSessionToDelete(null)}
      />
    </div>
  );
};
