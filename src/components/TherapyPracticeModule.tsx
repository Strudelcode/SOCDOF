import React, { useState, useEffect } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { Contact } from '../types';
import { db } from '../lib/db';
import { CustomerPickerModal } from './CustomerPickerModal';
import { Client, Session, Appointment, Trip, BillingItem, PracticeData } from './therapy/types';
import { TherapyDashboard } from './therapy/TherapyDashboard';
import { TherapyClients } from './therapy/TherapyClients';
import { TherapySessions } from './therapy/TherapySessions';
import { TherapyBilling } from './therapy/TherapyBilling';
import { TherapyMileage } from './therapy/TherapyMileage';
import { TherapyAppointments } from './therapy/TherapyAppointments';

export interface TherapyPracticeModuleProps {
  contacts?: Contact[];
  onRefreshContacts?: () => void;
  currency?: string;
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
  const handleSaveSession = (session: Session, autoBilling = false) => {
    setData(prev => {
      const idx = prev.sessions.findIndex(s => s.id === session.id);
      let nextSessions = [...prev.sessions];
      if (idx >= 0) {
        nextSessions[idx] = session;
      } else {
        nextSessions = [session, ...nextSessions];
      }

      let nextBilling = [...prev.billing];
      if (autoBilling && session.fee && session.fee > 0) {
        const client = prev.clients.find(c => c.id === session.clientId);
        const billingItem: BillingItem = {
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
        nextBilling = [billingItem, ...nextBilling];
      }

      return {
        ...prev,
        sessions: nextSessions,
        billing: nextBilling
      };
    });
  };

  const handleDeleteSession = (id: string) => {
    setData(prev => ({
      ...prev,
      sessions: prev.sessions.filter(s => s.id !== id)
    }));
    showToast(lang === 'de' ? 'Sitzung gelöscht' : 'Session deleted');
  };

  // Billing Handlers
  const handleSaveBilling = (item: BillingItem) => {
    setData(prev => {
      const idx = prev.billing.findIndex(b => b.id === item.id);
      if (idx >= 0) {
        const updated = [...prev.billing];
        updated[idx] = item;
        return { ...prev, billing: updated };
      }
      return { ...prev, billing: [item, ...prev.billing] };
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-500 text-white flex items-center justify-center shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {lang === 'de' ? 'Praxis & Therapie Manager' : 'Practice & Therapy Manager'}
            </h1>
            <p className="text-xs text-slate-400">
              {lang === 'de' ? 'Klienten, Dokumentation, Abrechnung & Fahrten' : 'Clients, clinical notes, billing & mileage'}
            </p>
          </div>
        </div>

        {/* Clean Segmented Navigation Tabs without scrollbars */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl text-xs font-medium relative">
          <button
            onClick={() => { setTab('overview'); setActiveClientId(null); setIsMoreMenuOpen(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl whitespace-nowrap transition ${
              tab === 'overview' 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs font-bold' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{lang === 'de' ? 'Übersicht' : 'Overview'}</span>
          </button>

          <button
            onClick={() => { setTab('clients'); setIsMoreMenuOpen(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl whitespace-nowrap transition ${
              tab === 'clients' 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs font-bold' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{lang === 'de' ? 'Klienten' : 'Clients'}</span>
            <span className="ml-0.5 text-[10px] px-1.5 py-0.2 bg-slate-200 dark:bg-slate-600 rounded-full font-bold">
              {data.clients.length}
            </span>
          </button>

          <button
            onClick={() => { setTab('sessions'); setActiveClientId(null); setIsMoreMenuOpen(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl whitespace-nowrap transition ${
              tab === 'sessions' 
                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs font-bold' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock3 className="w-4 h-4" />
            <span>{lang === 'de' ? 'Sitzungen' : 'Sessions'}</span>
          </button>

          <button
            onClick={() => { setTab('billing'); setActiveClientId(null); setIsMoreMenuOpen(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl whitespace-nowrap transition ${
              tab === 'billing' 
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold' 
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
              className={`flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl whitespace-nowrap transition ${
                tab === 'mileage' || tab === 'appointments'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
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
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 animate-fade-in">
                  <button
                    onClick={() => {
                      setTab('mileage');
                      setActiveClientId(null);
                      setIsMoreMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition ${
                      tab === 'mileage'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Car className="w-4 h-4 text-indigo-500" />
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-left transition ${
                      tab === 'appointments'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="font-semibold">{lang === 'de' ? 'Termine & Kalender' : 'Appointments'}</div>
                      <div className="text-[10px] text-slate-400">{lang === 'de' ? 'Praxis-Planung' : 'Schedule'}</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
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
            onOpenNewSession={() => setTab('sessions')}
            onOpenNewBilling={() => setTab('billing')}
            onOpenNewTrip={() => setTab('mileage')}
            onSelectClient={clientId => {
              setActiveClientId(clientId);
              setTab('clients');
            }}
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
            onOpenNewSessionForClient={clientId => {
              setActiveClientId(clientId);
              setTab('sessions');
            }}
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
          />
        )}

        {tab === 'billing' && (
          <TherapyBilling
            billing={data.billing}
            clients={data.clients}
            sessions={data.sessions}
            currency={currency}
            onSaveBilling={handleSaveBilling}
            onDeleteBilling={handleDeleteBilling}
            onOpenCustomerPicker={() => setIsCustomerPickerOpen(true)}
            onShowToast={showToast}
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
    </div>
  );
};
export default TherapyPracticeModule;
