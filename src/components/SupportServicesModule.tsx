import React, { useState, useMemo, useEffect } from 'react';
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
  Receipt,
  Play,
  Square,
  Star,
  Layers,
  Send,
  StickyNote,
  History,
  Kanban,
  List,
  Filter,
  Users,
  ChevronRight,
  MoreHorizontal,
  Settings,
  FolderPlus
} from 'lucide-react';
import { Contact, CompanyProfile, SupportServiceTicket, SupportTimesheetEntry, SupportActivityEntry } from '../types';
import { sounds } from '../lib/sound';

interface SupportServicesModuleProps {
  contacts: Contact[];
  companyProfile: CompanyProfile;
  onCreateInvoiceForService?: (ticket: SupportServiceTicket) => void;
}

const STORAGE_KEY = 'socdof_support_services_tickets_v2';
const TEAMS_STORAGE_KEY = 'socdof_support_teams_list_v2';

const DEFAULT_TEAMS = [
  'Kundendienst & Service',
  'IT & Software-Support',
  'Vor-Ort & Montage',
  'Garantie & Reklamation',
  'Kundenbetreuung'
];

const STAFF_LIST = [
  'Robert Hölzl',
  'Yuri',
  'Kundendienst-Team',
  'Technik-Support'
];

export const SupportServicesModule: React.FC<SupportServicesModuleProps> = ({
  contacts,
  companyProfile,
  onCreateInvoiceForService
}) => {
  // Support Teams state (customizable by user)
  const [teams, setTeams] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(TEAMS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_TEAMS;
  });

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeamIndex, setEditingTeamIndex] = useState<number | null>(null);
  const [editingTeamValue, setEditingTeamValue] = useState('');

  // Tickets state - strictly NO prefilled mock data
  const [tickets, setTickets] = useState<SupportServiceTicket[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'detail'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Detail / Edit Form state
  const [activeTab, setActiveTab] = useState<'description' | 'timesheets'>('description');
  const [chatterTab, setChatterTab] = useState<'note' | 'activity'>('note');
  const [chatterInput, setChatterInput] = useState('');
  
  // Quick Timesheet Row Form
  const [isAddingTimesheet, setIsAddingTimesheet] = useState(false);
  const [newTsDate, setNewTsDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTsStaff, setNewTsStaff] = useState(STAFF_LIST[0]);
  const [newTsDesc, setNewTsDesc] = useState('');
  const [newTsHours, setNewTsHours] = useState('1.0');
  const [tagInput, setTagInput] = useState('');

  // Save to LocalStorage
  const saveTickets = (updated: SupportServiceTicket[]) => {
    setTickets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const saveTeams = (updatedTeams: string[]) => {
    setTeams(updatedTeams);
    try {
      localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(updatedTeams));
    } catch (e) {
      console.error(e);
    }
  };

  const selectedTicket = useMemo(() => {
    return tickets.find(t => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesTeam = selectedTeamFilter === 'all' || t.team === selectedTeamFilter;
      const matchesStatus = selectedStatusFilter === 'all' || t.status === selectedStatusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        t.title.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        (t.contact_name && t.contact_name.toLowerCase().includes(q)) ||
        (t.contact_company && t.contact_company.toLowerCase().includes(q)) ||
        t.assignedStaff.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q));
      return matchesTeam && matchesStatus && matchesSearch;
    });
  }, [tickets, selectedTeamFilter, selectedStatusFilter, searchQuery]);

  // Create new Ticket
  const handleCreateNewTicket = () => {
    sounds.playClick();
    const newId = `sup_${Date.now()}`;
    const newTicketNumber = `SUP-${1000 + tickets.length + 1}`;
    
    // Auto-select first contact if available
    const initialContact = contacts.length > 0 ? contacts[0] : null;

    const newTicket: SupportServiceTicket = {
      id: newId,
      ticketNumber: newTicketNumber,
      title: 'Neues Support-Ticket / Auftrag',
      team: teams[0] || 'Kundendienst & Service',
      assignedStaff: STAFF_LIST[0],
      priority: 1,
      tags: ['Support'],
      contact_id: initialContact?.id,
      contact_name: initialContact?.name || '',
      contact_email: initialContact?.email || '',
      contact_phone: initialContact?.phone || '',
      contact_company: initialContact?.company || '',
      status: 'new',
      description: '',
      hourlyRate: 95,
      billable: true,
      timesheets: [],
      activities: [
        {
          id: `act_${Date.now()}`,
          author: STAFF_LIST[0],
          type: 'system',
          content: 'Ticket neu angelegt.',
          createdAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString()
    };

    const updated = [newTicket, ...tickets];
    saveTickets(updated);
    setSelectedTicketId(newId);
    setViewMode('detail');
  };

  // Update selected ticket helper
  const updateCurrentTicket = (updates: Partial<SupportServiceTicket>) => {
    if (!selectedTicketId) return;
    const updated = tickets.map(t => {
      if (t.id === selectedTicketId) {
        return { ...t, ...updates, updatedAt: new Date().toISOString() };
      }
      return t;
    });
    saveTickets(updated);
  };

  // Delete ticket
  const handleDeleteTicket = (ticketId: string) => {
    if (!confirm('Möchten Sie dieses Support-Ticket wirklich löschen?')) return;
    sounds.playClick();
    const updated = tickets.filter(t => t.id !== ticketId);
    saveTickets(updated);
    if (selectedTicketId === ticketId) {
      setSelectedTicketId(null);
      setViewMode('list');
    }
  };

  // Status Change
  const handleStatusChange = (newStatus: SupportServiceTicket['status']) => {
    if (!selectedTicket) return;
    sounds.playClick();
    const statusLabels: Record<string, string> = {
      new: 'Neu',
      in_progress: 'In Bearbeitung',
      waiting: 'In Warteschlange',
      resolved: 'Gelöst',
      closed: 'Abgeschlossen',
      invoiced: 'Abgerechnet'
    };

    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: selectedTicket.assignedStaff || 'System',
      type: 'system',
      content: `Status geändert auf: "${statusLabels[newStatus] || newStatus}"`,
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      status: newStatus,
      activities: [newActivity, ...selectedTicket.activities]
    });
  };

  // Toggle Live Timer
  const handleToggleTimer = () => {
    if (!selectedTicket) return;
    sounds.playClick();
    if (selectedTicket.isTimerRunning) {
      // Stop timer and add timesheet
      const start = selectedTicket.timerStartedAt ? new Date(selectedTicket.timerStartedAt).getTime() : Date.now();
      const elapsedMs = Math.max(Date.now() - start, 60000); // min 1 min
      const hours = Number((elapsedMs / (1000 * 60 * 60)).toFixed(2));

      const newEntry: SupportTimesheetEntry = {
        id: `ts_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        staff: selectedTicket.assignedStaff,
        description: 'Live-Zeiterfassung Support & Bearbeitung',
        hours: Math.max(hours, 0.25),
        hourlyRate: selectedTicket.hourlyRate || 95,
        billable: selectedTicket.billable
      };

      const newActivity: SupportActivityEntry = {
        id: `act_${Date.now()}`,
        author: selectedTicket.assignedStaff,
        type: 'activity',
        content: `Live-Timer gestoppt: ${newEntry.hours} Std. für "${newEntry.description}" verbucht.`,
        createdAt: new Date().toISOString()
      };

      updateCurrentTicket({
        isTimerRunning: false,
        timerStartedAt: undefined,
        timesheets: [...selectedTicket.timesheets, newEntry],
        activities: [newActivity, ...selectedTicket.activities]
      });
    } else {
      // Start timer
      updateCurrentTicket({
        isTimerRunning: true,
        timerStartedAt: new Date().toISOString(),
        status: selectedTicket.status === 'new' ? 'in_progress' : selectedTicket.status
      });
    }
  };

  // Add Timesheet Entry
  const handleAddTimesheetEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newTsDesc) return;
    sounds.playClick();

    const hours = parseFloat(newTsHours) || 1.0;
    const entry: SupportTimesheetEntry = {
      id: `ts_${Date.now()}`,
      date: newTsDate,
      staff: newTsStaff,
      description: newTsDesc,
      hours,
      hourlyRate: selectedTicket.hourlyRate || 95,
      billable: selectedTicket.billable
    };

    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: newTsStaff,
      type: 'activity',
      content: `Zeiterfassung erfasst: ${hours} Std. für "${newTsDesc}"`,
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      timesheets: [...selectedTicket.timesheets, entry],
      activities: [newActivity, ...selectedTicket.activities]
    });

    setNewTsDesc('');
    setIsAddingTimesheet(false);
  };

  // Delete Timesheet
  const handleDeleteTimesheet = (tsId: string) => {
    if (!selectedTicket) return;
    sounds.playClick();
    updateCurrentTicket({
      timesheets: selectedTicket.timesheets.filter(t => t.id !== tsId)
    });
  };

  // Add Chatter Note or Activity
  const handleAddChatter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !chatterInput.trim()) return;
    sounds.playClick();

    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: selectedTicket.assignedStaff || 'Mitarbeiter',
      type: chatterTab,
      content: chatterInput.trim(),
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      activities: [newActivity, ...selectedTicket.activities]
    });

    setChatterInput('');
  };

  // Tag helper
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim() && selectedTicket) {
      e.preventDefault();
      if (!selectedTicket.tags.includes(tagInput.trim())) {
        updateCurrentTicket({
          tags: [...selectedTicket.tags, tagInput.trim()]
        });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!selectedTicket) return;
    updateCurrentTicket({
      tags: selectedTicket.tags.filter(t => t !== tagToRemove)
    });
  };

  // Contact Selection Handler (Auto-fill phone, email, company)
  const handleSelectContact = (contactIdStr: string) => {
    if (!contactIdStr) {
      updateCurrentTicket({
        contact_id: undefined,
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        contact_company: ''
      });
      return;
    }

    const contact = contacts.find(c => c.id === parseInt(contactIdStr));
    if (contact) {
      updateCurrentTicket({
        contact_id: contact.id,
        contact_name: contact.name || '',
        contact_email: contact.email || '',
        contact_phone: contact.phone || '',
        contact_company: contact.company || ''
      });
    }
  };

  // Total Hours calculation
  const totalHours = useMemo(() => {
    if (!selectedTicket) return 0;
    return selectedTicket.timesheets.reduce((sum, ts) => sum + (Number(ts.hours) || 0), 0);
  }, [selectedTicket]);

  const totalCalculatedAmount = useMemo(() => {
    if (!selectedTicket) return 0;
    return selectedTicket.timesheets.reduce((sum, ts) => {
      const rate = ts.hourlyRate || selectedTicket.hourlyRate || 0;
      return sum + (Number(ts.hours) || 0) * rate;
    }, 0);
  }, [selectedTicket]);

  // Team Management Handlers
  const handleAddTeam = () => {
    if (!newTeamName.trim()) return;
    const trimmed = newTeamName.trim();
    if (!teams.includes(trimmed)) {
      sounds.playClick();
      const updated = [...teams, trimmed];
      saveTeams(updated);
      setNewTeamName('');
    }
  };

  const handleDeleteTeam = (teamToDelete: string) => {
    if (teams.length <= 1) {
      alert('Mindestens ein Support-Team muss erhalten bleiben.');
      return;
    }
    if (!confirm(`Möchten Sie das Team "${teamToDelete}" wirklich entfernen?`)) return;
    sounds.playClick();
    const updated = teams.filter(t => t !== teamToDelete);
    saveTeams(updated);
  };

  const handleSaveTeamEdit = (index: number) => {
    if (!editingTeamValue.trim()) return;
    const updated = [...teams];
    const oldName = updated[index];
    updated[index] = editingTeamValue.trim();
    saveTeams(updated);
    
    // Also update tickets with this team
    const updatedTickets = tickets.map(t => t.team === oldName ? { ...t, team: editingTeamValue.trim() } : t);
    saveTickets(updatedTickets);

    setEditingTeamIndex(null);
    setEditingTeamValue('');
  };

  // Format Helper
  const formatTimeAgo = (isoString: string) => {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Gerade eben';
      if (mins < 60) return `Vor ${mins} Min.`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `Vor ${hours} Std.`;
      return new Date(isoString).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none overflow-hidden font-sans">
      
      {/* Top Navbar */}
      <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">Kundendienst & Support</span>
              {viewMode === 'detail' && selectedTicket && (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-cyan-600 dark:text-cyan-400">
                    {selectedTicket.ticketNumber}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Tickets, Einsätze, Zeiterfassung & Aktivitäten nach SOCDOF-Standard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Teams Manager Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setIsTeamModalOpen(true);
            }}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition flex items-center gap-1.5"
            title="Teams verwalten"
          >
            <Users className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline">Teams</span>
          </button>

          {viewMode === 'detail' ? (
            <button
              onClick={() => {
                sounds.playClick();
                setViewMode('list');
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
            >
              <List className="w-3.5 h-3.5" />
              Zurück zur Liste
            </button>
          ) : (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
              <button
                onClick={() => {
                  sounds.playClick();
                  setViewMode('list');
                }}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Listenansicht"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  setViewMode('kanban');
                }}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                  viewMode === 'kanban' 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Kanban-Board"
              >
                <Kanban className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleCreateNewTicket}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-medium shadow-xs hover:shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Ticket</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode !== 'detail' ? (
        <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-4">
          
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tickets, Kunden, Mitarbeiter, Tags suchen..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                <option value="all">Alle Teams</option>
                {teams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                <option value="all">Alle Status</option>
                <option value="new">Neu</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="waiting">In Warteschlange</option>
                <option value="resolved">Gelöst</option>
                <option value="closed">Abgeschlossen</option>
                <option value="invoiced">Abgerechnet</option>
              </select>
            </div>
          </div>

          {/* Empty State when no tickets exist */}
          {tickets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto mt-8 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
                <Headphones className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Noch keine Support-Tickets vorhanden
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                Erfassen Sie Kundenanfragen, Störungsbehebungen und Dienstleistungseinsätze inklusive Zeiterfassung und Aktivitätenprotokoll.
              </p>
              <button
                onClick={handleCreateNewTicket}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Erstes Ticket anlegen</span>
              </button>
            </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Ticket</th>
                      <th className="py-3 px-4">Titel & Betreff</th>
                      <th className="py-3 px-4">Kunde</th>
                      <th className="py-3 px-4">Team & Bearbeiter</th>
                      <th className="py-3 px-4">Priorität</th>
                      <th className="py-3 px-4">Zeitaufwand</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Headphones className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                          Keine Support-Tickets für die aktuellen Filter gefunden.
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map(ticket => {
                        const totalSpent = ticket.timesheets.reduce((s, ts) => s + (Number(ts.hours) || 0), 0);
                        return (
                          <tr 
                            key={ticket.id} 
                            onClick={() => {
                              sounds.playClick();
                              setSelectedTicketId(ticket.id);
                              setViewMode('detail');
                            }}
                            className="hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20 cursor-pointer transition"
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                              {ticket.ticketNumber}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{ticket.title}</div>
                              <div className="flex items-center gap-1.5 mt-1">
                                {ticket.tags.map(t => (
                                  <span key={t} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-slate-800 dark:text-slate-200">
                                {ticket.contact_name || '–'}
                              </div>
                              {ticket.contact_company && (
                                <div className="text-[11px] text-slate-400">{ticket.contact_company}</div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="text-slate-700 dark:text-slate-300 font-medium">{ticket.team}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {ticket.assignedStaff}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center text-amber-400">
                                {[1, 2, 3].map(star => (
                                  <Star 
                                    key={star} 
                                    className={`w-3.5 h-3.5 ${star <= ticket.priority ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} 
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{totalSpent.toFixed(1)} Std.</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                ticket.status === 'new' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800' :
                                ticket.status === 'in_progress' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                                ticket.status === 'waiting' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800' :
                                ticket.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                                ticket.status === 'closed' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                                'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400'
                              }`}>
                                {ticket.status === 'new' && 'Neu'}
                                {ticket.status === 'in_progress' && 'In Bearbeitung'}
                                {ticket.status === 'waiting' && 'In Warteschlange'}
                                {ticket.status === 'resolved' && 'Gelöst'}
                                {ticket.status === 'closed' && 'Abgeschlossen'}
                                {ticket.status === 'invoiced' && 'Abgerechnet'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <ArrowUpRight className="w-4 h-4 text-slate-400 hover:text-cyan-600 inline" />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Kanban View */
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-6 items-start">
              {[
                { key: 'new', label: 'Neu', color: 'border-t-blue-500' },
                { key: 'in_progress', label: 'In Bearbeitung', color: 'border-t-amber-500' },
                { key: 'waiting', label: 'In Warteschlange', color: 'border-t-purple-500' },
                { key: 'resolved', label: 'Gelöst / Abgeschlossen', color: 'border-t-emerald-500' }
              ].map(column => {
                const columnTickets = filteredTickets.filter(t => {
                  if (column.key === 'resolved') {
                    return t.status === 'resolved' || t.status === 'closed' || t.status === 'invoiced';
                  }
                  return t.status === column.key;
                });

                return (
                  <div key={column.key} className={`bg-slate-100/70 dark:bg-slate-900/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 border-t-4 ${column.color} flex flex-col gap-2.5 min-h-[350px]`}>
                    <div className="flex items-center justify-between font-semibold text-xs text-slate-700 dark:text-slate-300 px-1">
                      <span>{column.label}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-mono">
                        {columnTickets.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 flex-1">
                      {columnTickets.map(ticket => (
                        <div
                          key={ticket.id}
                          onClick={() => {
                            sounds.playClick();
                            setSelectedTicketId(ticket.id);
                            setViewMode('detail');
                          }}
                          className="bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-cyan-500 dark:hover:border-cyan-400 cursor-pointer transition flex flex-col gap-2 group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">
                              {ticket.ticketNumber}
                            </span>
                            <div className="flex items-center text-amber-400">
                              {[1, 2, 3].map(star => (
                                <Star 
                                  key={star} 
                                  className={`w-3 h-3 ${star <= ticket.priority ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} 
                                />
                              ))}
                            </div>
                          </div>

                          <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 line-clamp-2">
                            {ticket.title}
                          </h4>

                          <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                            <span className="truncate max-w-[140px] font-medium text-slate-700 dark:text-slate-300">
                              {ticket.contact_name || '–'}
                            </span>
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                              {ticket.timesheets.reduce((s, ts) => s + (Number(ts.hours) || 0), 0).toFixed(1)} h
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : selectedTicket ? (
        /* DETAIL VIEW: Modern Support / CRM Form with 2-Column Split (Form & Internal Logbook) */
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Column: Ticket Main Form */}
          <div className="flex-1 flex flex-col overflow-y-auto bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800">
            
            {/* Top Action & Status Pipeline Ribbon */}
            <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40 shrink-0">
              
              {/* Left Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleTimer}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition ${
                    selectedTicket.isTimerRunning
                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {selectedTicket.isTimerRunning ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stoppen</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start (Live-Timer)</span>
                    </>
                  )}
                </button>

                {onCreateInvoiceForService && (
                  <button
                    onClick={() => {
                      sounds.playClick();
                      onCreateInvoiceForService(selectedTicket);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
                  >
                    <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                    <span>In Rechnung stellen</span>
                  </button>
                )}

                <button
                  onClick={() => handleDeleteTicket(selectedTicket.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                  title="Ticket löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Right Status Workflow Ribbon (Phasen-Schritte) */}
              <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 rounded-xl p-1 text-xs font-medium border border-slate-300/60 dark:border-slate-700">
                {[
                  { key: 'new', label: 'Neu' },
                  { key: 'in_progress', label: 'In Bearbeitung' },
                  { key: 'waiting', label: 'In Warteschlange' },
                  { key: 'resolved', label: 'Gelöst' },
                  { key: 'closed', label: 'Abgeschlossen' }
                ].map((phase) => (
                  <button
                    key={phase.key}
                    onClick={() => handleStatusChange(phase.key as any)}
                    className={`px-3 py-1 rounded-lg transition text-[11px] ${
                      selectedTicket.status === phase.key
                        ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {phase.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Form Fields */}
            <div className="p-6 space-y-6 flex-1">
              
              {/* Ticket Title Input */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Betreff / Auftragstitel
                </label>
                <input
                  type="text"
                  value={selectedTicket.title}
                  onChange={(e) => updateCurrentTicket({ title: e.target.value })}
                  placeholder="z. B. Störung Drucker oder Wartung Telefonanlage..."
                  className="w-full text-lg sm:text-xl font-bold bg-transparent border-b-2 border-slate-200 hover:border-slate-300 focus:border-cyan-500 dark:border-slate-700 dark:hover:border-slate-600 focus:outline-hidden py-1 text-slate-900 dark:text-slate-100 transition"
                />
              </div>

              {/* Metadata 2-Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs">
                
                {/* Left Column Metas */}
                <div className="space-y-3.5">
                  <div className="flex items-center">
                    <span className="w-32 text-slate-500 dark:text-slate-400 font-medium">Kundendienstteam</span>
                    <div className="flex-1 flex items-center gap-1.5">
                      <select
                        value={selectedTicket.team}
                        onChange={(e) => updateCurrentTicket({ team: e.target.value })}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      >
                        {teams.map(team => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsTeamModalOpen(true)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                        title="Teams verwalten / hinzufügen"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <span className="w-32 text-slate-500 dark:text-slate-400 font-medium">Zugewiesen an</span>
                    <select
                      value={selectedTicket.assignedStaff}
                      onChange={(e) => updateCurrentTicket({ assignedStaff: e.target.value })}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    >
                      {STAFF_LIST.map(staff => (
                        <option key={staff} value={staff}>{staff}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center">
                    <span className="w-32 text-slate-500 dark:text-slate-400 font-medium">Priorität</span>
                    <div className="flex items-center gap-1 text-amber-400">
                      {[1, 2, 3].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            updateCurrentTicket({ priority: (selectedTicket.priority === star ? 0 : star) as any });
                          }}
                          className="p-1 hover:scale-125 transition"
                          title={`${star} Stern(e)`}
                        >
                          <Star 
                            className={`w-4 h-4 ${star <= selectedTicket.priority ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start">
                    <span className="w-32 text-slate-500 dark:text-slate-400 font-medium pt-1.5">Stichwörter / Tags</span>
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {selectedTicket.tags.map(tag => (
                          <span 
                            key={tag} 
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 text-[11px] font-medium border border-cyan-200 dark:border-cyan-800"
                          >
                            #{tag}
                            <button 
                              onClick={() => handleRemoveTag(tag)}
                              className="hover:text-rose-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                        placeholder="Tag eingeben & Enter drücken..."
                        className="w-full px-2.5 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column Metas (Customer Contact Info Autofilled) */}
                <div className="space-y-3.5">
                  <div className="flex items-center">
                    <span className="w-24 text-slate-500 dark:text-slate-400 font-medium">Kunde (CRM)</span>
                    <select
                      value={selectedTicket.contact_id || ''}
                      onChange={(e) => handleSelectContact(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    >
                      <option value="">-- Kunden auswählen --</option>
                      {contacts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center">
                    <span className="w-24 text-slate-500 dark:text-slate-400 font-medium">E-Mail</span>
                    <input
                      type="email"
                      value={selectedTicket.contact_email || ''}
                      onChange={(e) => updateCurrentTicket({ contact_email: e.target.value })}
                      placeholder="wird automatisch vom Kontakt übernommen"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="flex items-center">
                    <span className="w-24 text-slate-500 dark:text-slate-400 font-medium">Telefon</span>
                    <input
                      type="tel"
                      value={selectedTicket.contact_phone || ''}
                      onChange={(e) => updateCurrentTicket({ contact_phone: e.target.value })}
                      placeholder="wird automatisch vom Kontakt übernommen"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="flex items-center">
                    <span className="w-24 text-slate-500 dark:text-slate-400 font-medium">Stundensatz</span>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        value={selectedTicket.hourlyRate || 95}
                        onChange={(e) => updateCurrentTicket({ hourlyRate: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                      />
                      <span className="text-slate-500">€ / Std.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Tabbed Section: Beschreibung & Zeiterfassung */}
              <div className="pt-4">
                <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setActiveTab('description');
                    }}
                    className={`pb-1.5 text-xs font-semibold border-b-2 transition ${
                      activeTab === 'description'
                        ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Beschreibung & Problemstellung
                  </button>

                  <button
                    onClick={() => {
                      sounds.playClick();
                      setActiveTab('timesheets');
                    }}
                    className={`pb-1.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition ${
                      activeTab === 'timesheets'
                        ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>Zeiterfassung (Arbeitszeiten)</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-mono">
                      {totalHours.toFixed(1)} h
                    </span>
                  </button>
                </div>

                {/* Tab 1: Beschreibung */}
                {activeTab === 'description' && (
                  <div>
                    <textarea
                      rows={6}
                      value={selectedTicket.description}
                      onChange={(e) => updateCurrentTicket({ description: e.target.value })}
                      placeholder="Genaue Beschreibung des Problems, durchzuführende Arbeiten oder Kundennotizen..."
                      className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden leading-relaxed"
                    />
                  </div>
                )}

                {/* Tab 2: Zeiterfassung (Timesheets Table) */}
                {activeTab === 'timesheets' && (
                  <div className="space-y-4">
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Datum</th>
                            <th className="py-2.5 px-3">Mitarbeiter</th>
                            <th className="py-2.5 px-3">Geleistete Arbeit / Tätigkeit</th>
                            <th className="py-2.5 px-3 text-right">Dauer (Std.)</th>
                            <th className="py-2.5 px-3 text-right">Aktion</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedTicket.timesheets.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-400">
                                Bisher noch keine Arbeitszeiten für dieses Ticket erfasst.
                              </td>
                            </tr>
                          ) : (
                            selectedTicket.timesheets.map(ts => (
                              <tr key={ts.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="py-2.5 px-3 font-mono">{ts.date}</td>
                                <td className="py-2.5 px-3 font-medium">{ts.staff}</td>
                                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{ts.description}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                                  {Number(ts.hours).toFixed(2)} h
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() => handleDeleteTimesheet(ts.id)}
                                    className="p-1 hover:text-rose-600 text-slate-400"
                                    title="Zeile löschen"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot className="bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 font-semibold">
                          <tr>
                            <td colSpan={3} className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                              Gesamte Arbeitszeit:
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-sm text-cyan-600 dark:text-cyan-400 font-bold">
                              {totalHours.toFixed(2)} h
                            </td>
                            <td className="py-2.5 px-3"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Add Timesheet Row */}
                    {!isAddingTimesheet ? (
                      <button
                        onClick={() => setIsAddingTimesheet(true)}
                        className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Arbeitszeit manuell erfassen
                      </button>
                    ) : (
                      <form onSubmit={handleAddTimesheetEntry} className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                          Arbeitszeit hinzufügen
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                          <input
                            type="date"
                            value={newTsDate}
                            onChange={(e) => setNewTsDate(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                          <select
                            value={newTsStaff}
                            onChange={(e) => setNewTsStaff(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          >
                            {STAFF_LIST.map(staff => (
                              <option key={staff} value={staff}>{staff}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={newTsDesc}
                            onChange={(e) => setNewTsDesc(e.target.value)}
                            placeholder="Geleistete Arbeit / Tätigkeit beschreiben..."
                            required
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 sm:col-span-2"
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500">Dauer (in Stunden):</span>
                            <input
                              type="number"
                              step="0.25"
                              min="0.1"
                              value={newTsHours}
                              onChange={(e) => setNewTsHours(e.target.value)}
                              className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                            />
                            {/* Preset Buttons */}
                            <div className="hidden sm:flex items-center gap-1">
                              {[0.5, 1.0, 1.5, 2.0].map(h => (
                                <button
                                  key={h}
                                  type="button"
                                  onClick={() => setNewTsHours(h.toString())}
                                  className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                                >
                                  {h} h
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsAddingTimesheet(false)}
                              className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
                            >
                              Abbrechen
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 text-xs rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700"
                            >
                              Speichern
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: SOCDOF Internal Logbook & Activity Chatter */}
          <div className="w-full lg:w-[380px] xl:w-[420px] bg-slate-50 dark:bg-slate-950 flex flex-col border-t lg:border-t-0 border-slate-200/80 dark:border-slate-800">
            
            {/* Chatter Action Tabs */}
            <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5">
              <button
                onClick={() => {
                  sounds.playClick();
                  setChatterTab('note');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  chatterTab === 'note'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Interne Notiz
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  setChatterTab('activity');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  chatterTab === 'activity'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Aktivität & Protokoll
              </button>
            </div>

            {/* Chatter Input Box */}
            <div className="p-3.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800">
              <form onSubmit={handleAddChatter} className="space-y-2">
                <textarea
                  rows={3}
                  value={chatterInput}
                  onChange={(e) => setChatterInput(e.target.value)}
                  placeholder={
                    chatterTab === 'note' 
                      ? 'Interne Notiz für Mitarbeiter hinterlassen (z. B. Absprache, Übergabe)...' 
                      : 'Aktivität dokumentieren (z. B. Telefonat mit Kunden, Vor-Ort Diagnose)...'
                  }
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!chatterInput.trim()}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <Send className="w-3 h-3" />
                    <span>Eintrag speichern</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Chatter Feed / Timeline */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="text-[11px] font-semibold text-slate-400 text-center uppercase tracking-wider">
                Verlauf & Aktivitäten
              </div>

              {selectedTicket.activities.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-8">
                  Noch keine Aktivitäten vorhanden.
                </div>
              ) : (
                selectedTicket.activities.map((act) => (
                  <div key={act.id} className="flex gap-3 items-start text-xs">
                    {/* Avatar Badge */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 text-white ${
                      act.type === 'note' ? 'bg-amber-600' :
                      act.type === 'activity' ? 'bg-cyan-600' :
                      'bg-slate-600'
                    }`}>
                      {act.author ? act.author[0].toUpperCase() : 'S'}
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{act.author}</span>
                        <span className="text-slate-400">{formatTimeAgo(act.createdAt)}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {act.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Teams Management Modal */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Kundendienst-Teams verwalten
                </h3>
              </div>
              <button
                onClick={() => {
                  sounds.playClick();
                  setIsTeamModalOpen(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add Team Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
                placeholder="Neues Team (z. B. Vor-Ort Service)..."
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={handleAddTeam}
                disabled={!newTeamName.trim()}
                className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Hinzufügen</span>
              </button>
            </div>

            {/* Existing Teams List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {teams.map((team, idx) => (
                <div
                  key={team}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs"
                >
                  {editingTeamIndex === idx ? (
                    <div className="flex-1 flex items-center gap-2 mr-2">
                      <input
                        type="text"
                        value={editingTeamValue}
                        onChange={(e) => setEditingTeamValue(e.target.value)}
                        className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 text-xs"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveTeamEdit(idx)}
                        className="p-1 text-emerald-600 hover:text-emerald-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingTeamIndex(null)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-medium text-slate-800 dark:text-slate-200">{team}</span>
                  )}

                  {editingTeamIndex !== idx && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => {
                          setEditingTeamIndex(idx);
                          setEditingTeamValue(team);
                        }}
                        className="p-1 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Umbenennen"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team)}
                        className="p-1 hover:text-rose-600"
                        title="Team löschen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  sounds.playClick();
                  setIsTeamModalOpen(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
