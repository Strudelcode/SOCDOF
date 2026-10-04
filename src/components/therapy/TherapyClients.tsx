import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  BookUser, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Calendar, 
  FileText, 
  Clock3, 
  CreditCard, 
  Car, 
  Plus, 
  ChevronRight, 
  ArrowLeft, 
  Edit2, 
  Trash2, 
  Link2, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { Client, Session, Appointment, Trip, BillingItem } from './types';
import { Contact } from '../../types';
import { useLanguage, t, LanguageCode } from '../../lib/i18n';
import { db } from '../../lib/db';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TherapyClientsProps {
  clients: Client[];
  sessions: Session[];
  appointments: Appointment[];
  trips: Trip[];
  billing: BillingItem[];
  currency: string;
  activeClientId: string | null;
  onSelectClient: (clientId: string | null) => void;
  onOpenCustomerPicker: () => void;
  onSaveClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onOpenNewSessionForClient: (clientId: string) => void;
  onOpenNewBillingForClient: (clientId: string) => void;
  onOpenNewAppointmentForClient: (clientId: string) => void;
  onOpenNewTripForClient: (clientId: string) => void;
  onEditContactInCRM?: (contactId: number | string) => void;
  onQuickSessionSave?: (session: Session) => void;
  onEditSession?: (session: Session) => void;
  onDeleteSession?: (sessionId: string) => void;
  onSaveBilling?: (item: BillingItem) => void;
  onDeleteBilling?: (id: string) => void;
}

export const TherapyClients: React.FC<TherapyClientsProps> = ({
  clients,
  sessions,
  appointments,
  trips,
  billing,
  currency,
  activeClientId,
  onSelectClient,
  onOpenCustomerPicker,
  onSaveClient,
  onDeleteClient,
  onOpenNewSessionForClient,
  onOpenNewBillingForClient,
  onOpenNewAppointmentForClient,
  onOpenNewTripForClient,
  onEditContactInCRM,
  onQuickSessionSave,
  onEditSession,
  onDeleteSession,
  onSaveBilling,
  onDeleteBilling
}) => {
  const lang = useLanguage();
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [syncToCRM, setSyncToCRM] = useState(true);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // Inline quick-editing states for Stundensatz (hourly rate), Abrechnungsart & Diagnosis
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [editingRateValue, setEditingRateValue] = useState('');
  const [isEditingInsurance, setIsEditingInsurance] = useState(false);
  const [isEditingDiagnosis, setIsEditingDiagnosis] = useState(false);
  const [diagnosisValue, setDiagnosisValue] = useState('');

  // Billing item edit modal & delete state
  const [editingBillingItem, setEditingBillingItem] = useState<BillingItem | null>(null);
  const [billingItemToDelete, setBillingItemToDelete] = useState<BillingItem | null>(null);

  // Mobile compact mode detection (Phase 12) — mirrors container width of the window frame
  const rootRef = useRef<HTMLDivElement>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const frame = rootRef.current;
      const w = frame ? frame.clientWidth : 0;
      setIsMobileLayout(w > 0 && w < 640);
    };
    checkMobile();
    // Re-check after first paint & dossier mount (ref may be null on first pass)
    const raf = requestAnimationFrame(checkMobile);
    const t = setTimeout(checkMobile, 120);
    window.addEventListener('resize', checkMobile);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener('resize', checkMobile);
    };
  }, [activeClientId]);

  // Mobile consultation live timer (Phase 12): per-client, crash-safe via localStorage
  const [consultationTimer, setConsultationTimer] = useState<{ clientId: string; startedAt: number } | null>(() => {
    try {
      const raw = localStorage.getItem('socdof_therapy_consultation_timer_v1');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [consultationSeconds, setConsultationSeconds] = useState(0);

  useEffect(() => {
    if (!consultationTimer) { setConsultationSeconds(0); return; }
    const tick = () => setConsultationSeconds(Math.max(0, Math.floor((Date.now() - consultationTimer.startedAt) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [consultationTimer]);

  const startConsultationTimer = () => {
    if (!activeClient) return;
    const next = { clientId: activeClient.id, startedAt: Date.now() };
    setConsultationTimer(next);
    localStorage.setItem('socdof_therapy_consultation_timer_v1', JSON.stringify(next));
  };

  const stopConsultationTimer = () => {
    if (!consultationTimer || !activeClient) return { seconds: 0 };
    const seconds = Math.max(0, Math.floor((Date.now() - consultationTimer.startedAt) / 1000));
    setConsultationTimer(null);
    localStorage.removeItem('socdof_therapy_consultation_timer_v1');
    return { seconds };
  };

  const formatTimer = (total: number) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  };

  // Mobile quick session note sheet state (Phase 12)
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [quickNoteIntervention, setQuickNoteIntervention] = useState('');
  const [isSubmittingQuickNote, setIsSubmittingQuickNote] = useState(false);

  const handleSaveQuickSessionNote = async () => {
    if (!activeClient || !quickNoteText.trim()) return;
    setIsSubmittingQuickNote(true);
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const durationMinutes = consultationTimer && consultationTimer.clientId === activeClient.id
        ? Math.max(1, Math.round((Date.now() - consultationTimer.startedAt) / 60000))
        : 50;

      const session: Session = {
        id: `session_${Date.now()}`,
        clientId: activeClient.id,
        date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        startTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        duration: durationMinutes,
        intervention: quickNoteIntervention.trim() || (lang === 'de' ? 'Sitzung' : 'Session'),
        progress: quickNoteText.trim(),
        fee: activeClient.hourlyRate || undefined
      };

      onQuickSessionSave?.(session);

      setIsQuickNoteOpen(false);
      setQuickNoteText('');
      setQuickNoteIntervention('');
      if (consultationTimer && consultationTimer.clientId === activeClient.id) {
        setConsultationTimer(null);
        localStorage.removeItem('socdof_therapy_consultation_timer_v1');
      }
    } finally {
      setIsSubmittingQuickNote(false);
    }
  };

  // Filtered clients list
  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.diagnosis && c.diagnosis.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  }, [clients, search]);

  const activeClient = useMemo(() => {
    return clients.find(c => c.id === activeClientId) || null;
  }, [clients, activeClientId]);

  // Linked items for active client dossier
  const clientSessions = useMemo(() => {
    if (!activeClientId) return [];
    return sessions.filter(s => s.clientId === activeClientId).sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, activeClientId]);

  const clientBilling = useMemo(() => {
    if (!activeClientId) return [];
    return billing.filter(b => b.clientId === activeClientId).sort((a, b) => b.date.localeCompare(a.date));
  }, [billing, activeClientId]);

  const clientAppointments = useMemo(() => {
    if (!activeClientId) return [];
    return appointments.filter(a => a.clientId === activeClientId).sort((a, b) => a.date.localeCompare(b.date));
  }, [appointments, activeClientId]);

  const clientTrips = useMemo(() => {
    if (!activeClientId) return [];
    return trips.filter(t => t.clientId === activeClientId).sort((a, b) => b.date.localeCompare(a.date));
  }, [trips, activeClientId]);

  // Reusable Edit Client Modal (used in both Dossier and Overview Grid)
  const renderEditClientModal = () => {
    if (!editingClient) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {lang === 'de' ? 'Klient bearbeiten' : 'Edit Client'}
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'de' ? 'Name' : 'Name'} *
              </label>
              <input
                type="text"
                value={editingClient.name}
                onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            {/* Hourly Rate & Insurance Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? `Stundensatz (${currency}/Std)` : `Hourly Rate (${currency}/h)`}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingClient.hourlyRate !== undefined ? editingClient.hourlyRate : ''}
                  onChange={e => setEditingClient({
                    ...editingClient,
                    hourlyRate: e.target.value === '' ? undefined : Number(e.target.value)
                  })}
                  placeholder="90.00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Abrechnungsart' : 'Billing Type'}
                </label>
                <select
                  value={editingClient.insuranceType || 'self'}
                  onChange={e => setEditingClient({
                    ...editingClient,
                    insuranceType: e.target.value
                  })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="self">{lang === 'de' ? 'Selbstzahler' : 'Self-payer'}</option>
                  <option value="private">{lang === 'de' ? 'Privatversicherung' : 'Private insurance'}</option>
                  <option value="statutory">{lang === 'de' ? 'Gesetzlich / Kostenerstattung' : 'Statutory / Reimbursement'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Telefon' : 'Phone'}
                </label>
                <input
                  type="text"
                  value={editingClient.phone || ''}
                  onChange={e => setEditingClient({ ...editingClient, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'E-Mail' : 'Email'}
                </label>
                <input
                  type="email"
                  value={editingClient.email || ''}
                  onChange={e => setEditingClient({ ...editingClient, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            {/* Address & City */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Straße & Hausnr.' : 'Street Address'}
                </label>
                <input
                  type="text"
                  value={editingClient.address || ''}
                  onChange={e => setEditingClient({ ...editingClient, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'PLZ & Ort' : 'ZIP & City'}
                </label>
                <input
                  type="text"
                  value={`${editingClient.zip || ''} ${editingClient.city || ''}`.trim()}
                  onChange={e => {
                    const parts = e.target.value.split(' ');
                    const zip = parts[0] || '';
                    const city = parts.slice(1).join(' ');
                    setEditingClient({ ...editingClient, zip, city });
                  }}
                  placeholder="10115 Berlin"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Diagnose / Schwerpunkt' : 'Diagnosis / Focus'}
                </label>
                <input
                  type="text"
                  value={editingClient.diagnosis || ''}
                  onChange={e => setEditingClient({ ...editingClient, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Geburtsdatum' : 'Date of Birth'}
                </label>
                <input
                  type="date"
                  value={editingClient.birthDate || ''}
                  onChange={e => setEditingClient({ ...editingClient, birthDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'de' ? 'Praxisnotizen' : 'Notes'}
              </label>
              <textarea
                rows={3}
                value={editingClient.notes || ''}
                onChange={e => setEditingClient({ ...editingClient, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setClientToDelete(editingClient);
              }}
              className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Löschen' : 'Delete'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveClient(editingClient);
                  setEditingClient(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-sm cursor-pointer"
              >
                {lang === 'de' ? 'Speichern' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Client Dossier View
  if (activeClient) {
    return (
      <div ref={rootRef} className="space-y-6">
        {/* Back and Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectClient(null)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title={lang === 'de' ? 'Zurück zur Klientenliste' : 'Back to client list'}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {activeClient.name}
                </h2>
                {activeClient.contactId ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md">
                    <BookUser className="w-3 h-3" />
                    CRM
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                    Praxis
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {activeClient.diagnosis || (lang === 'de' ? 'Keine Diagnose / Behandlungsfokus eingetragen' : 'No diagnosis specified')}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Mobile consultation timer toggle (Phase 12) */}
            {isMobileLayout && (
              consultationTimer && consultationTimer.clientId === activeClient.id ? (
                <button
                  onClick={() => {
                    stopConsultationTimer();
                    setIsQuickNoteOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-sm animate-pulse"
                  title={t('therapy.timer_stop_note', lang as LanguageCode, 'Beratung beenden & Notiz erfassen')}
                >
                  <Clock3 className="w-3.5 h-3.5" />
                  <span className="font-mono">{formatTimer(consultationSeconds)}</span>
                  <span>{lang === 'de' ? 'Beenden' : 'Stop'}</span>
                </button>
              ) : (
                <button
                  onClick={startConsultationTimer}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
                  title={t('therapy.timer_start', lang as LanguageCode, 'Beratungs-Timer starten')}
                >
                  <Clock3 className="w-3.5 h-3.5" />
                  <span>{t('therapy.timer', lang as LanguageCode, 'Timer')}</span>
                </button>
              )
            )}
            <button
              onClick={() => onOpenNewSessionForClient(activeClient.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs rounded-xl transition shadow-sm"
            >
              <Clock3 className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? '+ Sitzung' : '+ Session'}</span>
            </button>

            <button
              onClick={() => onOpenNewBillingForClient(activeClient.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition shadow-sm"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? '+ Abrechnung' : '+ Billing'}</span>
            </button>

            <button
              onClick={() => onOpenNewAppointmentForClient(activeClient.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-xl transition"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? '+ Termin' : '+ Appt'}</span>
            </button>

            <button
              onClick={() => setEditingClient(activeClient)}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition cursor-pointer"
              title={lang === 'de' ? 'Klient bearbeiten' : 'Edit client'}
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setClientToDelete(activeClient)}
              className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl transition cursor-pointer"
              title={lang === 'de' ? 'Klient löschen' : 'Delete client'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Client Dossier Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Column 1: Client Master Data */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {lang === 'de' ? 'Stammdaten & Kontakt' : 'Master Data & Contact'}
            </h3>

            <div className="space-y-2.5 text-xs">
              {activeClient.email && (
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <a href={`mailto:${activeClient.email}`} className="hover:underline truncate">{activeClient.email}</a>
                </div>
              )}

              {activeClient.phone && (
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <a href={`tel:${activeClient.phone}`} className="hover:underline">{activeClient.phone}</a>
                </div>
              )}

              {(activeClient.address || activeClient.city) && (
                <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    {activeClient.address && <div>{activeClient.address}</div>}
                    {(activeClient.zip || activeClient.city) && (
                      <div>{activeClient.zip} {activeClient.city}</div>
                    )}
                  </div>
                </div>
              )}

              {activeClient.company && (
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{activeClient.company}</span>
                </div>
              )}

              {activeClient.birthDate && (
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{lang === 'de' ? 'Geburtstag:' : 'Birth date:'} {activeClient.birthDate}</span>
                </div>
              )}
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Billing Type & Hourly Rate with direct inline quick-edit */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-semibold text-slate-400">
                  {lang === 'de' ? 'Abrechnungsart & Stundensatz' : 'Billing Type & Hourly Rate'}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRateValue(activeClient.hourlyRate?.toString() || '90');
                    setIsEditingRate(true);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition"
                  title={t('therapy.editHourlyRate', lang, 'Stundensatz bearbeiten')}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {isEditingRate ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={editingRateValue}
                    onChange={e => setEditingRateValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = parseFloat(editingRateValue);
                        onSaveClient({ ...activeClient, hourlyRate: isNaN(val) ? undefined : val });
                        setIsEditingRate(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingRate(false);
                      }
                    }}
                    placeholder="90.00"
                    className="w-24 px-2 py-1 bg-white dark:bg-slate-900 border border-blue-500 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500">{currency}/h</span>
                  <button
                    type="button"
                    onClick={() => {
                      const val = parseFloat(editingRateValue);
                      onSaveClient({ ...activeClient, hourlyRate: isNaN(val) ? undefined : val });
                      setIsEditingRate(false);
                    }}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                    title={lang === 'de' ? 'Speichern' : 'Save'}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingRate(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
                    title={lang === 'de' ? 'Abbrechen' : 'Cancel'}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200">
                  <span>
                    {activeClient.insuranceType === 'private' ? (lang === 'de' ? 'Privatversicherung' : 'Private') :
                     activeClient.insuranceType === 'statutory' ? (lang === 'de' ? 'Gesetzlich / Kostenerstattung' : 'Statutory') :
                     (lang === 'de' ? 'Selbstzahler' : 'Self-payer')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {activeClient.hourlyRate ? `${activeClient.hourlyRate.toFixed(2)} ${currency}/h` : (lang === 'de' ? 'Standard (90 €/h)' : 'Default (90/h)')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRateValue(activeClient.hourlyRate?.toString() || '90');
                        setIsEditingRate(true);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-md transition"
                      title={t('therapy.editHourlyRate', lang, 'Stundensatz bearbeiten')}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {activeClient.notes && (
              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1">
                  {lang === 'de' ? 'Praxisnotizen / Anamnese' : 'Clinical Notes'}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {activeClient.notes}
                </div>
              </div>
            )}
          </div>

          {/* Column 2 & 3: Sessions, Invoices & History */}
          <div className="md:col-span-2 space-y-5">
            {/* Sessions History */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {lang === 'de' ? 'Behandlungs- & Sitzungsverlauf' : 'Session History'} ({clientSessions.length})
                  </h3>
                </div>
                <button
                  onClick={() => onOpenNewSessionForClient(activeClient.id)}
                  className="text-xs text-teal-600 hover:underline font-medium"
                >
                  {lang === 'de' ? '+ Neue Sitzung' : '+ New Session'}
                </button>
              </div>

              {clientSessions.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {lang === 'de' ? 'Noch keine Sitzungen dokumentiert.' : 'No sessions documented yet.'}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {clientSessions.map(s => (
                    <div 
                      key={s.id} 
                      onClick={() => onEditSession?.(s)}
                      className="group p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition cursor-pointer"
                      title={t('therapy.clickToEditSession', lang, 'Klicken zum Öffnen und Bearbeiten der Sitzung')}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition flex items-center gap-1.5">
                          <Clock3 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          <span>{s.date} {s.startTime ? `• ${s.startTime} Uhr` : ''}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-teal-600 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded text-[10px]">
                            {s.duration} Min {s.fee ? `• ${s.fee.toFixed(2)} ${currency}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSession?.(s);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition"
                            title={t('therapy.editSession', lang, 'Sitzung bearbeiten')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteSession && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(s.id);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                              title={lang === 'de' ? 'Sitzung löschen' : 'Delete session'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {s.intervention && (
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">
                          {s.intervention}
                        </div>
                      )}
                      {s.progress && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {s.progress}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invoicing & Billing History */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {lang === 'de' ? 'Abrechnungsposten & Rechnungen' : 'Billing & Invoices'} ({clientBilling.length})
                  </h3>
                </div>
                <button
                  onClick={() => onOpenNewBillingForClient(activeClient.id)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  {lang === 'de' ? '+ Neue Abrechnung' : '+ New Invoice'}
                </button>
              </div>

              {clientBilling.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {lang === 'de' ? 'Keine Abrechnungsposten vorhanden.' : 'No billing items yet.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {clientBilling.map(b => (
                    <div key={b.id} className="group flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-800 text-xs transition">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {b.service || (lang === 'de' ? 'Therapieleistung' : 'Service')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {b.date} {b.invoiceNumber ? `• ${b.invoiceNumber}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {(Number(b.amount) || 0).toFixed(2)} {currency}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                          b.status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {b.status === 'paid' ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Offen' : 'Draft')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingBillingItem(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 transition"
                          title={t('therapy.editBilling', lang, 'Rechnung bearbeiten')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingItemToDelete(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                          title={lang === 'de' ? 'Löschen' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Client Modal */}
        {renderEditClientModal()}

        {/* Edit Billing Item Modal (Dossier-scoped) */}
        {editingBillingItem && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'de' ? 'Abrechnung / Rechnung bearbeiten' : 'Edit Billing Item'}
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Leistungsbezeichnung' : 'Service Description'} *
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      { label: 'Sitzung 60m', fee: 90, name: 'Psychotherapeutische Einzelsitzung (60 Min)' },
                      { label: 'Sitzung 50m', fee: 80, name: 'Psychotherapie / Beratung (50 Min)' },
                      { label: 'Erstgespräch', fee: 130, name: 'Erstanamnese & Beratungsgespräch (90 Min)' },
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setEditingBillingItem({
                          ...editingBillingItem,
                          service: preset.name,
                          amount: preset.fee
                        })}
                        className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 transition"
                      >
                        {preset.label} ({preset.fee} {currency})
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={editingBillingItem.service}
                    onChange={e => setEditingBillingItem({ ...editingBillingItem, service: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? `Honorar / Betrag (${currency})` : `Amount (${currency})`} *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingBillingItem.amount}
                      onChange={e => setEditingBillingItem({ ...editingBillingItem, amount: Number(e.target.value) || 0 })}
                      required
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Status' : 'Status'}
                    </label>
                    <select
                      value={editingBillingItem.status}
                      onChange={e => setEditingBillingItem({ ...editingBillingItem, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                    >
                      <option value="ready">{lang === 'de' ? 'Offen / Bereit' : 'Open / Ready'}</option>
                      <option value="paid">{lang === 'de' ? 'Bezahlt' : 'Paid'}</option>
                      <option value="draft">{lang === 'de' ? 'Entwurf' : 'Draft'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Datum' : 'Date'}
                    </label>
                    <input
                      type="date"
                      value={editingBillingItem.date || ''}
                      onChange={e => setEditingBillingItem({ ...editingBillingItem, date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Rechnungsnummer' : 'Invoice Number'}
                    </label>
                    <input
                      type="text"
                      value={editingBillingItem.invoiceNumber || ''}
                      onChange={e => setEditingBillingItem({ ...editingBillingItem, invoiceNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Notizen / Steuerhinweis' : 'Notes'}
                  </label>
                  <input
                    type="text"
                    value={editingBillingItem.notes || ''}
                    onChange={e => setEditingBillingItem({ ...editingBillingItem, notes: e.target.value })}
                    placeholder="z.B. Umsatzsteuerfrei gem. § 4 Nr. 14 UStG"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBillingItem(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSaveBilling?.(editingBillingItem);
                    setEditingBillingItem(null);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-sm"
                >
                  {lang === 'de' ? 'Rechnung speichern' : 'Save Invoice'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Billing Item Modal */}
        <ConfirmDeleteModal
          isOpen={Boolean(billingItemToDelete)}
          title={lang === 'de' ? 'Abrechnung löschen?' : 'Delete Billing Item?'}
          itemName={billingItemToDelete ? (billingItemToDelete.invoiceNumber || billingItemToDelete.service) : ''}
          description={lang === 'de' ? 'Möchten Sie diese Honorarabrechnung unwiderruflich löschen?' : 'Are you sure you want to delete this billing entry?'}
          onConfirm={() => {
            if (billingItemToDelete) {
              onDeleteBilling?.(billingItemToDelete.id);
              setBillingItemToDelete(null);
            }
          }}
          onClose={() => setBillingItemToDelete(null)}
        />

        {/* Delete Confirmation Modal for Dossier */}
        <ConfirmDeleteModal
          isOpen={Boolean(clientToDelete)}
          title={lang === 'de' ? 'Klient löschen?' : 'Delete Client?'}
          itemName={clientToDelete?.name}
          description={lang === 'de' 
            ? `Möchten Sie den Klienten „${clientToDelete?.name}“ sowie alle zugehörigen Behandlungsnotizen, Termine und Abrechnungen unwiderruflich löschen?` 
            : `Are you sure you want to permanently delete client "${clientToDelete?.name}" along with all clinical notes, appointments and invoices?`}
          onConfirm={() => {
            if (clientToDelete) {
              onDeleteClient(clientToDelete.id);
              if (editingClient?.id === clientToDelete.id) setEditingClient(null);
              if (activeClientId === clientToDelete.id) onSelectClient(null);
              setClientToDelete(null);
            }
          }}
          onClose={() => setClientToDelete(null)}
        />

        {/* Mobile Quick Session Note Bottom Sheet (dossier-scoped, Phase 12) */}
        {isQuickNoteOpen && (
          <div
            className="fixed inset-0 z-[9999] bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setIsQuickNoteOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-x border-slate-200 dark:border-slate-800 animate-slide-up-sheet"
            >
              <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 pt-2.5 pb-1 flex justify-center rounded-t-3xl">
                <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              <div className="px-4 pb-6 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-600 text-white shadow-xs">
                      <Clock3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {t('therapy.quick_note_title', lang as LanguageCode, 'Sitzungs-Notiz erfassen')}
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{activeClient.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsQuickNoteOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {consultationTimer && consultationTimer.clientId === activeClient.id && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <Clock3 className="w-3.5 h-3.5" />
                    <span>{t('therapy.quick_note_running', lang as LanguageCode, 'Laufende Beratung')}:</span>
                    <span className="font-mono">{formatTimer(consultationSeconds)}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('therapy.quick_note_intervention', lang as LanguageCode, 'Intervention / Methode')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('therapy.quick_note_intervention_ph', lang as LanguageCode, 'z.B. Gespräch, Verhaltenstherapie, Übungen...')}
                    value={quickNoteIntervention}
                    onChange={(e) => setQuickNoteIntervention(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('therapy.quick_note_progress', lang as LanguageCode, 'Sitzungsnotiz / Verlauf')} *
                  </label>
                  <textarea
                    rows={4}
                    autoFocus
                    placeholder={t('therapy.quick_note_progress_ph', lang as LanguageCode, 'Thema, Beobachtungen, vereinbarte Hausaufgaben...')}
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-teal-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setIsQuickNoteOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer min-h-[44px]"
                  >
                    {t('therapy.cancel', lang as LanguageCode, 'Abbrechen')}
                  </button>
                  <button
                    onClick={handleSaveQuickSessionNote}
                    disabled={!quickNoteText.trim() || isSubmittingQuickNote}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('therapy.quick_note_save', lang as LanguageCode, 'Notiz speichern')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Client List Overview
  return (
    <div className="space-y-5">
      {/* Top Search & Add Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'de' ? 'Klienten suchen nach Name, Diagnose, Notizen...' : 'Search clients...'}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Action Button: Directly opens CustomerPickerModal */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCustomerPicker}
            style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
            className="flex items-center gap-2 px-4 py-2 hover:brightness-110 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
          >
            <BookUser className="w-4 h-4" />
            <span>{lang === 'de' ? '+ Klient aus Kundenbuch hinzufügen' : '+ Add Client from Contacts'}</span>
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition cursor-pointer"
            title={lang === 'de' ? 'Manuell ohne Kontaktbuch anlegen' : 'Create manually'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'de' ? 'Manuell' : 'Manual'}</span>
          </button>
        </div>
      </div>

      {/* Clients Cards Grid */}
      {filteredClients.length === 0 ? (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <div 
            style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' }}
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center shadow-2xs"
          >
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {lang === 'de' ? 'Noch keine Klienten vorhanden' : 'No clients found'}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
            {lang === 'de' 
              ? 'Wählen Sie einen Kontakt direkt aus Ihrem Kundenbuch oder legen Sie einen neuen Klienten an.' 
              : 'Pick an existing contact from your CRM customer book or add a client manually.'}
          </p>
          <button
            onClick={onOpenCustomerPicker}
            style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
            className="inline-flex items-center gap-2 px-4 py-2 hover:brightness-110 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
          >
            <BookUser className="w-4 h-4" />
            <span>{lang === 'de' ? 'Kundenbuch öffnen & Klient wählen' : 'Open Customer Book & Select'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => {
            const clientSessionCount = sessions.filter(s => s.clientId === client.id).length;
            const clientBillingTotal = billing
              .filter(b => b.clientId === client.id)
              .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

            return (
              <div
                key={client.id}
                onClick={() => onSelectClient(client.id)}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition cursor-pointer shadow-sm group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {client.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                          {client.name}
                        </h4>
                        <div className="text-[11px] text-slate-400">
                          {client.contactId ? (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">CRM-Kunde</span>
                          ) : (
                            <span>Praxis-Klient</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingClient(client);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title={t('therapy.editClient', lang, 'Klient bearbeiten')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                    </div>
                  </div>

                  {client.diagnosis && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg mb-2.5 line-clamp-1">
                      {client.diagnosis}
                    </div>
                  )}

                  <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                    {client.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Hourly Rate (Stundensatz) Row with direct edit button */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 mb-2.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100/60 dark:border-blue-900/40 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                      {t('therapy.hourlyRate', lang, 'Stundensatz')}:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {client.hourlyRate ? `${client.hourlyRate.toFixed(2)} ${currency}/Std` : (lang === 'de' ? '90,00 €/Std' : `90.00 ${currency}/h`)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingClient(client);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition"
                        title={t('therapy.editHourlyRate', lang, 'Stundensatz bearbeiten')}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-medium">
                  <span className="text-slate-500 dark:text-slate-400">
                    {clientSessionCount} {lang === 'de' ? 'Sitzungen' : 'sessions'}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {clientBillingTotal.toFixed(2)} {currency}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Client Creation Modal (secondary option) */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'de' ? 'Manuellen Klienten anlegen' : 'Create Manual Client'}
            </h3>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = (fd.get('name') as string || '').trim();
              if (!name) return;

              let contactId: number | undefined = undefined;

              if (syncToCRM) {
                try {
                  const addedId = await db.contacts.add({
                    name,
                    phone: (fd.get('phone') as string) || '',
                    email: (fd.get('email') as string) || '',
                    company: '',
                    type: 'customer',
                    notes: (fd.get('notes') as string) || (fd.get('diagnosis') as string) || '',
                    createdAt: new Date().toISOString()
                  });
                  contactId = addedId as number;
                  onEditContactInCRM?.(contactId);
                } catch (err) {
                  console.error('Failed to auto-create contact in CRM:', err);
                }
              }

              const newClient: Client = {
                id: `client_${Date.now()}`,
                contactId,
                name,
                birthDate: (fd.get('birthDate') as string) || '',
                phone: (fd.get('phone') as string) || '',
                email: (fd.get('email') as string) || '',
                contact: (fd.get('phone') as string) || (fd.get('email') as string) || '',
                diagnosis: (fd.get('diagnosis') as string) || '',
                notes: (fd.get('notes') as string) || '',
                hourlyRate: Number(fd.get('hourlyRate')) || 90,
                insuranceType: (fd.get('insuranceType') as string) || 'self',
                createdAt: new Date().toISOString()
              };

              onSaveClient(newClient);
              setIsManualModalOpen(false);
              onSelectClient(newClient.id);
            }} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Name des Klienten' : 'Client Name'} *
                </label>
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="z.B. Max Mustermann"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Telefon' : 'Phone'}
                  </label>
                  <input
                    name="phone"
                    placeholder="+49 ..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'E-Mail' : 'Email'}
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="klient@email.de"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Diagnose / Anliegen' : 'Diagnosis / Focus'}
                </label>
                <input
                  name="diagnosis"
                  placeholder="z.B. Psychologische Beratung, Coaching..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Notizen' : 'Notes'}
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder={lang === 'de' ? 'Zusätzliche Notizen...' : 'Additional notes...'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
                />
              </div>

              {/* CRM Sync Checkbox */}
              <div className="p-2.5 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={syncToCRM}
                    onChange={e => setSyncToCRM(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-blue-950 dark:text-blue-200 block text-[11px]">
                      {lang === 'de' ? 'Auch im Kundenbuch (CRM) anlegen' : 'Also save to Customer Book (CRM)'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {lang === 'de' ? 'Erstellt automatisch einen neuen Kundenkontakt im zentralen Adressbuch.' : 'Automatically creates a customer in the central CRM address book.'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-sm"
                >
                  {lang === 'de' ? 'Klient anlegen' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Client List */}
      <ConfirmDeleteModal
        isOpen={Boolean(clientToDelete)}
        title={lang === 'de' ? 'Klient löschen?' : 'Delete Client?'}
        itemName={clientToDelete?.name}
        description={lang === 'de' 
          ? `Möchten Sie den Klienten „${clientToDelete?.name}“ sowie alle zugehörigen Behandlungsnotizen, Termine und Abrechnungen unwiderruflich löschen?` 
          : `Are you sure you want to permanently delete client "${clientToDelete?.name}" along with all clinical notes, appointments and invoices?`}
        onConfirm={() => {
          if (clientToDelete) {
            onDeleteClient(clientToDelete.id);
            if (editingClient?.id === clientToDelete.id) setEditingClient(null);
            if (activeClientId === clientToDelete.id) onSelectClient(null);
            setClientToDelete(null);
          }
        }}
        onClose={() => setClientToDelete(null)}
      />

      {/* Edit Client Modal for Overview */}
      {renderEditClientModal()}
    </div>
  );
};
