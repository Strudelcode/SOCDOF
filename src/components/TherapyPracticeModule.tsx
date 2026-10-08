import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Users, 
  Clock3, 
  CreditCard, 
  Car, 
  CalendarDays, 
  BarChart3, 
  BookUser,
  Plus,
  CheckCircle2,
  AlertCircle,
  Menu,
  ChevronDown,
  Sparkles,
  Settings,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  Zap,
  CheckCheck,
  ExternalLink,
  X
} from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';
import { Contact, CompanyProfile } from '../types';
import { db } from '../lib/db';
import { CustomerPickerModal } from './CustomerPickerModal';
import { Client, Session, Appointment, Trip, BillingItem, PracticeData } from './therapy/types';
import { 
  syncAllPracticeBilling, 
  syncBillingItemToDb, 
  checkInvoicesStatusUpdates, 
  isAutoSyncEnabled,
  setAutoSyncEnabled
} from './therapy/therapyInvoiceSync';
import { TherapyDashboard } from './therapy/TherapyDashboard';
import { TherapyClients } from './therapy/TherapyClients';
import { TherapySessions } from './therapy/TherapySessions';
import { TherapyBilling } from './therapy/TherapyBilling';
import { TherapyMileage } from './therapy/TherapyMileage';
import { TherapyAppointments } from './therapy/TherapyAppointments';
import { TherapyTaxAdvisorLedgerModal } from './therapy/TherapyTaxAdvisorLedgerModal';
import { TherapySessionModal } from './therapy/TherapySessionModal';

export interface TherapyPracticeModuleProps {
  contacts?: Contact[];
  onRefreshContacts?: () => void;
  currency?: string;
  companyProfile?: CompanyProfile;
  onOpenContacts?: () => void;
  onOpenInvoices?: () => void;
  onOpenAccounting?: () => void;
}

const STORAGE_KEY = 'socdof_therapy_practice_v2';

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
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...emptyData, ...parsed };
    }
    // Fallback check old key if exists
    const oldRaw = localStorage.getItem('socdof_therapy_practice_v1');
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw);
      return { ...emptyData, ...oldParsed };
    }
    return emptyData;
  } catch {
    return emptyData;
  }
}

export const TherapyPracticeModule: React.FC<TherapyPracticeModuleProps> = ({
  contacts,
  onRefreshContacts,
  currency = '€',
  companyProfile,
  onOpenContacts,
  onOpenInvoices,
  onOpenAccounting
}) => {
  const lang = useLanguage();
  const [data, setData] = useState<PracticeData>(loadData);
  const [tab, setTab] = useState<'overview' | 'clients' | 'sessions' | 'billing' | 'mileage' | 'appointments'>('overview');
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isTaxAdvisorLedgerOpen, setIsTaxAdvisorLedgerOpen] = useState(false);
  const [isAutoSyncActive, setIsAutoSyncActive] = useState<boolean>(isAutoSyncEnabled);
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState(false);
  const [isColorfulPractice, setIsColorfulPractice] = useState<boolean>(() => {
    try {
      return localStorage.getItem('socdof_colorful_apps_mode') === 'true' || localStorage.getItem('socdof_colorful_practice_mode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleColorful = () => {
      try {
        setIsColorfulPractice(localStorage.getItem('socdof_colorful_apps_mode') === 'true' || localStorage.getItem('socdof_colorful_practice_mode') === 'true');
      } catch {}
    };
    window.addEventListener('storage', handleColorful);
    window.addEventListener('socdof:colorful-apps-changed', handleColorful);
    window.addEventListener('socdof:colorful-practice-changed', handleColorful);
    return () => {
      window.removeEventListener('storage', handleColorful);
      window.removeEventListener('socdof:colorful-apps-changed', handleColorful);
      window.removeEventListener('socdof:colorful-practice-changed', handleColorful);
    };
  }, []);

  // Sync statistics summary
  const syncSummary = useMemo(() => {
    const total = data.billing.length;
    const synced = data.billing.filter(b => b.syncedToInvoices || Boolean(b.invoiceNumber && b.invoiceNumber.startsWith('PRAXIS-'))).length;
    return {
      total,
      synced,
      pending: Math.max(0, total - synced)
    };
  }, [data.billing]);

  const handleToggleAutoSync = () => {
    const nextVal = !isAutoSyncActive;
    setIsAutoSyncActive(nextVal);
    setAutoSyncEnabled(nextVal);
    if (nextVal) {
      handleSyncAllNow();
    } else {
      showToast(lang === 'de' ? 'Echtzeit-Synchronisation pausiert' : 'Auto-sync paused');
    }
  };

  // Dedicated central session modal state for seamless opening & editing across all tabs
  const [sessionModalState, setSessionModalState] = useState<{ isOpen: boolean; session: Session | null }>({
    isOpen: false,
    session: null
  });

  const handleOpenEditSession = (session: Session) => {
    setSessionModalState({ isOpen: true, session });
  };

  const handleOpenNewSession = (clientId?: string) => {
    const targetClient = clientId ? data.clients.find(c => c.id === clientId) : data.clients[0];
    const newSession: Session = {
      id: `sess_new_${Date.now()}`,
      clientId: targetClient?.id || '',
      date: new Date().toISOString().slice(0, 10),
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      intervention: '',
      progress: '',
      fee: targetClient?.hourlyRate || 90
    };
    setSessionModalState({ isOpen: true, session: newSession });
  };

  // Customer picker modal state
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [internalContacts, setInternalContacts] = useState<Contact[]>([]);

  // Persist data
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to persist therapy practice data', e);
    }
  }, [data]);

  // Load contacts from DB if not provided
  useEffect(() => {
    if (!contacts || contacts.length === 0) {
      db.contacts.toArray().then(loaded => {
        if (loaded && loaded.length > 0) setInternalContacts(loaded);
      }).catch(() => {});
    }
  }, [contacts]);

  const effectiveContacts = (contacts && contacts.length > 0) ? contacts : internalContacts;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check invoice status updates on mount and listen to global invoice change events
  useEffect(() => {
    checkInvoicesStatusUpdates(data.billing).then(res => {
      if (res.hasChanges) {
        setData(prev => ({ ...prev, billing: res.updatedBilling }));
      }
    }).catch(() => {});

    const handleInvoicesChanged = () => {
      checkInvoicesStatusUpdates(data.billing).then(res => {
        if (res.hasChanges) {
          setData(prev => ({ ...prev, billing: res.updatedBilling }));
        }
      }).catch(() => {});
    };

    const handleSettingChange = (e: any) => {
      if (e.detail && typeof e.detail.enabled === 'boolean') {
        setIsAutoSyncActive(e.detail.enabled);
      }
    };

    window.addEventListener('socdof:invoices-changed', handleInvoicesChanged);
    window.addEventListener('socdof:therapy-sync-setting-changed', handleSettingChange);
    return () => {
      window.removeEventListener('socdof:invoices-changed', handleInvoicesChanged);
      window.removeEventListener('socdof:therapy-sync-setting-changed', handleSettingChange);
    };
  }, [data.billing]);

  // Global manual sync trigger
  const handleSyncAllNow = async () => {
    if (isGlobalSyncing) return;
    setIsGlobalSyncing(true);
    try {
      const res = await syncAllPracticeBilling(data.billing, data.clients);
      setData(prev => ({
        ...prev,
        billing: res.updatedBilling
      }));
      showToast(
        lang === 'de'
          ? `Mit Rechnungs-App synchronisiert: ${res.syncedCount} Rechnungen (${res.newCount} neu angelegt, ${res.statusUpdatedCount} bezahlt)`
          : `Synced with Invoices app: ${res.syncedCount} invoices (${res.newCount} new, ${res.statusUpdatedCount} paid)`
      );
    } catch (err) {
      console.error('Error syncing all with invoices:', err);
      showToast(lang === 'de' ? 'Fehler beim Synchronisieren' : 'Sync error');
    } finally {
      setIsGlobalSyncing(false);
    }
  };

  // Client Selection / Import from Customer Book
  const handleSelectCustomerFromPicker = (selectedContact: Contact | null) => {
    setIsCustomerPickerOpen(false);
    if (!selectedContact) return;

    // Check if client already exists
    const existing = data.clients.find(c => 
      (selectedContact.id && c.contactId === selectedContact.id) ||
      c.name.toLowerCase() === selectedContact.name.toLowerCase()
    );

    if (existing) {
      setActiveClientId(existing.id);
      setTab('clients');
      showToast(lang === 'de' ? `Klient ${existing.name} geöffnet` : `Opened client ${existing.name}`);
      return;
    }

    // Create new client directly from CRM contact
    const newClient: Client = {
      id: `client_${Date.now()}`,
      contactId: selectedContact.id,
      name: selectedContact.name,
      birthDate: '',
      contact: selectedContact.phone || selectedContact.email || '',
      email: selectedContact.email,
      phone: selectedContact.phone,
      company: selectedContact.company,
      address: selectedContact.street,
      zip: selectedContact.zip,
      city: selectedContact.city,
      diagnosis: '',
      notes: selectedContact.notes || '',
      hourlyRate: selectedContact.default_hourly_rate || 90,
      insuranceType: 'self',
      createdAt: new Date().toISOString()
    };

    setData(prev => ({
      ...prev,
      clients: [newClient, ...prev.clients]
    }));

    setActiveClientId(newClient.id);
    setTab('clients');
    showToast(
      lang === 'de' 
        ? `Klient „${newClient.name}“ erfolgreich aus dem Kundenbuch übernommen!` 
        : `Client "${newClient.name}" successfully added from CRM contacts!`
    );
  };

  // Client Handlers
  const handleSaveClient = (client: Client) => {
    setData(prev => {
      const idx = prev.clients.findIndex(c => c.id === client.id);
      if (idx >= 0) {
        const updated = [...prev.clients];
        updated[idx] = client;
        return { ...prev, clients: updated };
      }
      return { ...prev, clients: [client, ...prev.clients] };
    });
    showToast(lang === 'de' ? 'Klient gespeichert' : 'Client saved');
  };

  const handleDeleteClient = (clientId: string) => {
    setData(prev => ({
      ...prev,
      clients: prev.clients.filter(c => c.id !== clientId),
      sessions: prev.sessions.filter(s => s.clientId !== clientId),
      appointments: prev.appointments.filter(a => a.clientId !== clientId),
      billing: prev.billing.filter(b => b.clientId !== clientId)
    }));
    if (activeClientId === clientId) setActiveClientId(null);
    showToast(lang === 'de' ? 'Klient gelöscht' : 'Client deleted');
  };

  // Session Handlers
  const handleSaveSession = async (session: Session, autoBilling = false) => {
    let newBillingItem: BillingItem | null = null;
    if (autoBilling && session.fee && session.fee > 0) {
      const client = data.clients.find(c => c.id === session.clientId);
      const rawBillingItem: BillingItem = {
        id: `bill_${Date.now()}`,
        clientId: session.clientId,
        date: session.date,
        service: session.intervention || `Psychotherapie / Beratung (${session.duration} Min)`,
        amount: session.fee,
        taxRate: 0,
        status: 'ready',
        invoiceNumber: `PRAXIS-${Date.now().toString().slice(-6)}`,
        notes: 'Erstellt aus Sitzungsdokumentation'
      };

      if (isAutoSyncActive) {
        try {
          const syncRes = await syncBillingItemToDb(rawBillingItem, client);
          newBillingItem = syncRes.updatedItem;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('socdof:invoices-changed'));
            window.dispatchEvent(new CustomEvent('socdof:contacts-changed'));
          }
        } catch (err) {
          console.error('Auto-sync error for session billing:', err);
          newBillingItem = rawBillingItem;
        }
      } else {
        newBillingItem = rawBillingItem;
      }
    }

    setData(prev => {
      const idx = prev.sessions.findIndex(s => s.id === session.id);
      let nextSessions = [...prev.sessions];
      if (idx >= 0) {
        nextSessions[idx] = session;
      } else {
        nextSessions = [session, ...nextSessions];
      }

      let nextBilling = [...prev.billing];
      if (newBillingItem) {
        nextBilling = [newBillingItem, ...nextBilling];
      }

      return {
        ...prev,
        sessions: nextSessions,
        billing: nextBilling
      };
    });

    if (newBillingItem && isAutoSyncActive) {
      showToast(
        lang === 'de'
          ? 'Sitzung gespeichert & Rechnung automatisch in Rechnungs-App synchronisiert!'
          : 'Session saved & invoice automatically synced to Invoices app!'
      );
    }
  };

  const handleDeleteSession = (id: string) => {
    setData(prev => ({
      ...prev,
      sessions: prev.sessions.filter(s => s.id !== id)
    }));
    showToast(lang === 'de' ? 'Sitzung gelöscht' : 'Session deleted');
  };

  // Billing Handlers
  const handleSaveBilling = async (item: BillingItem) => {
    let finalItem = item;
    if (isAutoSyncActive) {
      try {
        const client = data.clients.find(c => c.id === item.clientId);
        const res = await syncBillingItemToDb(item, client);
        finalItem = res.updatedItem;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('socdof:invoices-changed'));
          window.dispatchEvent(new CustomEvent('socdof:contacts-changed'));
        }
      } catch (err) {
        console.error('Auto-sync error on save billing:', err);
      }
    }

    setData(prev => {
      const idx = prev.billing.findIndex(b => b.id === finalItem.id);
      if (idx >= 0) {
        const updated = [...prev.billing];
        updated[idx] = finalItem;
        return { ...prev, billing: updated };
      }
      return { ...prev, billing: [finalItem, ...prev.billing] };
    });
  };

  const handleSaveBatchBilling = (itemsToUpdate: BillingItem[]) => {
    setData(prev => {
      const updateMap = new Map(itemsToUpdate.map(item => [item.id, item]));
      const nextBilling = prev.billing.map(b => updateMap.has(b.id) ? updateMap.get(b.id)! : b);
      itemsToUpdate.forEach(item => {
        if (!prev.billing.some(b => b.id === item.id)) {
          nextBilling.unshift(item);
        }
      });
      return { ...prev, billing: nextBilling };
    });
  };

  const handleDeleteBilling = (id: string) => {
    setData(prev => ({
      ...prev,
      billing: prev.billing.filter(b => b.id !== id)
    }));
    showToast(lang === 'de' ? 'Abrechnungsposition gelöscht' : 'Billing item deleted');
  };

  // Trip Handlers
  const handleSaveTrip = (trip: Trip) => {
    setData(prev => {
      const idx = prev.trips.findIndex(t => t.id === trip.id);
      if (idx >= 0) {
        const updated = [...prev.trips];
        updated[idx] = trip;
        return { ...prev, trips: updated };
      }
      return { ...prev, trips: [trip, ...prev.trips] };
    });
  };

  const handleDeleteTrip = (id: string) => {
    setData(prev => ({
      ...prev,
      trips: prev.trips.filter(t => t.id !== id)
    }));
    showToast(lang === 'de' ? 'Fahrt gelöscht' : 'Trip deleted');
  };

  // Appointment Handlers
  const handleSaveAppointment = (appointment: Appointment) => {
    setData(prev => {
      const idx = prev.appointments.findIndex(a => a.id === appointment.id);
      if (idx >= 0) {
        const updated = [...prev.appointments];
        updated[idx] = appointment;
        return { ...prev, appointments: updated };
      }
      return { ...prev, appointments: [appointment, ...prev.appointments] };
    });
  };

  const handleDeleteAppointment = (id: string) => {
    setData(prev => ({
      ...prev,
      appointments: prev.appointments.filter(a => a.id !== id)
    }));
    showToast(lang === 'de' ? 'Termin gelöscht' : 'Appointment deleted');
  };

  // Quick mobile session note save (Phase 12)
  const handleQuickSessionSave = (session: Session) => {
    setData(prev => ({ ...prev, sessions: [session, ...prev.sessions] }));
    showToast(
      lang === 'de'
        ? `Sitzungsnotiz für ${data.clients.find(c => c.id === session.clientId)?.name || 'Klient'} gespeichert`
        : `Session note saved for ${data.clients.find(c => c.id === session.clientId)?.name || 'client'}`
    );
  };

  return (
    <div className={`min-h-full w-full py-1.5 sm:py-3 px-1.5 sm:px-3 pb-24 space-y-4 sm:space-y-4.5 relative ${isColorfulPractice ? 'therapy-module-wrapper' : ''}`}>
      {/* Gentle Blurred Ambient Color Gradient Backdrop */}
      {isColorfulPractice && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10 rounded-3xl" aria-hidden="true">
          <div 
            className="absolute -top-24 -left-20 w-96 h-96 rounded-full opacity-10 dark:opacity-8 blur-3xl"
            style={{ background: 'var(--accent, #4f46e5)' }}
          />
          <div 
            className="absolute top-1/3 -right-24 w-96 h-96 rounded-full opacity-8 dark:opacity-6 blur-3xl"
            style={{ background: 'var(--accent, #4f46e5)' }}
          />
          <div 
            className="absolute -bottom-24 left-1/4 w-[32rem] h-80 rounded-full opacity-8 dark:opacity-6 blur-3xl"
            style={{ background: 'var(--accent, #4f46e5)' }}
          />
        </div>
      )}
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6 relative z-0">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 text-xs font-semibold animate-fade-in backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Streamlined Top Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Clean Segmented Navigation Tabs without scrollbars */}
        <div className="flex items-center flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl text-xs font-medium relative">
          <button
            onClick={() => { setTab('overview'); setActiveClientId(null); setIsMoreMenuOpen(false); }}
            style={tab === 'overview' ? { backgroundColor: 'var(--accent, #4f46e5)', color: '#ffffff' } : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl whitespace-nowrap transition ${
              tab === 'overview' 
                ? 'shadow-xs font-bold text-white' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{lang === 'de' ? 'Übersicht' : 'Overview'}</span>
          </button>

          <button
            onClick={() => { setTab('clients'); setIsMoreMenuOpen(false); }}
            style={tab === 'clients' ? { backgroundColor: 'var(--accent, #4f46e5)', color: '#ffffff' } : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl whitespace-nowrap transition ${
              tab === 'clients' 
                ? 'shadow-xs font-bold text-white' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{lang === 'de' ? 'Klienten' : 'Clients'}</span>
            <span className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              tab === 'clients' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {data.clients.length}
            </span>
          </button>

          <button
            onClick={() => { setTab('sessions'); setActiveClientId(null); setIsMoreMenuOpen(false); }}
            style={tab === 'sessions' ? { backgroundColor: 'var(--accent, #4f46e5)', color: '#ffffff' } : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl whitespace-nowrap transition ${
              tab === 'sessions' 
                ? 'shadow-xs font-bold text-white' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock3 className="w-4 h-4" />
            <span>{lang === 'de' ? 'Sitzungen' : 'Sessions'}</span>
          </button>

          <button
            onClick={() => { setTab('billing'); setActiveClientId(null); setIsMoreMenuOpen(false); }}
            style={tab === 'billing' ? { backgroundColor: 'var(--accent, #4f46e5)', color: '#ffffff' } : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl whitespace-nowrap transition ${
              tab === 'billing' 
                ? 'shadow-xs font-bold text-white' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{lang === 'de' ? 'Abrechnung' : 'Invoicing'}</span>
          </button>

          {/* "Weiteres" / "Mehr" Dropdown Menu with 3 lines (Menu) icon */}
          <div className="relative">
            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              style={tab === 'mileage' || tab === 'appointments' ? { backgroundColor: 'var(--accent, #4f46e5)', color: '#ffffff' } : undefined}
              className={`flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl whitespace-nowrap transition ${
                tab === 'mileage' || tab === 'appointments'
                  ? 'shadow-xs font-bold text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={lang === 'de' ? 'Weitere Bereiche (Fahrtenbuch, Termine)' : 'More modules'}
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">
                {tab === 'mileage' 
                  ? (lang === 'de' ? 'Fahrtenbuch' : 'Mileage')
                  : tab === 'appointments'
                  ? (lang === 'de' ? 'Termine' : 'Appointments')
                  : (lang === 'de' ? 'Weiteres' : 'More')}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Floating Dropdown */}
            {isMoreMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsMoreMenuOpen(false)} 
                />
                <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 animate-fade-in">
                  <button
                    onClick={() => {
                      setTab('mileage');
                      setActiveClientId(null);
                      setIsMoreMenuOpen(false);
                    }}
                    style={tab === 'mileage' ? { backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' } : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition ${
                      tab === 'mileage'
                        ? 'font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Car className="w-4 h-4" style={{ color: 'var(--accent, #4f46e5)' }} />
                    <div>
                      <div className="font-semibold">{lang === 'de' ? 'Fahrtenbuch' : 'Mileage Log'}</div>
                      <div className="text-[10px] text-slate-400">{lang === 'de' ? 'Dienstfahrten & Km' : 'Travel expenses'}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setTab('appointments');
                      setActiveClientId(null);
                      setIsMoreMenuOpen(false);
                    }}
                    style={tab === 'appointments' ? { backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' } : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition ${
                      tab === 'appointments'
                        ? 'font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4" style={{ color: 'var(--accent, #4f46e5)' }} />
                    <div>
                      <div className="font-semibold">{lang === 'de' ? 'Termine & Kalender' : 'Appointments'}</div>
                      <div className="text-[10px] text-slate-400">{lang === 'de' ? 'Praxis-Planung' : 'Schedule'}</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />

                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setIsTaxAdvisorLedgerOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--accent, #4f46e5)' }} />
                    <div>
                      <div className="font-semibold">{lang === 'de' ? 'Kassenbuch (Excel)' : 'Cash Ledger (Excel)'}</div>
                      <div className="text-[10px] text-slate-400">{lang === 'de' ? 'Einnahmen-Ausgaben' : 'Income & Expenses'}</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Tools & Shortcuts */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Synchronization Options Dropdown Popover */}
          <div className="relative">
            <button
              onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              title={lang === 'de' ? 'Optionen zur Rechnungs-Synchronisation' : 'Invoices sync options'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGlobalSyncing ? 'animate-spin' : ''}`} />
              <span>{lang === 'de' ? 'Rechnungs-Sync' : 'Invoices Sync'}</span>
              <span 
                className={`w-2 h-2 rounded-full ${isAutoSyncActive ? 'bg-emerald-300 animate-pulse' : 'bg-slate-400'}`} 
                title={isAutoSyncActive ? (lang === 'de' ? 'Auto-Sync aktiv' : 'Auto-Sync active') : (lang === 'de' ? 'Auto-Sync pausiert' : 'Auto-Sync paused')}
              />
              <ChevronDown className={`w-3 h-3 transition-transform ${isSyncMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Sync Options Popout Menu */}
            {isSyncMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsSyncMenuOpen(false)} 
                />
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-scale-up space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <RefreshCw className={`w-3.5 h-3.5 ${isGlobalSyncing ? 'animate-spin' : ''}`} />
                      </div>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {lang === 'de' ? 'Rechnungs-Synchronisation' : 'Invoices Sync'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isAutoSyncActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isAutoSyncActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        {isAutoSyncActive 
                          ? (lang === 'de' ? 'Aktiv' : 'Active') 
                          : (lang === 'de' ? 'Pausiert' : 'Paused')}
                      </span>

                      <button
                        onClick={() => setIsSyncMenuOpen(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sync Status Info */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-medium">
                      <span>{lang === 'de' ? 'Synchronisiert:' : 'Synchronized:'}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {syncSummary.synced} / {syncSummary.total} {lang === 'de' ? 'Rechnungen' : 'invoices'}
                      </span>
                    </div>
                    {syncSummary.pending > 0 ? (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">
                        {syncSummary.pending} {lang === 'de' ? 'Posten noch nicht mit Rechnungs-App abgeglichen' : 'items pending sync'}
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {lang === 'de' ? 'Alle Rechnungen sind synchronisiert' : 'All invoices are synchronized'}
                      </div>
                    )}
                  </div>

                  {/* Toggle Option: Real-Time Auto-Sync */}
                  <div 
                    onClick={handleToggleAutoSync}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition select-none"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-white">
                        {lang === 'de' ? 'Echtzeit-Synchronisation' : 'Real-Time Auto-Sync'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {lang === 'de' ? 'Abrechnungen & Sitzungen automatisch abgleichen' : 'Sync billing & sessions automatically'}
                      </div>
                    </div>
                    <div className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 shrink-0 ${
                      isAutoSyncActive ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                      <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                        isAutoSyncActive ? 'translate-x-3.5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>

                  {/* Action Buttons inside Popout */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleSyncAllNow();
                      }}
                      disabled={isGlobalSyncing}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGlobalSyncing ? 'animate-spin' : ''}`} />
                      <span>{isGlobalSyncing ? (lang === 'de' ? 'Synchronisiere...' : 'Syncing...') : (lang === 'de' ? 'Jetzt alles synchronisieren' : 'Sync all now')}</span>
                    </button>

                    {onOpenInvoices && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSyncMenuOpen(false);
                          onOpenInvoices();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{lang === 'de' ? 'Rechnungs-App öffnen' : 'Open Invoices App'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setIsTaxAdvisorLedgerOpen(true)}
            style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-white font-bold rounded-xl shadow-xs transition hover:brightness-110 active:scale-95 cursor-pointer"
            title={lang === 'de' ? 'Kassenbuch & 12-Monate-Excel-Export' : 'Cash Ledger & Excel'}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{lang === 'de' ? 'Kassenbuch' : 'Cash Ledger'}</span>
          </button>

          {onOpenInvoices && (
            <button
              onClick={onOpenInvoices}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-200/80 dark:border-slate-700 transition"
              title={lang === 'de' ? 'Zur Rechnungs-App wechseln' : 'Open Invoices App'}
            >
              <CreditCard className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden lg:inline">{lang === 'de' ? 'Rechnungs-App' : 'Invoices'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      <main>
        {tab === 'overview' && (
          <TherapyDashboard
            clients={data.clients}
            sessions={data.sessions}
            appointments={data.appointments}
            trips={data.trips}
            billing={data.billing}
            currency={currency}
            onNavigateTab={newTab => { setTab(newTab); setActiveClientId(null); }}
            onOpenCustomerPicker={() => setIsCustomerPickerOpen(true)}
            onOpenNewSession={() => handleOpenNewSession()}
            onOpenNewBilling={() => setTab('billing')}
            onOpenNewTrip={() => setTab('mileage')}
            onSelectClient={clientId => {
              setActiveClientId(clientId);
              setTab('clients');
            }}
            onEditSession={handleOpenEditSession}
          />
        )}

        {tab === 'clients' && (
          <TherapyClients
            clients={data.clients}
            sessions={data.sessions}
            appointments={data.appointments}
            trips={data.trips}
            billing={data.billing}
            currency={currency}
            activeClientId={activeClientId}
            onSelectClient={setActiveClientId}
            onOpenCustomerPicker={() => setIsCustomerPickerOpen(true)}
            onSaveClient={handleSaveClient}
            onDeleteClient={handleDeleteClient}
            onOpenNewSessionForClient={clientId => handleOpenNewSession(clientId)}
            onOpenNewBillingForClient={clientId => {
              setActiveClientId(clientId);
              setTab('billing');
            }}
            onOpenNewAppointmentForClient={clientId => {
              setActiveClientId(clientId);
              setTab('appointments');
            }}
            onOpenNewTripForClient={clientId => {
              setActiveClientId(clientId);
              setTab('mileage');
            }}
            onQuickSessionSave={handleQuickSessionSave}
            onEditSession={handleOpenEditSession}
            onDeleteSession={handleDeleteSession}
            onSaveBilling={handleSaveBilling}
            onDeleteBilling={handleDeleteBilling}
          />
        )}

        {tab === 'sessions' && (
          <TherapySessions
            sessions={data.sessions}
            clients={data.clients}
            currency={currency}
            onSaveSession={handleSaveSession}
            onDeleteSession={handleDeleteSession}
            onSelectClient={clientId => {
              setActiveClientId(clientId);
              setTab('clients');
            }}
            onShowToast={showToast}
            onEditSession={handleOpenEditSession}
            onOpenNewSession={() => handleOpenNewSession()}
          />
        )}

        {tab === 'billing' && (
          <TherapyBilling
            billing={data.billing}
            clients={data.clients}
            sessions={data.sessions}
            company={companyProfile}
            currency={currency}
            onSaveBilling={handleSaveBilling}
            onSaveBatchBilling={handleSaveBatchBilling}
            onDeleteBilling={handleDeleteBilling}
            onOpenCustomerPicker={() => setIsCustomerPickerOpen(true)}
            onShowToast={showToast}
            onOpenInvoices={onOpenInvoices}
          />
        )}

        {tab === 'mileage' && (
          <TherapyMileage
            trips={data.trips}
            clients={data.clients}
            currency={currency}
            onSaveTrip={handleSaveTrip}
            onDeleteTrip={handleDeleteTrip}
            onSelectClient={clientId => {
              setActiveClientId(clientId);
              setTab('clients');
            }}
            onShowToast={showToast}
          />
        )}

        {tab === 'appointments' && (
          <TherapyAppointments
            appointments={data.appointments}
            clients={data.clients}
            onSaveAppointment={handleSaveAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            onSelectClient={clientId => {
              setActiveClientId(clientId);
              setTab('clients');
            }}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Official Customer Picker Modal from CRM */}
      <CustomerPickerModal
        isOpen={isCustomerPickerOpen}
        onClose={() => setIsCustomerPickerOpen(false)}
        contacts={effectiveContacts}
        onSelectContact={handleSelectCustomerFromPicker}
        onContactsChange={onRefreshContacts}
        currency={currency}
      />

      {/* Monthly Cash Ledger & Incomes/Expenses for Tax Advisor Modal */}
      {isTaxAdvisorLedgerOpen && (
        <TherapyTaxAdvisorLedgerModal
          isOpen={isTaxAdvisorLedgerOpen}
          onClose={() => setIsTaxAdvisorLedgerOpen(false)}
          practiceData={data}
          company={companyProfile}
          currency={currency}
        />
      )}

      {/* Central Therapy Session Modal (enables opening and editing any session arbitrarily) */}
      <TherapySessionModal
        isOpen={sessionModalState.isOpen}
        session={sessionModalState.session}
        clients={data.clients}
        currency={currency}
        onSave={(savedSession, autoBilling) => {
          handleSaveSession(savedSession, autoBilling);
          setSessionModalState({ isOpen: false, session: null });
        }}
        onClose={() => setSessionModalState({ isOpen: false, session: null })}
        onDelete={(sessionId) => {
          handleDeleteSession(sessionId);
          setSessionModalState({ isOpen: false, session: null });
        }}
        onSelectClient={(clientId) => {
          setSessionModalState({ isOpen: false, session: null });
          setActiveClientId(clientId);
          setTab('clients');
        }}
      />
      </div>
    </div>
  );
};
export default TherapyPracticeModule;
