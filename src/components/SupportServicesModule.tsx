import React, { useState, useMemo } from 'react';
import { 
  Headphones, 
  Plus, 
  Search, 
  Clock, 
  Calendar, 
  User, 
  Building2, 
  Mail, 
  Phone, 
  Tag, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Edit2, 
  Trash2, 
  X, 
  ArrowUpRight, 
  DollarSign, 
  Sparkles, 
  Check, 
  HelpCircle, 
  MessageSquare,
  Receipt
} from 'lucide-react';
import { Contact, CompanyProfile, SupportServiceTicket } from '../types';
import { sounds } from '../lib/sound';

interface SupportServicesModuleProps {
  contacts: Contact[];
  companyProfile: CompanyProfile;
  onCreateInvoiceForService?: (ticket: SupportServiceTicket) => void;
}

const STORAGE_KEY = 'socdof_support_services_tickets';

export const SupportServicesModule: React.FC<SupportServicesModuleProps> = ({
  contacts,
  companyProfile,
  onCreateInvoiceForService
}) => {
  const [tickets, setTickets] = useState<SupportServiceTicket[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'SRV-1001',
        title: 'IT-Netzwerk Einrichtung & Server-Wartung',
        contact_id: contacts[0]?.id,
        contact_name: contacts[0]?.name || 'Mustermann GmbH',
        contact_email: contacts[0]?.email || 'it@mustermann.example',
        contact_phone: contacts[0]?.phone || '+49 89 123456',
        contact_company: contacts[0]?.company || 'Mustermann IT',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '11:30',
        durationMinutes: 150,
        assignedStaff: 'Yuri / IT-Support',
        hourlyRate: 95,
        billable: true,
        status: 'completed',
        tags: ['Vor-Ort', 'Netzwerk', 'Server'],
        description: 'Konfiguration des neuen Routers, Einrichtung der Firewall-Regeln und Offline-Backup-Prüfung.',
        internalNotes: 'Kunde war sehr zufrieden. Folge-Wartung für nächsten Monat vereinbart.',
        createdAt: new Date().toISOString()
      },
      {
        id: 'SRV-1002',
        title: 'Software-Schulung & Beleg-Workflow',
        contact_id: contacts[1]?.id,
        contact_name: contacts[1]?.name || 'Dr. Schmidt & Partner',
        contact_email: contacts[1]?.email || 'kanzlei@schmidt.example',
        contact_phone: contacts[1]?.phone || '+49 30 987654',
        contact_company: contacts[1]?.company || 'Kanzlei Schmidt',
        date: new Date().toISOString().split('T')[0],
        startTime: '14:00',
        endTime: '15:00',
        durationMinutes: 60,
        assignedStaff: 'Support Team',
        hourlyRate: 95,
        billable: true,
        status: 'in_progress',
        tags: ['Remote', 'Schulung', 'Rechnungswesen'],
        description: 'Einweisung des Teams in die neue DIN 5008 Rechnungsstellung und BWA-Exporte.',
        internalNotes: 'Remote via Screen-Share.',
        createdAt: new Date().toISOString()
      }
    ];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'completed' | 'invoiced'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Partial<SupportServiceTicket> | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Persist tickets
  const saveTickets = (updated: SupportServiceTicket[]) => {
    setTickets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        t.title.toLowerCase().includes(q) ||
        t.contact_name.toLowerCase().includes(q) ||
        (t.contact_company && t.contact_company.toLowerCase().includes(q)) ||
        t.tags.some(tag => tag.toLowerCase().includes(q)) ||
        t.description.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [tickets, statusFilter, searchQuery]);

  const handleOpenCreate = () => {
    sounds.playClick();
    const now = new Date();
    const startStr = `${String(now.getHours()).padStart(2, '0')}:00`;
    const endStr = `${String(now.getHours() + 1).padStart(2, '0')}:00`;

    const defaultContact = contacts[0];

    setEditingTicket({
      id: `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
      title: '',
      contact_id: defaultContact?.id,
      contact_name: defaultContact?.name || '',
      contact_email: defaultContact?.email || '',
      contact_phone: defaultContact?.phone || '',
      contact_company: defaultContact?.company || '',
      date: new Date().toISOString().split('T')[0],
      startTime: startStr,
      endTime: endStr,
      durationMinutes: 60,
      assignedStaff: 'Mitarbeiter / Support',
      hourlyRate: 90,
      billable: true,
      status: 'open',
      tags: ['Support', 'Dienstleistung'],
      description: '',
      internalNotes: ''
    });
    setTagInput('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ticket: SupportServiceTicket) => {
    sounds.playClick();
    setEditingTicket({ ...ticket });
    setTagInput('');
    setIsModalOpen(true);
  };

  const handleSelectContact = (contactIdStr: string) => {
    const cid = parseInt(contactIdStr);
    const found = contacts.find(c => c.id === cid);
    if (found && editingTicket) {
      setEditingTicket({
        ...editingTicket,
        contact_id: found.id,
        contact_name: found.name,
        contact_email: found.email || '',
        contact_phone: found.phone || '',
        contact_company: found.company || ''
      });
    }
  };

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return 60;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return diff > 0 ? diff : 60;
  };

  const handleSaveTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket || !editingTicket.title || !editingTicket.contact_name) {
      sounds.playError();
      return;
    }

    const duration = calculateDuration(editingTicket.startTime || '09:00', editingTicket.endTime || '10:00');
    const fullTicket: SupportServiceTicket = {
      id: editingTicket.id || `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
      title: editingTicket.title,
      contact_id: editingTicket.contact_id,
      contact_name: editingTicket.contact_name,
      contact_email: editingTicket.contact_email,
      contact_phone: editingTicket.contact_phone,
      contact_company: editingTicket.contact_company,
      date: editingTicket.date || new Date().toISOString().split('T')[0],
      startTime: editingTicket.startTime || '09:00',
      endTime: editingTicket.endTime || '10:00',
      durationMinutes: duration,
      assignedStaff: editingTicket.assignedStaff || 'Support',
      hourlyRate: Number(editingTicket.hourlyRate) || 0,
      billable: editingTicket.billable !== false,
      status: editingTicket.status || 'open',
      tags: editingTicket.tags || ['Dienstleistung'],
      description: editingTicket.description || '',
      internalNotes: editingTicket.internalNotes || '',
      createdAt: editingTicket.createdAt || new Date().toISOString()
    };

    const exists = tickets.some(t => t.id === fullTicket.id);
    let nextList: SupportServiceTicket[];
    if (exists) {
      nextList = tickets.map(t => t.id === fullTicket.id ? fullTicket : t);
    } else {
      nextList = [fullTicket, ...tickets];
    }

    saveTickets(nextList);
    sounds.playSuccess();
    setIsModalOpen(false);
    setEditingTicket(null);
  };

  const handleDeleteTicket = (id: string) => {
    if (!confirm('Diesen Support-Einsatz wirklich löschen?')) return;
    const nextList = tickets.filter(t => t.id !== id);
    saveTickets(nextList);
    sounds.playSuccess();
  };

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${companyProfile.currency || '€'}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Headphones className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Kunden-Support & Dienstleistungen</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Erfassung, Zeiterfassung und Dokumentation von Support-Einsätzen und Serviceleistungen für Kunden.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Neuer Support-Einsatz</span>
        </button>
      </div>

      {/* Filter Chips & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs">
          {[
            { id: 'all', label: 'Alle Einsätze' },
            { id: 'open', label: 'Offen' },
            { id: 'in_progress', label: 'In Bearbeitung' },
            { id: 'completed', label: 'Erledigt' },
            { id: 'invoiced', label: 'Abgerechnet' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                sounds.playClick();
                setStatusFilter(tab.id as any);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Kunde, Titel oder Tag suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Tickets List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTickets.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 text-xs">
            Keine Support-Einsätze gefunden.
          </div>
        ) : (
          filteredTickets.map((t) => {
            const hours = (t.durationMinutes / 60).toFixed(1);
            const totalEstimated = ((t.durationMinutes / 60) * (t.hourlyRate || 0));

            return (
              <div 
                key={t.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {t.id}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        t.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300' :
                        t.status === 'in_progress' ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300' :
                        t.status === 'invoiced' ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {t.status === 'completed' ? 'Erledigt' :
                         t.status === 'in_progress' ? 'In Bearbeitung' :
                         t.status === 'invoiced' ? 'Abgerechnet' : 'Offen'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(t)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Bearbeiten"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTicket(t.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5">
                    {t.title}
                  </h3>

                  {/* Customer Information Card */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1 mb-3 text-xs">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{t.contact_name}</span>
                      {t.contact_company && (
                        <span className="text-[11px] text-slate-400 font-normal">({t.contact_company})</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {t.contact_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{t.contact_email}</span>
                        </span>
                      )}
                      {t.contact_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{t.contact_phone}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {t.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                      {t.description}
                    </p>
                  )}

                  {/* Tags */}
                  {t.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mb-3">
                      {t.tags.map((tag, idx) => (
                        <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Stats & Duration */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.date}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.startTime} - {t.endTime} ({hours} Std.)</span>
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-indigo-600 dark:text-indigo-400 font-mono-num">
                      {formatCurrency(totalEstimated)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {t.billable ? `${formatCurrency(t.hourlyRate || 0)}/Std.` : 'Kulanz / Nicht abrechenbar'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Headphones className="w-4 h-4 text-indigo-500" />
                <span>{editingTicket.id ? 'Support-Einsatz bearbeiten' : 'Neuen Support-Einsatz erfassen'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTicket} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Title */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bezeichnung / Einsatz-Titel *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. IT-Support Server-Update oder Vor-Ort-Wartung"
                  value={editingTicket.title || ''}
                  onChange={(e) => setEditingTicket({ ...editingTicket, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Customer Selector from Contact Book */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kunde aus Kontakten wählen *
                  </label>
                  <select
                    value={editingTicket.contact_id || ''}
                    onChange={(e) => handleSelectContact(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                  >
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Zuständiger Bearbeiter
                  </label>
                  <input
                    type="text"
                    placeholder="Mitarbeiter / Team"
                    value={editingTicket.assignedStaff || ''}
                    onChange={(e) => setEditingTicket({ ...editingTicket, assignedStaff: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Time Tracking: Date, Start, End */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Einsatz-Datum
                  </label>
                  <input
                    type="date"
                    value={editingTicket.date || ''}
                    onChange={(e) => setEditingTicket({ ...editingTicket, date: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Startzeit
                  </label>
                  <input
                    type="time"
                    value={editingTicket.startTime || '09:00'}
                    onChange={(e) => setEditingTicket({ ...editingTicket, startTime: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Endzeit
                  </label>
                  <input
                    type="time"
                    value={editingTicket.endTime || '10:00'}
                    onChange={(e) => setEditingTicket({ ...editingTicket, endTime: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Billing Rate & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Stundensatz in {companyProfile.currency || '€'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={editingTicket.hourlyRate ?? 90}
                    onChange={(e) => setEditingTicket({ ...editingTicket, hourlyRate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editingTicket.status || 'open'}
                    onChange={(e) => setEditingTicket({ ...editingTicket, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="open">Offen</option>
                    <option value="in_progress">In Bearbeitung</option>
                    <option value="completed">Erledigt / Abgeschlossen</option>
                    <option value="invoiced">Abgerechnet</option>
                  </select>
                </div>
              </div>

              {/* Description & Work Log */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Beschreibung der durchgeführten Arbeiten
                </label>
                <textarea
                  rows={2}
                  placeholder="Detaillierte Tätigkeitsbeschreibung für den Kunden..."
                  value={editingTicket.description || ''}
                  onChange={(e) => setEditingTicket({ ...editingTicket, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Interne Notizen (nicht auf Rechnung sichtbar)
                </label>
                <textarea
                  rows={2}
                  placeholder="Interne Vermerke, Passwörter, Folge-Absprachen..."
                  value={editingTicket.internalNotes || ''}
                  onChange={(e) => setEditingTicket({ ...editingTicket, internalNotes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  Einsatz speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
