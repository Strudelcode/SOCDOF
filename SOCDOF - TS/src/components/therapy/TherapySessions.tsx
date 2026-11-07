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
  ChevronRight,
  Users,
  ChevronDown,
  X
} from 'lucide-react';
import { Session, Client, BillingItem } from './types';
import { useLanguage, t } from '../../lib/i18n';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { TherapySessionModal } from './TherapySessionModal';
import { TherapyClientFilterModal } from './TherapyClientFilterModal';

interface TherapySessionsProps {
  sessions: Session[];
  clients: Client[];
  currency: string;
  onSaveSession: (session: Session, autoBilling?: boolean) => void;
  onDeleteSession: (id: string) => void;
  onSelectClient: (clientId: string) => void;
  onShowToast: (msg: string) => void;
  onEditSession?: (session: Session) => void;
  onOpenNewSession?: () => void;
}

export const TherapySessions: React.FC<TherapySessionsProps> = ({
  sessions,
  clients,
  currency,
  onSaveSession,
  onDeleteSession,
  onSelectClient,
  onShowToast,
  onEditSession,
  onOpenNewSession
}) => {
  const lang = useLanguage();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [isClientFilterModalOpen, setIsClientFilterModalOpen] = useState(false);

  const activeClient = useMemo(() => clients.find(c => c.id === clientFilter), [clients, clientFilter]);
  
  // Fallback modal states if onEditSession / onOpenNewSession not provided
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
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
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent,#4f46e5)] focus:border-transparent"
            />
          </div>

          {/* Client Filter Popout Trigger */}
          {clientFilter === 'all' ? (
            <button
              type="button"
              onClick={() => setIsClientFilterModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title={lang === 'de' ? 'Klienten suchen & filtern' : 'Search & filter clients'}
            >
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{lang === 'de' ? 'Alle Klienten' : 'All Clients'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 font-bold text-slate-600 dark:text-slate-300">
                {clients.length}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <button
                type="button"
                onClick={() => setIsClientFilterModalOpen(true)}
                className="hover:underline cursor-pointer max-w-[130px] sm:max-w-[170px] truncate font-bold text-left"
                title={activeClient?.name}
              >
                {activeClient?.name || (lang === 'de' ? 'Klient' : 'Client')}
              </button>
              <button
                type="button"
                onClick={() => setClientFilter('all')}
                className="p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-900 rounded-md text-blue-500 hover:text-rose-600 transition cursor-pointer ml-0.5"
                title={lang === 'de' ? 'Filter aufheben' : 'Clear filter'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Add Session button */}
        <button
          onClick={() => {
            if (onOpenNewSession) {
              onOpenNewSession();
            } else {
              const defaultClient = clients[0];
              setEditingSession({
                id: `sess_new_${Date.now()}`,
                clientId: defaultClient?.id || '',
                date: new Date().toISOString().slice(0, 10),
                startTime: '10:00',
                endTime: '11:00',
                duration: 60,
                intervention: '',
                progress: '',
                fee: defaultClient?.hourlyRate || 90
              });
              setIsModalOpen(true);
            }
          }}
          style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
          className="flex items-center gap-1.5 px-4 py-2 hover:brightness-110 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'de' ? '+ Neue Sitzung dokumentieren' : '+ Document Session'}</span>
        </button>
      </div>

      {/* Sessions Grid / List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <div 
            style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' }}
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center shadow-2xs"
          >
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
                onClick={() => {
                  if (onEditSession) {
                    onEditSession(session);
                  } else {
                    setEditingSession(session);
                    setIsModalOpen(true);
                  }
                }}
                className="group bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition space-y-2.5 cursor-pointer relative"
                title={t('therapy.clickToEditSession', lang, 'Klicken zum Öffnen und Bearbeiten der Sitzung')}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-3">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClient(session.clientId);
                      }}
                      className="cursor-pointer group/client flex items-center gap-2"
                      title={lang === 'de' ? 'Zum Klientenprofil wechseln' : 'Go to client profile'}
                    >
                      <div 
                        style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' }}
                        className="w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shadow-2xs"
                      >
                        {client ? client.name.substring(0, 2).toUpperCase() : 'KL'}
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover/client:opacity-80 transition">
                          {client ? client.name : 'Unbekannter Klient'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {session.date} {session.startTime ? `• ${session.startTime} Uhr` : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditSession) {
                          onEditSession(session);
                        } else {
                          setEditingSession(session);
                          setIsModalOpen(true);
                        }
                      }}
                      style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:brightness-105 transition cursor-pointer inline-flex items-center gap-1.5"
                      title={t('therapy.editFee', lang, 'Honorar / Stundensatz bearbeiten')}
                    >
                      <span>{session.duration} Min</span>
                      <span>•</span>
                      <span className="font-bold">{session.fee ? `${session.fee.toFixed(2)} ${currency}` : (lang === 'de' ? 'Honorar erfassen' : 'Set fee')}</span>
                      <Edit2 className="w-3 h-3" style={{ color: 'var(--accent, #4f46e5)' }} />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditSession) {
                            onEditSession(session);
                          } else {
                            setEditingSession(session);
                            setIsModalOpen(true);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title={t('therapy.editSession', lang, 'Sitzung bearbeiten')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(session);
                        }}
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

      {/* Fallback New / Edit Session Modal */}
      {isModalOpen && editingSession && (
        <TherapySessionModal
          isOpen={isModalOpen}
          session={editingSession}
          clients={clients}
          currency={currency}
          onSave={(savedSession, autoBilling) => {
            onSaveSession(savedSession, autoBilling);
            setIsModalOpen(false);
            setEditingSession(null);
            onShowToast(lang === 'de' ? 'Sitzung gespeichert' : 'Session saved');
          }}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSession(null);
          }}
          onDelete={(id) => {
            onDeleteSession(id);
            setIsModalOpen(false);
            setEditingSession(null);
          }}
          onSelectClient={onSelectClient}
        />
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

      {/* Client Filter Modal Popout */}
      <TherapyClientFilterModal
        isOpen={isClientFilterModalOpen}
        onClose={() => setIsClientFilterModalOpen(false)}
        clients={clients}
        selectedClientId={clientFilter}
        onSelectClient={setClientFilter}
      />
    </div>
  );
};
