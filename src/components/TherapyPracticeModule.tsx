import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  Clock3,
  Edit2,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  Hospital,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  UserX,
  X
} from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';
import { Contact } from '../types';
import { CustomerPickerModal } from './CustomerPickerModal';
import { ContactEditModal } from './ContactEditModal';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';

export type Client = {
  id: string;
  name: string;
  birthDate: string;
  contact: string;
  notes: string;
  createdAt: string;
  contactId?: number | string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  zip?: string;
};

export type Session = {
  id: string;
  clientId: string;
  date: string;
  duration: number;
  template: 'intake' | 'standard' | 'crisis' | 'finalReport' | string;
  intervention: string;
  progress: string;
};

export type Appointment = {
  id: string;
  clientId: string;
  date: string;
  time?: string;
  status: 'scheduled' | 'attended' | 'cancelled' | 'missed';
  notes: string;
};

export type Trip = {
  id: string;
  clientId?: string;
  date: string;
  departure: string;
  destination: string;
  purpose: string;
  startKm: number;
  endKm: number;
  rate: number;
};

export type Billing = {
  id: string;
  clientId: string;
  date: string;
  service: string;
  amount: number;
  status: 'draft' | 'ready';
};

export type PracticeData = {
  clients: Client[];
  sessions: Session[];
  appointments: Appointment[];
  trips: Trip[];
  billing: Billing[];
};

export interface TherapyPracticeModuleProps {
  contacts?: Contact[];
  onRefreshContacts?: () => void;
  currency?: string;
  onOpenContacts?: () => void;
}

const STORAGE_KEY = 'socdof_therapy_practice_v1';

const emptyData: PracticeData = {
  clients: [],
  sessions: [],
  appointments: [],
  trips: [],
  billing: []
};

function loadData(): PracticeData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyData, ...JSON.parse(raw) } : emptyData;
  } catch {
    return emptyData;
  }
}

export const TherapyPracticeModule: React.FC<TherapyPracticeModuleProps> = ({
  contacts,
  onRefreshContacts,
  currency = '€',
  onOpenContacts
}) => {
  const currentLang = useLanguage();
  const [data, setData] = useState<PracticeData>(loadData);
  const [tab, setTab] = useState<'overview' | 'clients' | 'sessions' | 'appointments' | 'mileage' | 'billing'>('overview');
  const [query, setQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  
  // Selected client for 360-degree Dossier view
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  // Contacts state (local cache fallback if contacts prop not passed)
  const [internalContacts, setInternalContacts] = useState<Contact[]>([]);

  useEffect(() => {
    if (!contacts || contacts.length === 0) {
      db.contacts.toArray().then(loaded => {
        if (loaded && loaded.length > 0) setInternalContacts(loaded);
      }).catch(() => {});
    }
  }, [contacts]);

  const effectiveContacts = (contacts && contacts.length > 0) ? contacts : internalContacts;

  const refreshAllContacts = () => {
    onRefreshContacts?.();
    db.contacts.toArray().then(loaded => {
      setInternalContacts(loaded);
    }).catch(() => {});
  };

  // Modals state for Practice records
  type ModalState =
    | null
    | {
        kind: 'client';
        editId?: string;
        prefillContact?: Contact;
        prefillData?: Partial<Client>;
      }
    | { kind: 'session'; prefillClientId?: string; prefillDate?: string; prefillNotes?: string }
    | { kind: 'appointment'; prefillClientId?: string; prefillDate?: string }
    | { kind: 'trip'; prefillClientId?: string }
    | { kind: 'billing'; prefillClientId?: string; prefillDate?: string; prefillService?: string; prefillAmount?: number };

  const [modal, setModal] = useState<ModalState>(null);

  // CustomerPicker modal state
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [customerPickerTarget, setCustomerPickerTarget] = useState<
    | { mode: 'create_client' }
    | { mode: 'link_existing_client'; clientId: string }
    | { mode: 'in_client_modal' }
    | { mode: 'in_record_modal'; kind: 'session' | 'appointment' | 'trip' | 'billing' }
    | null
  >(null);

  // Selected contact for client modal
  const [selectedContactForClientModal, setSelectedContactForClientModal] = useState<Contact | null>(null);
  // Synchronized client ID for record modals (sessions, appointments, etc.)
  const [recordModalClientId, setRecordModalClientId] = useState<string | null>(null);

  // Direct Contact Edit Modal state
  const [isContactEditOpen, setIsContactEditOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const today = new Date().toISOString().slice(0, 10);
  const openAppointments = data.appointments.filter(a => a.date >= today && a.status === 'scheduled').length;
  const mileageTotal = data.trips.reduce((s, tr) => s + Math.max(0, tr.endKm - tr.startKm), 0);
  const billingTotal = data.billing.reduce((s, b) => s + b.amount, 0);

  // Client name lookup
  const getClient = (id?: string) => data.clients.find(c => c.id === id);
  const getClientName = (id?: string) => getClient(id)?.name || '—';

  // Navigation to client dossier
  const openClientDossier = (clientId: string) => {
    setActiveClientId(clientId);
    setTab('clients');
  };

  // Contact picker selection handler
  const handleSelectContactFromPicker = (selectedContact: Contact | null) => {
    if (!selectedContact) {
      if (customerPickerTarget?.mode === 'in_client_modal') {
        setSelectedContactForClientModal(null);
      } else if (customerPickerTarget?.mode === 'link_existing_client') {
        const targetId = customerPickerTarget.clientId;
        setData(prev => ({
          ...prev,
          clients: prev.clients.map(c => c.id === targetId ? { ...c, contactId: undefined } : c)
        }));
      }
      setCustomerPickerTarget(null);
      setIsCustomerPickerOpen(false);
      return;
    }

    sounds.playSuccess();

    if (customerPickerTarget?.mode === 'create_client') {
      // Check if client already exists with this contactId
      const existing = data.clients.find(c => String(c.contactId) === String(selectedContact.id));
      if (existing) {
        openClientDossier(existing.id);
      } else {
        const contactInfo = [selectedContact.phone, selectedContact.email].filter(Boolean).join(' | ');
        const addressInfo = [selectedContact.street, selectedContact.zip, selectedContact.city].filter(Boolean).join(', ');
        const combinedNotes = [addressInfo, selectedContact.notes].filter(Boolean).join('\n');
        
        setSelectedContactForClientModal(selectedContact);
        setModal({
          kind: 'client',
          prefillContact: selectedContact,
          prefillData: {
            name: selectedContact.name || selectedContact.company || '',
            contact: contactInfo,
            notes: combinedNotes,
            birthDate: '',
            contactId: selectedContact.id,
            email: selectedContact.email || '',
            phone: selectedContact.phone || '',
            company: selectedContact.company || '',
            address: selectedContact.street || '',
            city: selectedContact.city || '',
            zip: selectedContact.zip || ''
          }
        });
      }
    } else if (customerPickerTarget?.mode === 'link_existing_client') {
      const targetId = customerPickerTarget.clientId;
      setData(prev => ({
        ...prev,
        clients: prev.clients.map(c => {
          if (c.id !== targetId) return c;
          const contactInfo = c.contact || [selectedContact.phone, selectedContact.email].filter(Boolean).join(' | ');
          return {
            ...c,
            contactId: selectedContact.id,
            contact: contactInfo,
            email: selectedContact.email || c.email,
            phone: selectedContact.phone || c.phone,
            company: selectedContact.company || c.company
          };
        })
      }));
    } else if (customerPickerTarget?.mode === 'in_client_modal') {
      setSelectedContactForClientModal(selectedContact);
    } else if (customerPickerTarget?.mode === 'in_record_modal') {
      // Look up if client exists
      let matchedClient = data.clients.find(
        c => String(c.contactId) === String(selectedContact.id) ||
             (selectedContact.name && c.name.toLowerCase() === selectedContact.name.toLowerCase())
      );
      if (!matchedClient) {
        const newClient: Client = {
          id: crypto.randomUUID(),
          name: selectedContact.name || selectedContact.company || 'Neuer Klient',
          contact: [selectedContact.phone, selectedContact.email].filter(Boolean).join(' | '),
          notes: [selectedContact.street, selectedContact.zip, selectedContact.city, selectedContact.notes].filter(Boolean).join('\n'),
          birthDate: '',
          contactId: selectedContact.id,
          email: selectedContact.email,
          phone: selectedContact.phone,
          company: selectedContact.company,
          address: selectedContact.street,
          city: selectedContact.city,
          zip: selectedContact.zip,
          createdAt: new Date().toISOString()
        };
        setData(prev => ({
          ...prev,
          clients: [...prev.clients, newClient]
        }));
        matchedClient = newClient;
      }
      setRecordModalClientId(matchedClient.id);
    }

    setCustomerPickerTarget(null);
    setIsCustomerPickerOpen(false);
  };

  const handleLinkContactToClient = (clientId: string) => {
    sounds.playClick();
    setCustomerPickerTarget({ mode: 'link_existing_client', clientId });
    setIsCustomerPickerOpen(true);
  };

  const handleUnlinkContactFromClient = (clientId: string) => {
    sounds.playClick();
    setData(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === clientId ? { ...c, contactId: undefined } : c)
    }));
  };

  const handleEditContactDirect = (contact: Contact) => {
    sounds.playClick();
    setContactToEdit(contact);
    setIsContactEditOpen(true);
  };

  // Add or edit operations
  const saveClient = (clientValues: Omit<Client, 'id' | 'createdAt'>, editId?: string) => {
    if (editId) {
      setData(prev => ({
        ...prev,
        clients: prev.clients.map(c => c.id === editId ? { ...c, ...clientValues } : c)
      }));
    } else {
      const newClient: Client = {
        id: crypto.randomUUID(),
        ...clientValues,
        createdAt: new Date().toISOString()
      };
      setData(prev => ({
        ...prev,
        clients: [...prev.clients, newClient]
      }));
      // Auto select newly created client
      setActiveClientId(newClient.id);
    }
    setModal(null);
  };

  const saveRecord = (kind: 'sessions' | 'appointments' | 'trips' | 'billing', value: any) => {
    const id = crypto.randomUUID();
    setData(prev => ({
      ...prev,
      [kind]: [...prev[kind], { id, ...value }]
    }));
    setModal(null);
  };

  const removeRecord = (kind: keyof PracticeData, id: string) => {
    if (!window.confirm(t('therapy.confirmDelete', currentLang))) return;
    setData(prev => {
      const updated = { ...prev, [kind]: (prev[kind] as any[]).filter(x => x.id !== id) };
      if (kind === 'clients' && activeClientId === id) {
        setActiveClientId(null);
      }
      return updated;
    });
  };

  const updateAppointmentStatus = (id: string, status: Appointment['status']) => {
    setData(prev => ({
      ...prev,
      appointments: prev.appointments.map(a => a.id === id ? { ...a, status } : a)
    }));
  };

  const toggleBillingStatus = (id: string) => {
    setData(prev => ({
      ...prev,
      billing: prev.billing.map(b => b.id === id ? { ...b, status: b.status === 'draft' ? 'ready' : 'draft' } : b)
    }));
  };

  // Convert an appointment into a documented therapy session
  const convertAppointmentToSession = (appointment: Appointment) => {
    // Update appointment status to attended if it was scheduled
    if (appointment.status === 'scheduled') {
      updateAppointmentStatus(appointment.id, 'attended');
    }
    setModal({
      kind: 'session',
      prefillClientId: appointment.clientId,
      prefillDate: appointment.date,
      prefillNotes: appointment.notes
    });
  };

  // Create a billing draft directly from a session
  const createBillingFromSession = (session: Session) => {
    const serviceName = `${t(`therapy.${session.template}`, currentLang)} (${session.duration} min)`;
    setModal({
      kind: 'billing',
      prefillClientId: session.clientId,
      prefillDate: session.date,
      prefillService: serviceName,
      prefillAmount: session.duration >= 90 ? 160 : session.duration >= 60 ? 120 : 90
    });
  };

  // Filtered lists
  const filteredClients = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return data.clients;
    return data.clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.contact.toLowerCase().includes(q) ||
      c.notes.toLowerCase().includes(q)
    );
  }, [data.clients, query]);

  const filteredAppointments = useMemo(() => {
    let list = data.appointments;
    if (clientFilter !== 'all') {
      list = list.filter(a => a.clientId === clientFilter);
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [data.appointments, clientFilter]);

  const filteredSessions = useMemo(() => {
    let list = data.sessions;
    if (clientFilter !== 'all') {
      list = list.filter(s => s.clientId === clientFilter);
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [data.sessions, clientFilter]);

  const filteredBilling = useMemo(() => {
    let list = data.billing;
    if (clientFilter !== 'all') {
      list = list.filter(b => b.clientId === clientFilter);
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [data.billing, clientFilter]);

  const filteredTrips = useMemo(() => {
    let list = data.trips;
    if (clientFilter !== 'all') {
      list = list.filter(tr => tr.clientId === clientFilter);
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [data.trips, clientFilter]);

  // Active client for dossier
  const activeClient = useMemo(() => {
    if (!activeClientId) return null;
    return data.clients.find(c => c.id === activeClientId) || null;
  }, [data.clients, activeClientId]);

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header bar */}
      <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 sm:px-5 py-3 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-600 to-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Hospital className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">{t('therapy.title', currentLang)}</h1>
              <p className="text-xs text-slate-500 mt-0.5">{t('therapy.subtitle', currentLang)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('therapy.encrypted', currentLang)}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-3 sm:mt-4 flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {([
            ['overview', FileText, t('therapy.title', currentLang)],
            ['clients', UserRound, t('therapy.patients', currentLang)],
            ['sessions', Clock3, t('therapy.sessions', currentLang)],
            ['appointments', CalendarDays, t('therapy.appointments', currentLang)],
            ['mileage', Car, t('therapy.mileage', currentLang)],
            ['billing', Receipt, t('therapy.billing', currentLang)]
          ] as const).map(([tabId, Icon, label]) => {
            const isCurrent = tab === tabId;
            return (
              <button
                key={tabId}
                onClick={() => {
                  setTab(tabId);
                  if (tabId !== 'clients') {
                    // keep activeClientId saved but focus view on selected tab
                  }
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {tabId === 'clients' && data.clients.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isCurrent ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    {data.clients.length}
                  </span>
                )}
                {tabId === 'appointments' && openAppointments > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isCurrent ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                    {openAppointments}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: t('therapy.totalClients', currentLang),
                  value: data.clients.length,
                  Icon: UserRound,
                  color: 'text-blue-500',
                  action: () => setTab('clients')
                },
                {
                  label: t('therapy.totalSessions', currentLang),
                  value: data.sessions.length,
                  Icon: Clock3,
                  color: 'text-indigo-500',
                  action: () => setTab('sessions')
                },
                {
                  label: t('therapy.openAppointments', currentLang),
                  value: openAppointments,
                  Icon: CalendarDays,
                  color: 'text-emerald-500',
                  action: () => setTab('appointments')
                },
                {
                  label: t('therapy.pendingBilling', currentLang),
                  value: `€ ${billingTotal.toFixed(2)}`,
                  Icon: Receipt,
                  color: 'text-amber-500',
                  action: () => setTab('billing')
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  onClick={item.action}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <item.Icon className={`w-5 h-5 ${item.color}`} />
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition" />
                  </div>
                  <div className="text-2xl font-black">{item.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Session templates card */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="font-bold mb-3 flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-indigo-500" />
                  {t('therapy.sessionTemplates', currentLang)}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {['intake', 'standard', 'crisis', 'finalReport'].map(k => (
                    <button
                      key={k}
                      onClick={() => {
                        setTab('sessions');
                        setModal({ kind: 'session' });
                      }}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left text-xs font-semibold transition cursor-pointer border border-slate-100 dark:border-slate-750"
                    >
                      <div className="font-bold">{t(`therapy.${k}`, currentLang)}</div>
                      <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                        {k === 'intake' ? '50-90 Min.' : k === 'crisis' ? 'Akutintervention' : '50 Min.'}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Privacy & Linking info */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  {t('therapy.privacy', currentLang)}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Alle Klientendaten, Dokumentationen, Termine und Rechnungsentwürfe sind 100% lokal verknüpft. Durch Klicken auf einen Klienten öffnet sich direkt seine vollständige Akte mit allen Terminen, Sitzungsverläufen und Abrechnungen.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setModal({ kind: 'client' })}
                    className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('therapy.newPatient', currentLang)}
                  </button>
                  <button
                    onClick={() => setModal({ kind: 'appointment' })}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-750"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    {t('therapy.newAppointment', currentLang)}
                  </button>
                </div>
              </section>
            </div>
          </>
        )}

        {/* CLIENTS TAB (LIST OR 360° DOSSIER) */}
        {tab === 'clients' && (
          <>
            {activeClient ? (
              /* 360-DEGREE CLIENT DOSSIER VIEW */
              <ClientDossier
                client={activeClient}
                allData={data}
                contacts={effectiveContacts}
                onBack={() => setActiveClientId(null)}
                onEditClient={(client) => setModal({ kind: 'client', editId: client.id })}
                onDeleteClient={(id) => removeRecord('clients', id)}
                onNewAppointment={() => setModal({ kind: 'appointment', prefillClientId: activeClient.id })}
                onNewSession={() => setModal({ kind: 'session', prefillClientId: activeClient.id })}
                onNewBilling={() => setModal({ kind: 'billing', prefillClientId: activeClient.id })}
                onNewTrip={() => setModal({ kind: 'trip', prefillClientId: activeClient.id })}
                onConvertAppointmentToSession={convertAppointmentToSession}
                onCreateBillingFromSession={createBillingFromSession}
                onToggleBillingStatus={toggleBillingStatus}
                onUpdateAppointmentStatus={updateAppointmentStatus}
                onDeleteRecord={removeRecord}
                onLinkContact={handleLinkContactToClient}
                onUnlinkContact={handleUnlinkContactFromClient}
                onEditContact={handleEditContactDirect}
              />
            ) : (
              /* CLIENTS LIST VIEW */
              <ListShell
                title={t('therapy.patients', currentLang)}
                action={t('therapy.newPatient', currentLang)}
                onAdd={() => {
                  setSelectedContactForClientModal(null);
                  setModal({ kind: 'client' });
                }}
                extraActions={
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setCustomerPickerTarget({ mode: 'create_client' });
                      setIsCustomerPickerOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/80 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                    title={t('therapy.btn_import_contact', currentLang)}
                  >
                    <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>{t('therapy.btn_import_contact', currentLang)}</span>
                    {effectiveContacts.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-200/80 dark:bg-teal-900 text-teal-900 dark:text-teal-200 font-bold ml-0.5">
                        {effectiveContacts.length}
                      </span>
                    )}
                  </button>
                }
                search
                value={query}
                onSearch={setQuery}
              >
                {filteredClients.length === 0 ? (
                  <Empty text={t('therapy.emptyPatients', currentLang)} />
                ) : (
                  <div className="grid gap-2.5">
                    {filteredClients.map(c => {
                      const clientAppointments = data.appointments.filter(a => a.clientId === c.id);
                      const clientSessions = data.sessions.filter(s => s.clientId === c.id);
                      const clientBilling = data.billing.filter(b => b.clientId === c.id);
                      const nextAppt = clientAppointments
                        .filter(a => a.date >= today && a.status === 'scheduled')
                        .sort((a, b) => a.date.localeCompare(b.date))[0];
                      const totalBilled = clientBilling.reduce((sum, b) => sum + b.amount, 0);

                      return (
                        <div
                          key={c.id}
                          className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition shadow-xs"
                        >
                          <div
                            onClick={() => openClientDossier(c.id)}
                            className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm shrink-0">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                                  {c.name}
                                </span>
                                {c.contactId && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-200 border border-teal-200/60 dark:border-teal-800/50">
                                    <UserCheck className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                    CRM
                                  </span>
                                )}
                                {c.birthDate && (
                                  <span className="text-[11px] text-slate-400">
                                    (* {c.birthDate})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 truncate mt-0.5">
                                {c.contact || c.notes || '—'}
                              </div>
                              
                              {/* Linked metrics tags */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  <CalendarDays className="w-3 h-3 text-slate-400" />
                                  {clientAppointments.length} {t('therapy.appointments', currentLang)}
                                  {nextAppt && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-0.5">
                                      · {nextAppt.date}
                                    </span>
                                  )}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  <Clock3 className="w-3 h-3 text-slate-400" />
                                  {clientSessions.length} {t('therapy.sessions', currentLang)}
                                </span>
                                {totalBilled > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                    <Receipt className="w-3 h-3" />
                                    € {totalBilled.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons for this client */}
                          <div className="flex items-center gap-1 sm:self-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                            {c.contactId && (() => {
                              const linked = effectiveContacts.find(cont => String(cont.id) === String(c.contactId));
                              if (!linked) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditContactDirect(linked);
                                  }}
                                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-950/50 dark:hover:text-teal-400 text-xs font-semibold flex items-center transition cursor-pointer"
                                  title={t('therapy.btn_edit_contact', currentLang)}
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                </button>
                              );
                            })()}
                            <button
                              onClick={() => setModal({ kind: 'appointment', prefillClientId: c.id })}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title={t('therapy.newAppointmentForClient', currentLang)}
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">+ Termin</span>
                            </button>
                            <button
                              onClick={() => setModal({ kind: 'session', prefillClientId: c.id })}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title={t('therapy.newSessionForClient', currentLang)}
                            >
                              <Clock3 className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">+ Sitzung</span>
                            </button>
                            <button
                              onClick={() => openClientDossier(c.id)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              {t('therapy.viewDossier', currentLang)}
                            </button>
                            <button
                              onClick={() => removeRecord('clients', c.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                              title={t('therapy.delete', currentLang)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ListShell>
            )}
          </>
        )}

        {/* SESSIONS TAB */}
        {tab === 'sessions' && (
          <ListShell
            title={t('therapy.sessions', currentLang)}
            action={t('therapy.newSession', currentLang)}
            onAdd={() => setModal({ kind: 'session' })}
            filter={
              <ClientFilterSelect
                clients={data.clients}
                value={clientFilter}
                onChange={setClientFilter}
              />
            }
          >
            {filteredSessions.length === 0 ? (
              <Empty text={t('therapy.emptySessions', currentLang)} />
            ) : (
              <div className="grid gap-2.5">
                {filteredSessions.map(s => {
                  const client = getClient(s.clientId);
                  return (
                    <div
                      key={s.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5 sm:mt-0">
                          <Clock3 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Clickable Client Badge */}
                            {client ? (
                              <button
                                onClick={() => openClientDossier(client.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition cursor-pointer"
                              >
                                <UserRound className="w-3 h-3" />
                                {client.name}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-semibold">—</span>
                            )}
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {s.date}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                              {s.duration} min
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 font-medium">
                              {t(`therapy.${s.template}`, currentLang)}
                            </span>
                          </div>
                          {(s.intervention || s.progress) && (
                            <div className="text-xs text-slate-500 line-clamp-2 mt-1.5">
                              {s.intervention ? <span className="font-medium text-slate-600 dark:text-slate-400">{s.intervention}</span> : null}
                              {s.intervention && s.progress ? ' · ' : ''}
                              {s.progress}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {/* Quick action: Create billing from session */}
                        <button
                          onClick={() => createBillingFromSession(s)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                          title={t('therapy.createBillingFromSession', currentLang)}
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('therapy.createBillingFromSession', currentLang)}</span>
                        </button>
                        <button
                          onClick={() => removeRecord('sessions', s.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title={t('therapy.delete', currentLang)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ListShell>
        )}

        {/* APPOINTMENTS TAB */}
        {tab === 'appointments' && (
          <ListShell
            title={t('therapy.appointments', currentLang)}
            action={t('therapy.newAppointment', currentLang)}
            onAdd={() => setModal({ kind: 'appointment' })}
            filter={
              <ClientFilterSelect
                clients={data.clients}
                value={clientFilter}
                onChange={setClientFilter}
              />
            }
          >
            {filteredAppointments.length === 0 ? (
              <Empty text={t('therapy.emptyAppointments', currentLang)} />
            ) : (
              <div className="grid gap-2.5">
                {filteredAppointments.map(a => {
                  const client = getClient(a.clientId);
                  const isUpcoming = a.date >= today && a.status === 'scheduled';

                  const statusConfig = {
                    scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
                    attended: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
                    cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
                    missed: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/40'
                  }[a.status];

                  return (
                    <div
                      key={a.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition ${
                        isUpcoming
                          ? 'border-emerald-200 dark:border-emerald-800 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                          isUpcoming ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          <CalendarDays className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Clickable Client Badge */}
                            {client ? (
                              <button
                                onClick={() => openClientDossier(client.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition cursor-pointer"
                              >
                                <UserRound className="w-3 h-3" />
                                {client.name}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-semibold">—</span>
                            )}
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {a.date}
                            </span>
                            {a.time && (
                              <span className="text-xs font-semibold text-slate-500">
                                {a.time} Uhr
                              </span>
                            )}
                            <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold ${statusConfig}`}>
                              {t(`therapy.${a.status}`, currentLang)}
                            </span>
                          </div>
                          {a.notes && (
                            <div className="text-xs text-slate-500 mt-1 truncate">
                              {a.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {/* Convert to documented session */}
                        <button
                          onClick={() => convertAppointmentToSession(a)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                          title={t('therapy.convertToSession', currentLang)}
                        >
                          <Clock3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('therapy.convertToSession', currentLang)}</span>
                        </button>

                        <button
                          onClick={() => removeRecord('appointments', a.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title={t('therapy.delete', currentLang)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ListShell>
        )}

        {/* MILEAGE / FAHRTENBUCH TAB */}
        {tab === 'mileage' && (
          <ListShell
            title={t('therapy.mileage', currentLang)}
            action={t('therapy.newTrip', currentLang)}
            onAdd={() => setModal({ kind: 'trip' })}
            filter={
              <ClientFilterSelect
                clients={data.clients}
                value={clientFilter}
                onChange={setClientFilter}
              />
            }
          >
            {filteredTrips.length === 0 ? (
              <Empty text={t('therapy.emptyMileage', currentLang)} />
            ) : (
              <div className="grid gap-2.5">
                {filteredTrips.map(tr => {
                  const km = Math.max(0, tr.endKm - tr.startKm);
                  const amount = km * (tr.rate || 0.30);
                  const client = getClient(tr.clientId);

                  return (
                    <div
                      key={tr.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 mt-0.5 sm:mt-0">
                          <Car className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">
                              {tr.departure} → {tr.destination}
                            </span>
                            {client && (
                              <button
                                onClick={() => openClientDossier(client.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] cursor-pointer"
                              >
                                <UserRound className="w-3 h-3" />
                                {client.name}
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {tr.date} · {km.toFixed(1)} km ({tr.startKm} - {tr.endKm}) · € {amount.toFixed(2)}
                            {tr.purpose ? ` · ${tr.purpose}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => removeRecord('trips', tr.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title={t('therapy.delete', currentLang)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="text-xs text-slate-500 pt-2 font-semibold flex items-center justify-between px-1">
                  <span>Gesamtstrecke: {mileageTotal.toFixed(1)} km</span>
                  <span>Erstattung (ca.): € {(mileageTotal * 0.30).toFixed(2)}</span>
                </div>
              </div>
            )}
          </ListShell>
        )}

        {/* BILLING / ABRECHNUNG TAB */}
        {tab === 'billing' && (
          <ListShell
            title={t('therapy.billing', currentLang)}
            action={t('therapy.create', currentLang)}
            onAdd={() => setModal({ kind: 'billing' })}
            filter={
              <ClientFilterSelect
                clients={data.clients}
                value={clientFilter}
                onChange={setClientFilter}
              />
            }
          >
            {filteredBilling.length === 0 ? (
              <Empty text={t('therapy.emptyBilling', currentLang)} />
            ) : (
              <div className="grid gap-2.5">
                {filteredBilling.map(b => {
                  const client = getClient(b.clientId);
                  return (
                    <div
                      key={b.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                          <Receipt className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Clickable client pill */}
                            {client ? (
                              <button
                                onClick={() => openClientDossier(client.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition cursor-pointer"
                              >
                                <UserRound className="w-3 h-3" />
                                {client.name}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-semibold">—</span>
                            )}
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {b.service}
                            </span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                              € {b.amount.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {b.date}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {/* Toggle Status Pill */}
                        <button
                          onClick={() => toggleBillingStatus(b.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition border ${
                            b.status === 'ready'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {b.status === 'ready' ? t('therapy.readyStatus', currentLang) : t('therapy.draftStatus', currentLang)}
                        </button>

                        <button
                          onClick={() => removeRecord('billing', b.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title={t('therapy.delete', currentLang)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="text-xs text-slate-500 pt-2 font-semibold flex items-center justify-between px-1">
                  <span>Rechnungsvolumen gesamt:</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">€ {billingTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </ListShell>
        )}
      </div>

      {/* Modal Dialog */}
      {modal && (
        <Modal
          modalState={modal}
          clients={data.clients}
          contacts={effectiveContacts}
          selectedContactForClientModal={selectedContactForClientModal}
          onClearSelectedContactForClientModal={() => setSelectedContactForClientModal(null)}
          recordModalClientId={recordModalClientId}
          onSetRecordModalClientId={setRecordModalClientId}
          onClose={() => {
            setModal(null);
            setSelectedContactForClientModal(null);
            setRecordModalClientId(null);
          }}
          onSaveClient={saveClient}
          onSaveRecord={saveRecord}
          onQuickCreateClient={() => {
            setSelectedContactForClientModal(null);
            setModal({ kind: 'client' });
          }}
          onOpenCustomerPickerForClient={() => {
            sounds.playClick();
            setCustomerPickerTarget({ mode: 'in_client_modal' });
            setIsCustomerPickerOpen(true);
          }}
          onOpenCustomerPickerForRecord={() => {
            sounds.playClick();
            setCustomerPickerTarget({ mode: 'in_record_modal', kind: modal.kind as any });
            setIsCustomerPickerOpen(true);
          }}
          onEditContact={handleEditContactDirect}
        />
      )}

      {/* Customer Picker Modal (Global Address Book / CRM) */}
      <CustomerPickerModal
        isOpen={isCustomerPickerOpen}
        onClose={() => {
          setIsCustomerPickerOpen(false);
          setCustomerPickerTarget(null);
        }}
        contacts={effectiveContacts}
        selectedContactId={
          customerPickerTarget?.mode === 'link_existing_client'
            ? data.clients.find(c => c.id === customerPickerTarget.clientId)?.contactId
            : customerPickerTarget?.mode === 'in_client_modal'
            ? (selectedContactForClientModal?.id || (modal?.kind === 'client' && modal.editId ? data.clients.find(c => c.id === modal.editId)?.contactId : undefined))
            : undefined
        }
        onSelectContact={handleSelectContactFromPicker}
        onContactsChange={refreshAllContacts}
        currency={currency}
      />

      {/* Direct Contact Edit Modal */}
      <ContactEditModal
        isOpen={isContactEditOpen}
        onClose={() => {
          setIsContactEditOpen(false);
          setContactToEdit(null);
        }}
        contact={contactToEdit}
        currency={currency}
        onSaveSuccess={(savedContact) => {
          setIsContactEditOpen(false);
          setContactToEdit(null);
          refreshAllContacts();
          // Also update client if linked to this contact
          setData(prev => ({
            ...prev,
            clients: prev.clients.map(c => {
              if (String(c.contactId) === String(savedContact.id)) {
                const contactInfo = [savedContact.phone, savedContact.email].filter(Boolean).join(' | ');
                return {
                  ...c,
                  name: savedContact.name || c.name,
                  contact: contactInfo || c.contact,
                  email: savedContact.email || c.email,
                  phone: savedContact.phone || c.phone,
                  company: savedContact.company || c.company
                };
              }
              return c;
            })
          }));
        }}
      />
    </div>
  );
};

/* =========================================================================
   360° CLIENT DOSSIER COMPONENT (Linked View for a Specific Client)
   ========================================================================= */

interface ClientDossierProps {
  client: Client;
  allData: PracticeData;
  contacts: Contact[];
  onBack: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onNewAppointment: () => void;
  onNewSession: () => void;
  onNewBilling: () => void;
  onNewTrip: () => void;
  onConvertAppointmentToSession: (appointment: Appointment) => void;
  onCreateBillingFromSession: (session: Session) => void;
  onToggleBillingStatus: (id: string) => void;
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  onDeleteRecord: (kind: keyof PracticeData, id: string) => void;
  onLinkContact: (clientId: string) => void;
  onUnlinkContact: (clientId: string) => void;
  onEditContact: (contact: Contact) => void;
}

const ClientDossier: React.FC<ClientDossierProps> = ({
  client,
  allData,
  contacts,
  onBack,
  onEditClient,
  onDeleteClient,
  onNewAppointment,
  onNewSession,
  onNewBilling,
  onNewTrip,
  onConvertAppointmentToSession,
  onCreateBillingFromSession,
  onToggleBillingStatus,
  onUpdateAppointmentStatus,
  onDeleteRecord,
  onLinkContact,
  onUnlinkContact,
  onEditContact
}) => {
  const currentLang = useLanguage();
  const [subTab, setSubTab] = useState<'appointments' | 'sessions' | 'billing' | 'trips'>('appointments');

  const linkedContact = useMemo(() => {
    if (!client.contactId) return null;
    return contacts.find(c => String(c.id) === String(client.contactId)) || null;
  }, [client.contactId, contacts]);

  const appointments = useMemo(() =>
    allData.appointments.filter(a => a.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date)),
    [allData.appointments, client.id]
  );

  const sessions = useMemo(() =>
    allData.sessions.filter(s => s.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date)),
    [allData.sessions, client.id]
  );

  const billing = useMemo(() =>
    allData.billing.filter(b => b.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date)),
    [allData.billing, client.id]
  );

  const trips = useMemo(() =>
    allData.trips.filter(tr => tr.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date)),
    [allData.trips, client.id]
  );

  const today = new Date().toISOString().slice(0, 10);
  const nextAppt = appointments.filter(a => a.date >= today && a.status === 'scheduled')[0];
  const totalBilled = billing.reduce((sum, b) => sum + b.amount, 0);
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <div className="space-y-4">
      {/* Back button & dossier title */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('therapy.backToList', currentLang)}
        </button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEditClient(client)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {t('therapy.editClient', currentLang)}
          </button>
          <button
            onClick={() => onDeleteClient(client.id)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
            title={t('therapy.delete', currentLang)}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Client Header Card */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black text-xl shadow-xs">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black">{client.name}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  {t('therapy.patient', currentLang)}
                </span>
                {client.contactId && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-200 font-bold border border-teal-200/80 dark:border-teal-800/60">
                    <UserCheck className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    CRM
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {client.birthDate && <span>🎂 {client.birthDate}</span>}
                {client.contact && <span>📞 {client.contact}</span>}
              </div>
            </div>
          </div>

          {/* Quick Creation Buttons for this client */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={onNewAppointment}
              className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer hover:opacity-90 transition"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              + Termin
            </button>
            <button
              onClick={onNewSession}
              className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition border border-indigo-200 dark:border-indigo-800/40"
            >
              <Clock3 className="w-3.5 h-3.5" />
              + Sitzung
            </button>
            <button
              onClick={onNewBilling}
              className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition border border-amber-200 dark:border-amber-800/40"
            >
              <Receipt className="w-3.5 h-3.5" />
              + Abrechnung
            </button>
            <button
              onClick={onNewTrip}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Car className="w-3.5 h-3.5" />
              + Fahrt
            </button>
          </div>
        </div>

        {/* CRM / Address Book Link Section */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800">
          {linkedContact ? (
            <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-teal-900 dark:text-teal-200">
                      {t('therapy.linkedCustomer', currentLang)}: {linkedContact.name || linkedContact.company}
                    </span>
                    {linkedContact.company && linkedContact.name && (
                      <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                        ({linkedContact.company})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-teal-800/80 dark:text-teal-300/80 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {linkedContact.email && <span>✉️ {linkedContact.email}</span>}
                    {linkedContact.phone && <span>📞 {linkedContact.phone}</span>}
                    {(linkedContact.street || linkedContact.city) && (
                      <span>📍 {[linkedContact.street, linkedContact.zip, linkedContact.city].filter(Boolean).join(' ')}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 sm:self-center">
                <button
                  type="button"
                  onClick={() => onEditContact(linkedContact)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-300/80 dark:border-teal-700 text-teal-800 dark:text-teal-200 hover:bg-teal-100/60 dark:hover:bg-teal-900/50 text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  title={t('therapy.btn_edit_contact', currentLang)}
                >
                  <Edit2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t('therapy.btn_edit_contact', currentLang)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLinkContact(client.id)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                  title={t('therapy.btn_link_contact', currentLang)}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden min-[480px]:inline">{t('therapy.btn_link_contact', currentLang)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUnlinkContact(client.id)}
                  className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title={t('therapy.btn_unlink_contact', currentLang)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => onLinkContact(client.id)}
              className="p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-teal-50/50 hover:border-teal-300 dark:hover:border-teal-800 transition cursor-pointer group flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-teal-100 dark:group-hover:bg-teal-950/60 flex items-center justify-center text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition">
                    {t('therapy.linkWithContacts', currentLang)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {t('therapy.noContactLinkedHint', currentLang)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 group-hover:border-teal-300 text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition shadow-2xs"
              >
                + {t('therapy.selectCustomer', currentLang)}
              </button>
            </div>
          )}
        </div>

        {client.notes && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Notizen:</span>
            {client.notes}
          </div>
        )}

        {/* 4 Linked Summary Counters */}
        <div className="grid grid-cols-2 min-[640px]:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div
            onClick={() => setSubTab('appointments')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              subTab === 'appointments'
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">{t('therapy.appointments', currentLang)}</span>
              <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-lg font-black">{appointments.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              {nextAppt ? `Nächster: ${nextAppt.date}` : 'Keine offenen'}
            </div>
          </div>

          <div
            onClick={() => setSubTab('sessions')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              subTab === 'sessions'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">{t('therapy.sessions', currentLang)}</span>
              <Clock3 className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-lg font-black">{sessions.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              {totalMinutes} Min. dokumentiert
            </div>
          </div>

          <div
            onClick={() => setSubTab('billing')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              subTab === 'billing'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">{t('therapy.billing', currentLang)}</span>
              <Receipt className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-black">€ {totalBilled.toFixed(2)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              {billing.length} Rechnungsentwürfe
            </div>
          </div>

          <div
            onClick={() => setSubTab('trips')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              subTab === 'trips'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium">{t('therapy.mileage', currentLang)}</span>
              <Car className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-black">{trips.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              Hausbesuche / Fahrten
            </div>
          </div>
        </div>
      </section>

      {/* Sub-tab Navigation inside Dossier */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setSubTab('appointments')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === 'appointments'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t('therapy.linkedAppointments', currentLang)} ({appointments.length})
        </button>
        <button
          onClick={() => setSubTab('sessions')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === 'sessions'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t('therapy.linkedSessions', currentLang)} ({sessions.length})
        </button>
        <button
          onClick={() => setSubTab('billing')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === 'billing'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t('therapy.linkedBilling', currentLang)} ({billing.length})
        </button>
        <button
          onClick={() => setSubTab('trips')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            subTab === 'trips'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {t('therapy.linkedTrips', currentLang)} ({trips.length})
        </button>
      </div>

      {/* Sub-tab content */}
      <div>
        {/* 1. Appointments list for this client */}
        {subTab === 'appointments' && (
          <div className="space-y-2">
            {appointments.length === 0 ? (
              <Empty text={t('therapy.noLinkedAppointments', currentLang)} />
            ) : (
              appointments.map(a => (
                <div
                  key={a.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{a.date}</span>
                        {a.time && <span className="text-xs text-slate-500">{a.time} Uhr</span>}
                        <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {t(`therapy.${a.status}`, currentLang)}
                        </span>
                      </div>
                      {a.notes && <div className="text-xs text-slate-500 mt-0.5">{a.notes}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onConvertAppointmentToSession(a)}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-indigo-100"
                    >
                      <Clock3 className="w-3.5 h-3.5" />
                      {t('therapy.convertToSession', currentLang)}
                    </button>
                    <button
                      onClick={() => onDeleteRecord('appointments', a.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. Sessions list for this client */}
        {subTab === 'sessions' && (
          <div className="space-y-2">
            {sessions.length === 0 ? (
              <Empty text={t('therapy.noLinkedSessions', currentLang)} />
            ) : (
              sessions.map(s => (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 mt-0.5 sm:mt-0">
                      <Clock3 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{s.date}</span>
                        <span className="text-xs font-semibold text-slate-500">{s.duration} min</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                          {t(`therapy.${s.template}`, currentLang)}
                        </span>
                      </div>
                      {(s.intervention || s.progress) && (
                        <div className="text-xs text-slate-500 mt-1">
                          {s.intervention && <span className="font-medium text-slate-700 dark:text-slate-300">{s.intervention}</span>}
                          {s.intervention && s.progress ? ' · ' : ''}
                          {s.progress}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onCreateBillingFromSession(s)}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-amber-100"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      {t('therapy.createBillingFromSession', currentLang)}
                    </button>
                    <button
                      onClick={() => onDeleteRecord('sessions', s.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. Billing list for this client */}
        {subTab === 'billing' && (
          <div className="space-y-2">
            {billing.length === 0 ? (
              <Empty text={t('therapy.noLinkedBilling', currentLang)} />
            ) : (
              billing.map(b => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{b.service}</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">€ {b.amount.toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{b.date}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onToggleBillingStatus(b.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition border ${
                        b.status === 'ready'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                      }`}
                    >
                      {b.status === 'ready' ? t('therapy.readyStatus', currentLang) : t('therapy.draftStatus', currentLang)}
                    </button>
                    <button
                      onClick={() => onDeleteRecord('billing', b.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 4. Trips for this client */}
        {subTab === 'trips' && (
          <div className="space-y-2">
            {trips.length === 0 ? (
              <Empty text={t('therapy.noLinkedTrips', currentLang)} />
            ) : (
              trips.map(tr => {
                const km = Math.max(0, tr.endKm - tr.startKm);
                const amount = km * (tr.rate || 0.30);
                return (
                  <div
                    key={tr.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                        <Car className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm">{tr.departure} → {tr.destination}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {tr.date} · {km.toFixed(1)} km · € {amount.toFixed(2)}
                          {tr.purpose ? ` · ${tr.purpose}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => onDeleteRecord('trips', tr.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   REUSABLE UI COMPONENTS
   ========================================================================= */

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-750 p-6 sm:p-10 text-center text-sm text-slate-400">
    {text}
  </div>
);

const ClientFilterSelect: React.FC<{
  clients: Client[];
  value: string;
  onChange: (val: string) => void;
}> = ({ clients, value, onChange }) => {
  const currentLang = useLanguage();
  return (
    <div className="flex items-center gap-1.5">
      <Filter className="w-3.5 h-3.5 text-slate-400" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold outline-none cursor-pointer"
      >
        <option value="all">{t('therapy.allClients', currentLang)} ({clients.length})</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
};

const ListShell: React.FC<{
  title: string;
  action: string;
  onAdd: () => void;
  search?: boolean;
  value?: string;
  onSearch?: (v: string) => void;
  filter?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, onAdd, search, value, onSearch, filter, children }) => {
  const currentLang = useLanguage();
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
      <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
        <h2 className="font-bold text-base">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {filter}
          {search && onSearch && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                value={value}
                onChange={e => onSearch(e.target.value)}
                placeholder={t('therapy.search', currentLang)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none"
              />
            </div>
          )}
          <button
            onClick={onAdd}
            className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            {action}
          </button>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
};

/* =========================================================================
   MODAL COMPONENT FOR RECORD CREATION & EDITING
   ========================================================================= */

interface ModalProps {
  modalState: {
    kind: 'client' | 'session' | 'appointment' | 'trip' | 'billing';
    editId?: string;
    prefillClientId?: string;
    prefillDate?: string;
    prefillNotes?: string;
    prefillService?: string;
    prefillAmount?: number;
    prefillContact?: Contact;
    prefillData?: Partial<Client>;
  };
  clients: Client[];
  contacts: Contact[];
  selectedContactForClientModal: Contact | null;
  onClearSelectedContactForClientModal: () => void;
  recordModalClientId: string | null;
  onSetRecordModalClientId: (id: string) => void;
  onClose: () => void;
  onSaveClient: (client: Omit<Client, 'id' | 'createdAt'>, editId?: string) => void;
  onSaveRecord: (kind: 'sessions' | 'appointments' | 'trips' | 'billing', values: any) => void;
  onQuickCreateClient: () => void;
  onOpenCustomerPickerForClient: () => void;
  onOpenCustomerPickerForRecord: () => void;
  onEditContact: (contact: Contact) => void;
}

function Modal({
  modalState,
  clients,
  contacts,
  selectedContactForClientModal,
  onClearSelectedContactForClientModal,
  recordModalClientId,
  onSetRecordModalClientId,
  onClose,
  onSaveClient,
  onSaveRecord,
  onQuickCreateClient,
  onOpenCustomerPickerForClient,
  onOpenCustomerPickerForRecord,
  onEditContact
}: ModalProps) {
  const currentLang = useLanguage();
  const kind = modalState.kind;

  // Initialize form state
  const [form, setForm] = useState<any>(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (kind === 'client') {
      if (modalState.prefillData) {
        return {
          name: modalState.prefillData.name || '',
          birthDate: modalState.prefillData.birthDate || '',
          contact: modalState.prefillData.contact || '',
          notes: modalState.prefillData.notes || '',
          contactId: modalState.prefillData.contactId,
          email: modalState.prefillData.email || '',
          phone: modalState.prefillData.phone || '',
          company: modalState.prefillData.company || ''
        };
      }
      if (modalState.editId) {
        const existing = clients.find(c => c.id === modalState.editId);
        if (existing) {
          return {
            name: existing.name,
            birthDate: existing.birthDate,
            contact: existing.contact,
            notes: existing.notes,
            contactId: existing.contactId,
            email: existing.email || '',
            phone: existing.phone || '',
            company: existing.company || ''
          };
        }
      }
      return { name: '', birthDate: '', contact: '', notes: '', contactId: undefined, email: '', phone: '', company: '' };
    }

    if (kind === 'session') {
      return {
        clientId: modalState.prefillClientId || (clients[0]?.id ?? ''),
        date: modalState.prefillDate || today,
        duration: 50,
        template: 'standard',
        intervention: '',
        progress: modalState.prefillNotes || ''
      };
    }

    if (kind === 'appointment') {
      return {
        clientId: modalState.prefillClientId || (clients[0]?.id ?? ''),
        date: modalState.prefillDate || today,
        time: '10:00',
        status: 'scheduled',
        notes: ''
      };
    }

    if (kind === 'trip') {
      return {
        clientId: modalState.prefillClientId || '',
        date: today,
        departure: 'Praxis',
        destination: '',
        purpose: 'Hausbesuch',
        startKm: 0,
        endKm: 0,
        rate: 0.30
      };
    }

    // Billing
    return {
      clientId: modalState.prefillClientId || (clients[0]?.id ?? ''),
      date: modalState.prefillDate || today,
      service: modalState.prefillService || 'Therapiesitzung (50 min)',
      amount: modalState.prefillAmount ?? 90,
      status: 'draft'
    };
  });

  // Sync selected contact from CustomerPickerModal into client form
  useEffect(() => {
    if (selectedContactForClientModal && kind === 'client') {
      const contactInfo = [selectedContactForClientModal.phone, selectedContactForClientModal.email].filter(Boolean).join(' | ');
      const addressParts = [selectedContactForClientModal.street, selectedContactForClientModal.zip, selectedContactForClientModal.city].filter(Boolean).join(' ');
      const notesParts = [addressParts, selectedContactForClientModal.notes].filter(Boolean).join('\n');

      setForm((p: any) => ({
        ...p,
        name: p.name || selectedContactForClientModal.name || selectedContactForClientModal.company || '',
        contact: p.contact || contactInfo,
        notes: p.notes || notesParts,
        contactId: selectedContactForClientModal.id,
        email: selectedContactForClientModal.email || p.email || '',
        phone: selectedContactForClientModal.phone || p.phone || '',
        company: selectedContactForClientModal.company || p.company || ''
      }));
    }
  }, [selectedContactForClientModal, kind]);

  // Sync synchronized client ID for record modals
  useEffect(() => {
    if (recordModalClientId && kind !== 'client') {
      setForm((p: any) => ({ ...p, clientId: recordModalClientId }));
    }
  }, [recordModalClientId, kind]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === 'client') {
      if (!form.name.trim()) return;
      onSaveClient(form, modalState.editId);
    } else {
      const targetCollection =
        kind === 'session' ? 'sessions' :
        kind === 'appointment' ? 'appointments' :
        kind === 'trip' ? 'trips' : 'billing';
      
      onSaveRecord(targetCollection, form);
    }
  };

  // Find linked contact for client form if any
  const currentClientLinkedContact = useMemo(() => {
    if (kind !== 'client') return null;
    const cid = form.contactId || (modalState.editId ? clients.find(c => c.id === modalState.editId)?.contactId : undefined);
    if (cid) {
      const found = contacts.find(c => String(c.id) === String(cid));
      if (found) return found;
    }
    return selectedContactForClientModal;
  }, [kind, form.contactId, modalState.editId, clients, contacts, selectedContactForClientModal]);

  // Selected client in record modal
  const currentSelectedClient = useMemo(() => {
    if (kind === 'client') return null;
    return clients.find(c => c.id === form.clientId) || null;
  }, [kind, form.clientId, clients]);

  const currentSelectedClientContact = useMemo(() => {
    if (!currentSelectedClient?.contactId) return null;
    return contacts.find(c => String(c.id) === String(currentSelectedClient.contactId)) || null;
  }, [currentSelectedClient, contacts]);

  const clientDropdown = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-500">
          {kind === 'trip' ? t('therapy.clientOptional', currentLang) : t('therapy.patient', currentLang)}
        </label>
        <button
          type="button"
          onClick={onOpenCustomerPickerForRecord}
          className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1 cursor-pointer transition"
        >
          <Users className="w-3.5 h-3.5" />
          <span>{t('therapy.btn_link_contact', currentLang)}</span>
        </button>
      </div>
      {clients.length === 0 ? (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
          <span>{t('therapy.emptyPatients', currentLang)}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenCustomerPickerForRecord}
              className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer text-xs"
            >
              {t('therapy.selectCustomer', currentLang)}
            </button>
            <button
              type="button"
              onClick={onQuickCreateClient}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer text-xs"
            >
              + {t('therapy.newPatient', currentLang)}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            value={form.clientId ?? ''}
            onChange={e => {
              set('clientId', e.target.value);
              onSetRecordModalClientId(e.target.value);
            }}
            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {kind === 'trip' && <option value="">— {t('therapy.clientOptional', currentLang)} —</option>}
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.contactId ? ' [CRM]' : ''} {c.contact ? `(${c.contact})` : ''}
              </option>
            ))}
          </select>

          {currentSelectedClientContact && (
            <button
              type="button"
              onClick={() => onEditContact(currentSelectedClientContact)}
              className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-100 transition cursor-pointer shrink-0"
              title={t('therapy.btn_edit_contact', currentLang)}
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCustomerPickerForRecord}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
            title={t('therapy.selectCustomer', currentLang)}
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg my-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-base">
            {kind === 'client'
              ? (modalState.editId ? t('therapy.editClient', currentLang) : t('therapy.newPatient', currentLang))
              : kind === 'session'
              ? t('therapy.newSession', currentLang)
              : kind === 'appointment'
              ? t('therapy.newAppointment', currentLang)
              : kind === 'trip'
              ? t('therapy.newTrip', currentLang)
              : t('therapy.billing', currentLang)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {kind === 'client' && (
            <>
              {/* CRM Contact Linking Banner */}
              {currentClientLinkedContact ? (
                <div className="p-3 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/70 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-teal-900 dark:text-teal-200 truncate">
                        {t('therapy.linkedCustomer', currentLang)}: {currentClientLinkedContact.name || currentClientLinkedContact.company}
                      </div>
                      <div className="text-[11px] text-teal-700/80 dark:text-teal-300/80 truncate">
                        {[currentClientLinkedContact.company, currentClientLinkedContact.phone, currentClientLinkedContact.email].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditContact(currentClientLinkedContact)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-teal-300 text-teal-800 dark:text-teal-200 text-xs font-semibold hover:bg-teal-50 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title={t('therapy.btn_edit_contact', currentLang)}
                    >
                      <Edit2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                      <span className="hidden min-[420px]:inline">{t('therapy.btn_edit_contact', currentLang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenCustomerPickerForClient}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                      title={t('therapy.btn_link_contact', currentLang)}
                    >
                      <Search className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((p: any) => ({ ...p, contactId: undefined }));
                        onClearSelectedContactForClientModal();
                      }}
                      className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title={t('therapy.btn_unlink_contact', currentLang)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={onOpenCustomerPickerForClient}
                  className="p-3 rounded-2xl border border-dashed border-teal-300/80 dark:border-teal-800/80 bg-teal-50/40 dark:bg-teal-950/20 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-teal-900 dark:text-teal-200">
                        {t('therapy.linkWithContacts', currentLang)}
                      </div>
                      <div className="text-[11px] text-teal-700/80 dark:text-teal-400/80">
                        {t('therapy.noContactLinkedHint', currentLang)}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-teal-600 text-white text-xs font-bold shrink-0 shadow-2xs group-hover:bg-teal-700 transition">
                    + {t('therapy.selectCustomer', currentLang)}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.name', currentLang)} *
                </label>
                <input
                  required
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="z.B. Anna Schmidt"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.birthDate', currentLang)}
                  </label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={e => set('birthDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.contact', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={form.contact}
                    onChange={e => set('contact', e.target.value)}
                    placeholder="Telefon / E-Mail"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.notes', currentLang)}
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Diagnosen, Schwerpunkte, Anmerkungen..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </>
          )}

          {kind === 'session' && (
            <>
              {clientDropdown}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.date', currentLang)}
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => set('date', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.duration', currentLang)}
                  </label>
                  <input
                    type="number"
                    min={10}
                    step={5}
                    value={form.duration}
                    onChange={e => set('duration', Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.template', currentLang)}
                </label>
                <select
                  value={form.template}
                  onChange={e => set('template', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                >
                  <option value="standard">{t('therapy.standard', currentLang)} (50 min)</option>
                  <option value="intake">{t('therapy.intake', currentLang)}</option>
                  <option value="crisis">{t('therapy.crisis', currentLang)}</option>
                  <option value="finalReport">{t('therapy.finalReport', currentLang)}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.intervention', currentLang)}
                </label>
                <input
                  type="text"
                  value={form.intervention}
                  onChange={e => set('intervention', e.target.value)}
                  placeholder="z.B. Kognitive Umstrukturierung, Exposition, Ressourcenaktivierung"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.progress', currentLang)}
                </label>
                <textarea
                  rows={3}
                  value={form.progress}
                  onChange={e => set('progress', e.target.value)}
                  placeholder="Verlauf, Reaktionen des Klienten, Vereinbarungen für nächste Sitzung..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                />
              </div>
            </>
          )}

          {kind === 'appointment' && (
            <>
              {clientDropdown}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.date', currentLang)}
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => set('date', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Uhrzeit
                  </label>
                  <input
                    type="time"
                    value={form.time ?? '10:00'}
                    onChange={e => set('time', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.status', currentLang)}
                </label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                >
                  <option value="scheduled">{t('therapy.scheduled', currentLang)}</option>
                  <option value="attended">{t('therapy.attended', currentLang)}</option>
                  <option value="cancelled">{t('therapy.cancelled', currentLang)}</option>
                  <option value="missed">{t('therapy.missed', currentLang)}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.notes', currentLang)}
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Thema, Vorbereitung oder Anmerkung"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                />
              </div>
            </>
          )}

          {kind === 'trip' && (
            <>
              {clientDropdown}

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.date', currentLang)}
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.departure', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={form.departure}
                    onChange={e => set('departure', e.target.value)}
                    placeholder="Praxis"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.destination', currentLang)}
                  </label>
                  <input
                    type="text"
                    value={form.destination}
                    onChange={e => set('destination', e.target.value)}
                    placeholder="Klientenadresse / Klinik"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.purpose', currentLang)}
                </label>
                <input
                  type="text"
                  value={form.purpose}
                  onChange={e => set('purpose', e.target.value)}
                  placeholder="z.B. Hausbesuch Therapie"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.startKm', currentLang)}
                  </label>
                  <input
                    type="number"
                    value={form.startKm}
                    onChange={e => set('startKm', Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.endKm', currentLang)}
                  </label>
                  <input
                    type="number"
                    value={form.endKm}
                    onChange={e => set('endKm', Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.rate', currentLang)}
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    value={form.rate}
                    onChange={e => set('rate', Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {kind === 'billing' && (
            <>
              {clientDropdown}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.date', currentLang)}
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => set('date', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {t('therapy.amount', currentLang)} (€)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    value={form.amount}
                    onChange={e => set('amount', Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.service', currentLang)}
                </label>
                <input
                  type="text"
                  value={form.service}
                  onChange={e => set('service', e.target.value)}
                  placeholder="z.B. Psychotherapeutische Einzelsitzung (50 Min.)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {t('therapy.status', currentLang)}
                </label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold"
                >
                  <option value="draft">{t('therapy.draftStatus', currentLang)}</option>
                  <option value="ready">{t('therapy.readyStatus', currentLang)}</option>
                </select>
              </div>
            </>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
            >
              {t('therapy.cancel', currentLang)}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-90 cursor-pointer transition"
            >
              <Check className="w-4 h-4" />
              {t('therapy.save', currentLang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
