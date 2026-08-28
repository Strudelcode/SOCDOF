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
  FolderPlus,
  RotateCcw,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  PenTool,
  Type
} from 'lucide-react';
import { Contact, CompanyProfile, SupportServiceTicket, SupportTimesheetEntry, SupportActivityEntry } from '../types';
import { sounds } from '../lib/sound';
import { useLanguage, t } from '../lib/i18n';
import { MobileCompanionImportModal } from './MobileCompanionImportModal';
import { Smartphone, QrCode } from 'lucide-react';

interface SupportServicesModuleProps {
  contacts: Contact[];
  companyProfile: CompanyProfile;
  onCreateInvoiceForService?: (ticket: SupportServiceTicket) => void;
}

interface SupportSettings {
  ticketPrefix: string;
  nextNumber: number;
  defaultHourlyRate: number;
  defaultTeam: string;
  defaultStaff: string;
}

const STORAGE_KEY = 'socdof_support_services_tickets_v2';
const TEAMS_STORAGE_KEY = 'socdof_support_teams_list_v2';
const STAFF_STORAGE_KEY = 'socdof_support_staff_list_v2';
const SETTINGS_STORAGE_KEY = 'socdof_support_settings_v3';

const DEFAULT_TEAMS = [
  'Standard'
];

const DEFAULT_STAFF = [
  'Support Agent',
  'Staff Member',
  'Admin'
];

const DEFAULT_SETTINGS: SupportSettings = {
  ticketPrefix: 'SUP-',
  nextNumber: 1001,
  defaultHourlyRate: 95,
  defaultTeam: 'Standard',
  defaultStaff: 'Support Agent'
};

export const SupportServicesModule: React.FC<SupportServicesModuleProps> = ({
  contacts,
  companyProfile,
  onCreateInvoiceForService
}) => {
  // Subscribe to active language state for real-time reactivity
  const lang = useLanguage();

  // Support Settings (e.g. ticket prefix, default rate)
  const [settings, setSettings] = useState<SupportSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Sanitize out any personal friend names or legacy defaults
        if (parsed.defaultStaff?.toLowerCase().includes('robert') || parsed.defaultStaff?.toLowerCase().includes('hölzl')) {
          parsed.defaultStaff = 'Support Agent';
        }
        if (parsed.defaultTeam?.toLowerCase().includes('kundendienst & service')) {
          parsed.defaultTeam = 'Standard';
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SETTINGS;
  });

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general' | 'teams' | 'staff'>('general');
  const [tempSettings, setTempSettings] = useState<SupportSettings>(settings);

  // Support Teams state (customizable by user)
  const [teams, setTeams] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(TEAMS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_TEAMS;
  });

  // Staff / Agents state (customizable by user)
  const [staffList, setStaffList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STAFF_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sanitize out any personal friend names
          const sanitized = parsed.filter(
            s => typeof s === 'string' && !s.toLowerCase().includes('robert') && !s.toLowerCase().includes('hölzl')
          );
          if (sanitized.length > 0) return sanitized;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_STAFF;
  });

  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeamIndex, setEditingTeamIndex] = useState<number | null>(null);
  const [editingTeamValue, setEditingTeamValue] = useState('');

  const [newStaffName, setNewStaffName] = useState('');
  const [editingStaffIndex, setEditingStaffIndex] = useState<number | null>(null);
  const [editingStaffValue, setEditingStaffValue] = useState('');

  // Delete Confirmation Modal State
  const [ticketToDelete, setTicketToDelete] = useState<SupportServiceTicket | null>(null);

  // Tickets state - strictly clean state, sanitizing any legacy names
  const [tickets, setTickets] = useState<SupportServiceTicket[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Sanitize legacy entries
          return parsed.map((t: any) => ({
            ...t,
            assignedStaff: (t.assignedStaff?.toLowerCase().includes('robert') || t.assignedStaff?.toLowerCase().includes('hölzl')) 
              ? 'Support Agent' 
              : t.assignedStaff || 'Support Agent',
            activities: Array.isArray(t.activities) 
              ? t.activities.map((a: any) => ({
                  ...a,
                  author: (a.author?.toLowerCase().includes('robert') || a.author?.toLowerCase().includes('hölzl')) 
                    ? 'Support Agent' 
                    : a.author || 'Support Agent'
                }))
              : []
          }));
        }
      }
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
  const [isMobileSyncOpen, setIsMobileSyncOpen] = useState(false);

  // Detail / Edit Form state
  const [activeTab, setActiveTab] = useState<'description' | 'timesheets'>('description');
  const [chatterTab, setChatterTab] = useState<'note' | 'activity'>('note');
  const [chatterInput, setChatterInput] = useState('');
  
  // Custom Free-Text Assignee Mode
  const [isCustomAssigneeMode, setIsCustomAssigneeMode] = useState(false);

  // Quick Timesheet Row Form
  const [isAddingTimesheet, setIsAddingTimesheet] = useState(false);
  const [newTsDate, setNewTsDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTsStaff, setNewTsStaff] = useState(staffList[0] || 'Support Agent');
  const [newTsDesc, setNewTsDesc] = useState('');
  const [newTsHours, setNewTsHours] = useState('1.0');
  const [tagInput, setTagInput] = useState('');

  // Live Timer elapsed time tracker
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Status helper mapping
  const getStatusLabel = (st: SupportServiceTicket['status']) => {
    switch (st) {
      case 'new': return t('support.status_new', undefined, 'New');
      case 'in_progress': return t('support.status_in_progress', undefined, 'In Progress');
      case 'waiting': return t('support.status_waiting', undefined, 'Queued / Waiting');
      case 'resolved': return t('support.status_resolved', undefined, 'Resolved');
      case 'closed': return t('support.status_closed', undefined, 'Closed');
      default: return st;
    }
  };

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

  const saveStaffList = (updatedStaff: string[]) => {
    setStaffList(updatedStaff);
    try {
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(updatedStaff));
    } catch (e) {
      console.error(e);
    }
  };

  const saveSettings = (newSet: SupportSettings) => {
    setSettings(newSet);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSet));
    } catch (e) {
      console.error(e);
    }
  };

  const selectedTicket = useMemo(() => {
    return tickets.find(t => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  // Live Timer Interval
  useEffect(() => {
    let interval: any = null;
    if (selectedTicket?.isTimerRunning && selectedTicket.timerStartedAt) {
      const startMs = new Date(selectedTicket.timerStartedAt).getTime();
      setTimerSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      interval = setInterval(() => {
        setTimerSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedTicket?.isTimerRunning, selectedTicket?.timerStartedAt]);

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

  // Create new Ticket using configured Prefix & Sequence
  const handleCreateNewTicket = () => {
    sounds.playClick();
    const newId = `sup_${Date.now()}`;
    const prefix = settings.ticketPrefix || 'SUP-';
    const num = (settings.nextNumber || 1001) + tickets.length;
    const newTicketNumber = `${prefix}${num}`;
    
    // Auto-select first contact if available
    const initialContact = contacts.length > 0 ? contacts[0] : null;

    const newTicket: SupportServiceTicket = {
      id: newId,
      ticketNumber: newTicketNumber,
      title: `${t('support.new_ticket', undefined, 'New Ticket')} #${newTicketNumber}`,
      team: settings.defaultTeam || teams[0] || 'Standard',
      assignedStaff: settings.defaultStaff || staffList[0] || 'Support Agent',
      priority: 1,
      tags: ['Support'],
      contact_id: initialContact?.id,
      contact_name: initialContact?.name || '',
      contact_email: initialContact?.email || '',
      contact_phone: initialContact?.phone || '',
      contact_company: initialContact?.company || '',
      status: 'new',
      description: '',
      hourlyRate: settings.defaultHourlyRate || 95,
      billable: true,
      timesheets: [],
      activities: [
        {
          id: `act_${Date.now()}`,
          author: settings.defaultStaff || staffList[0] || 'Support Agent',
          type: 'system',
          content: t('support.act_created', undefined, 'Ticket created.'),
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

  // Update selected ticket in place
  const updateCurrentTicket = (patch: Partial<SupportServiceTicket>) => {
    if (!selectedTicketId) return;
    const updated = tickets.map(t => {
      if (t.id === selectedTicketId) {
        return { ...t, ...patch };
      }
      return t;
    });
    saveTickets(updated);
  };

  // Delete ticket with verification
  const confirmDeleteTicket = () => {
    if (!ticketToDelete) return;
    sounds.playClick();
    const updated = tickets.filter(t => t.id !== ticketToDelete.id);
    saveTickets(updated);
    if (selectedTicketId === ticketToDelete.id) {
      setSelectedTicketId(null);
      setViewMode('list');
    }
    setTicketToDelete(null);
  };

  // Status Change helper with activity logging
  const handleStatusChange = (newStatus: SupportServiceTicket['status']) => {
    if (!selectedTicket) return;
    sounds.playClick();

    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: selectedTicket.assignedStaff || 'Support Agent',
      type: 'system',
      content: `${t('support.act_status_changed', undefined, 'Status changed to')} "${getStatusLabel(newStatus)}".`,
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
      // Stop timer and automatically create a timesheet entry
      const startedAt = selectedTicket.timerStartedAt ? new Date(selectedTicket.timerStartedAt) : new Date();
      const endedAt = new Date();
      const durationHours = Math.max(0.1, Number(((endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60)).toFixed(2)));
      
      const newEntry: SupportTimesheetEntry = {
        id: `ts_${Date.now()}`,
        ticket_id: selectedTicket.id,
        staff: selectedTicket.assignedStaff || 'Support Agent',
        description: t('support.timesheet_live_timer_title', undefined, '1-Click Live-Timer (Work Time)'),
        hours: durationHours,
        hourlyRate: selectedTicket.hourlyRate || 95,
        billable: selectedTicket.billable,
        date: new Date().toISOString().split('T')[0],
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString()
      };

      const newActivity: SupportActivityEntry = {
        id: `act_${Date.now()}`,
        author: selectedTicket.assignedStaff || 'Support Agent',
        type: 'activity',
        content: `${t('support.act_timer_stopped', undefined, 'Live-Timer stopped:')} ${durationHours} h.`,
        createdAt: new Date().toISOString()
      };

      updateCurrentTicket({
        isTimerRunning: false,
        timerStartedAt: undefined,
        timesheets: [newEntry, ...selectedTicket.timesheets],
        activities: [newActivity, ...selectedTicket.activities]
      });
      sounds.playSuccess();
    } else {
      // Start timer
      const newActivity: SupportActivityEntry = {
        id: `act_${Date.now()}`,
        author: selectedTicket.assignedStaff || 'Support Agent',
        type: 'system',
        content: t('support.act_timer_started', undefined, 'Live-Timer started.'),
        createdAt: new Date().toISOString()
      };

      updateCurrentTicket({
        isTimerRunning: true,
        timerStartedAt: new Date().toISOString(),
        status: selectedTicket.status === 'new' ? 'in_progress' : selectedTicket.status,
        activities: [newActivity, ...selectedTicket.activities]
      });
    }
  };

  // Add Manual Timesheet Entry
  const handleAddTimesheetEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    sounds.playClick();

    const hours = parseFloat(newTsHours) || 1.0;
    const newEntry: SupportTimesheetEntry = {
      id: `ts_${Date.now()}`,
      ticket_id: selectedTicket.id,
      staff: newTsStaff || selectedTicket.assignedStaff || 'Support Agent',
      description: newTsDesc.trim() || t('support.tab_timesheets', undefined, 'Work Hours'),
      hours: hours,
      hourlyRate: selectedTicket.hourlyRate || 95,
      billable: selectedTicket.billable,
      date: newTsDate || new Date().toISOString().split('T')[0]
    };

    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: newTsStaff || selectedTicket.assignedStaff || 'Support Agent',
      type: 'activity',
      content: `${t('support.act_time_booked', undefined, 'Work time recorded:')} ${hours.toFixed(2)} h (${newTsDesc.trim()}).`,
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      timesheets: [newEntry, ...selectedTicket.timesheets],
      activities: [newActivity, ...selectedTicket.activities]
    });

    setNewTsDesc('');
    setNewTsHours('1.0');
    setIsAddingTimesheet(false);
    sounds.playSuccess();
  };

  // Delete Timesheet Entry
  const handleDeleteTimesheet = (timesheetId: string) => {
    if (!selectedTicket) return;
    sounds.playClick();
    const updated = selectedTicket.timesheets.filter(ts => ts.id !== timesheetId);
    updateCurrentTicket({ timesheets: updated });
  };

  // Post Note or Activity to Chatter
  const handleAddChatter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !chatterInput.trim()) return;
    sounds.playClick();

    const newEntry: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: selectedTicket.assignedStaff || 'Support Agent',
      type: chatterTab,
      content: chatterInput.trim(),
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      activities: [newEntry, ...selectedTicket.activities]
    });

    setChatterInput('');
    sounds.playSuccess();
  };

  // Add Tag
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim() && selectedTicket) {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (!selectedTicket.tags.includes(val)) {
        sounds.playClick();
        updateCurrentTicket({ tags: [...selectedTicket.tags, val] });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!selectedTicket) return;
    sounds.playClick();
    updateCurrentTicket({ tags: selectedTicket.tags.filter(t => t !== tagToRemove) });
  };

  // Select Contact from CRM & Autofill
  const handleSelectContact = (contactId: string) => {
    if (!selectedTicket) return;
    sounds.playClick();
    const found = contacts.find(c => c.id === contactId);
    if (found) {
      updateCurrentTicket({
        contact_id: found.id,
        contact_name: found.name || '',
        contact_email: found.email || '',
        contact_phone: found.phone || '',
        contact_company: found.company || ''
      });
    } else {
      updateCurrentTicket({
        contact_id: undefined,
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        contact_company: ''
      });
    }
  };

  // Total recorded hours for selected ticket
  const totalHours = useMemo(() => {
    if (!selectedTicket) return 0;
    return selectedTicket.timesheets.reduce((sum, ts) => sum + (Number(ts.hours) || 0), 0);
  }, [selectedTicket]);

  const formatTimerDisplay = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
      if (diff < 60) return t('support.time_just_now', undefined, 'Just now');
      if (diff < 3600) return `${Math.floor(diff / 60)} ${t('support.time_mins_ago', undefined, 'min.')}`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('support.time_hours_ago', undefined, 'hours')}`;
      return new Date(isoString).toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none overflow-hidden">
      
      {/* Top Application Ribbon / Header */}
      <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {t('support.title', undefined, 'Customer Support & Service')}
              </h2>
              {selectedTicket && viewMode === 'detail' && (
                <span className="px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-mono text-xs font-bold border border-cyan-200 dark:border-cyan-800">
                  {selectedTicket.ticketNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              {t('support.subtitle', undefined, 'Tickets, assignments, timesheets & activities (SOCDOF standard)')}
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mobile Companion QR-Import Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setIsMobileSyncOpen(true);
            }}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-600/10 via-blue-600/10 to-indigo-600/10 hover:from-cyan-600/20 hover:to-blue-600/20 text-cyan-700 dark:text-cyan-300 transition flex items-center gap-1.5 shadow-2xs"
            title={t('support.mobile_sync_tooltip', undefined, 'Daten von der mobilen App (TimeTracking / Außendienst) per QR-Code oder JSON importieren')}
          >
            <Smartphone className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{t('support.mobile_sync_btn', undefined, 'Mobile App Sync')}</span>
          </button>

          {/* Support Settings Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setTempSettings(settings);
              setIsSettingsModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-2xs"
            title={t('support.settings_tooltip', undefined, 'Configure support settings, teams, staff and prefix')}
          >
            <Settings className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline">{t('support.settings_btn', undefined, 'Settings')}</span>
          </button>

          {/* View Toggle / Back Button */}
          {viewMode === 'detail' ? (
            <button
              onClick={() => {
                sounds.playClick();
                setViewMode('list');
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-2xs"
            >
              <List className="w-4 h-4" />
              <span>{t('support.back_to_list', undefined, 'Back to list')}</span>
            </button>
          ) : (
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 rounded-xl p-1 border border-slate-300/60 dark:border-slate-700">
              <button
                onClick={() => {
                  sounds.playClick();
                  setViewMode('list');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t('support.view_list', undefined, 'List')}</span>
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  setViewMode('kanban');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  viewMode === 'kanban' 
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t('support.view_kanban', undefined, 'Kanban')}</span>
              </button>
            </div>
          )}

          {/* New Ticket Primary Button */}
          <button
            onClick={handleCreateNewTicket}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('support.new_ticket', undefined, 'New Ticket')}</span>
          </button>
        </div>

      </div>

      {/* Main Module Content */}
      {viewMode === 'list' || viewMode === 'kanban' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* Filter Ribbon & Search Bar */}
          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            
            <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('support.search_placeholder', undefined, 'Search tickets (title, no., customer, tags)...')}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Team Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <select
                  value={selectedTeamFilter}
                  onChange={(e) => setSelectedTeamFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium"
                >
                  <option value="all">{t('support.filter_all_teams', undefined, 'All Teams')} ({teams.length})</option>
                  {teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium"
              >
                <option value="all">{t('support.filter_all_statuses', undefined, 'All Statuses')} ({tickets.length})</option>
                <option value="new">{getStatusLabel('new')}</option>
                <option value="in_progress">{getStatusLabel('in_progress')}</option>
                <option value="waiting">{getStatusLabel('waiting')}</option>
                <option value="resolved">{getStatusLabel('resolved')}</option>
                <option value="closed">{getStatusLabel('closed')}</option>
              </select>
            </div>

          </div>

          {/* LIST VIEW TABLE */}
          {viewMode === 'list' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-slate-200/80 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3 border border-slate-300/40 dark:border-slate-700/60">
                    <Headphones className="w-8 h-8 opacity-60" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {tickets.length === 0 ? t('support.empty_title_no_tickets', undefined, 'No support tickets created yet') : t('support.empty_title_not_found', undefined, 'No matching tickets found')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
                    {tickets.length === 0 
                      ? t('support.empty_desc_no_tickets', undefined, 'Create your first support ticket for interventions, maintenance or IT support.') 
                      : t('support.empty_desc_not_found', undefined, 'Try a different search term or adjust the filters.')}
                  </p>
                  {tickets.length === 0 && (
                    <button
                      onClick={handleCreateNewTicket}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 flex items-center gap-1.5 transition active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('support.btn_create_first', undefined, 'Create First Ticket')}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-3 px-4">{t('support.th_ticket_title', undefined, 'Ticket No. & Title')}</th>
                        <th className="py-3 px-4">{t('support.th_team', undefined, 'Team')}</th>
                        <th className="py-3 px-4">{t('support.th_customer', undefined, 'Customer (CRM)')}</th>
                        <th className="py-3 px-4">{t('support.th_assignee', undefined, 'Assignee')}</th>
                        <th className="py-3 px-4">{t('support.th_status', undefined, 'Status')}</th>
                        <th className="py-3 px-4 text-right">{t('support.th_timesheet', undefined, 'Timesheet')}</th>
                        <th className="py-3 px-4 text-right">{t('support.th_actions', undefined, 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTickets.map(ticket => {
                        const hours = ticket.timesheets.reduce((s, ts) => s + (Number(ts.hours) || 0), 0);
                        return (
                          <tr
                            key={ticket.id}
                            onClick={() => {
                              sounds.playClick();
                              setSelectedTicketId(ticket.id);
                              setViewMode('detail');
                            }}
                            className="hover:bg-cyan-50/40 dark:hover:bg-slate-800/60 cursor-pointer transition group"
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                                  {ticket.ticketNumber}
                                </span>
                                {ticket.priority > 1 && (
                                  <span className="flex items-center text-amber-500">
                                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                                  </span>
                                )}
                              </div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs mt-0.5 truncate max-w-xs">
                                {ticket.title}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                              {ticket.team}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                                {ticket.contact_name || <span className="text-slate-400 italic">{t('support.customer_none', undefined, '– No customer assigned –')}</span>}
                              </div>
                              {ticket.contact_company && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                  {ticket.contact_company}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>{ticket.assignedStaff || '–'}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                                ticket.status === 'new' ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300' :
                                ticket.status === 'in_progress' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' :
                                ticket.status === 'waiting' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' :
                                ticket.status === 'resolved' ? 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300' :
                                'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {getStatusLabel(ticket.status)}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {hours.toFixed(1)} h
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    sounds.playClick();
                                    setSelectedTicketId(ticket.id);
                                    setViewMode('detail');
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition"
                                  title="Edit Ticket"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setTicketToDelete(ticket)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                  title={t('support.btn_delete', undefined, 'Delete Ticket')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* KANBAN BOARD VIEW */}
          {viewMode === 'kanban' && (
            <div className="flex-1 overflow-x-auto p-4 sm:p-6 flex gap-4">
              {[
                { key: 'new', label: getStatusLabel('new'), color: 'sky' },
                { key: 'in_progress', label: getStatusLabel('in_progress'), color: 'amber' },
                { key: 'waiting', label: getStatusLabel('waiting'), color: 'purple' },
                { key: 'resolved', label: getStatusLabel('resolved'), color: 'teal' },
                { key: 'closed', label: getStatusLabel('closed'), color: 'emerald' }
              ].map(column => {
                const columnTickets = filteredTickets.filter(t => t.status === column.key);
                return (
                  <div 
                    key={column.key}
                    className="w-72 shrink-0 flex flex-col bg-slate-200/50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                  >
                    <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white/70 dark:bg-slate-900/80">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {column.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {columnTickets.length}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                      {columnTickets.map(ticket => (
                        <div
                          key={ticket.id}
                          onClick={() => {
                            sounds.playClick();
                            setSelectedTicketId(ticket.id);
                            setViewMode('detail');
                          }}
                          className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-cyan-500 cursor-pointer transition space-y-2 group"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                              {ticket.ticketNumber}
                            </span>
                            <span className="text-slate-400 font-medium">{ticket.team}</span>
                          </div>

                          <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 line-clamp-2">
                            {ticket.title}
                          </h4>

                          <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                            <span className="truncate max-w-[130px] font-medium text-slate-700 dark:text-slate-300">
                              {ticket.contact_name || '–'}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                {ticket.timesheets.reduce((s, ts) => s + (Number(ts.hours) || 0), 0).toFixed(1)} h
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTicketToDelete(ticket);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition"
                                title={t('support.btn_delete', undefined, 'Delete Ticket')}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
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
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          
          {/* Left Column: Ticket Main Form */}
          <div className="flex-1 flex flex-col overflow-y-auto bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 min-h-0">
            
            {/* Top Action Ribbon & Status Pipeline */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/60 shrink-0 sticky top-0 z-10 backdrop-blur-md">
              
              {/* Left Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* In Rechnung stellen */}
                {onCreateInvoiceForService && (
                  <button
                    onClick={() => {
                      sounds.playClick();
                      onCreateInvoiceForService(selectedTicket);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 transition shadow-2xs"
                    title={t('support.btn_invoice_tooltip', undefined, 'Create invoice from recorded times')}
                  >
                    <Receipt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t('support.btn_invoice', undefined, 'Create Invoice')}</span>
                  </button>
                )}

                {/* Ticket abschließen / Wiedereröffnen */}
                {selectedTicket.status !== 'closed' ? (
                  <button
                    onClick={() => handleStatusChange('closed')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 transition shadow-2xs"
                    title={t('support.btn_close', undefined, 'Close Ticket')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('support.btn_close', undefined, 'Close Ticket')}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleStatusChange('in_progress')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center gap-1.5 transition shadow-2xs"
                    title={t('support.btn_reopen', undefined, 'Reopen')}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{t('support.btn_reopen', undefined, 'Reopen')}</span>
                  </button>
                )}

                {/* Ticket löschen */}
                <button
                  onClick={() => setTicketToDelete(selectedTicket)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition border border-transparent hover:border-rose-200 dark:hover:border-rose-900"
                  title={t('support.btn_delete', undefined, 'Delete Ticket')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Right Status Workflow Pipeline */}
              <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 rounded-xl p-1 text-xs font-medium border border-slate-300/60 dark:border-slate-700 max-w-full overflow-x-auto no-scrollbar">
                {[
                  { key: 'new', label: getStatusLabel('new') },
                  { key: 'in_progress', label: getStatusLabel('in_progress') },
                  { key: 'waiting', label: getStatusLabel('waiting') },
                  { key: 'resolved', label: getStatusLabel('resolved') },
                  { key: 'closed', label: getStatusLabel('closed') }
                ].map((phase) => (
                  <button
                    key={phase.key}
                    onClick={() => handleStatusChange(phase.key as any)}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition text-[11px] whitespace-nowrap ${
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

            {/* Main Form Fields: Structured 2-Column Responsive Layout without squashing */}
            <div className="p-4 sm:p-6 space-y-6 flex-1">
              
              {/* Ticket Title Input */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  {t('support.label_title', undefined, 'Subject / Ticket Title')}
                </label>
                <input
                  type="text"
                  value={selectedTicket.title}
                  onChange={(e) => updateCurrentTicket({ title: e.target.value })}
                  placeholder={t('support.placeholder_title', undefined, 'e.g. Printer issue or network maintenance...')}
                  className="w-full text-lg sm:text-xl font-bold bg-transparent border-b-2 border-slate-200 hover:border-slate-300 focus:border-cyan-500 dark:border-slate-700 dark:hover:border-slate-600 focus:outline-hidden py-1 text-slate-900 dark:text-slate-100 transition"
                />
              </div>

              {/* 2-Column Form Fields (Labels above inputs to eliminate any overlap) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs">
                
                {/* Column 1: Assignment, Team & Priority */}
                <div className="space-y-4">
                  {/* Kundendienstteam */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        {t('support.label_team', undefined, 'Support Team')}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsActiveTab('teams');
                          setIsSettingsModalOpen(true);
                        }}
                        className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <Settings className="w-3 h-3" />
                        <span>{t('support.btn_manage_teams', undefined, 'Manage Teams')}</span>
                      </button>
                    </div>
                    <select
                      value={selectedTicket.team}
                      onChange={(e) => updateCurrentTicket({ team: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                    >
                      {teams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>

                  {/* Zugewiesen an (Dropdown or Custom Free-Text Input) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        {t('support.label_assignee', undefined, 'Assigned to')}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCustomAssigneeMode(!isCustomAssigneeMode)}
                          className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          {isCustomAssigneeMode ? (
                            <>
                              <List className="w-3 h-3" />
                              <span>{t('support.btn_switch_list', undefined, 'Choose from list')}</span>
                            </>
                          ) : (
                            <>
                              <PenTool className="w-3 h-3" />
                              <span>{t('support.btn_switch_freetext', undefined, 'Custom name')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {isCustomAssigneeMode ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={selectedTicket.assignedStaff}
                          onChange={(e) => updateCurrentTicket({ assignedStaff: e.target.value })}
                          placeholder={t('support.placeholder_custom_staff', undefined, 'Enter staff name (e.g. Alex Miller)...')}
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedTicket.assignedStaff.trim() && !staffList.includes(selectedTicket.assignedStaff.trim())) {
                              const updated = [...staffList, selectedTicket.assignedStaff.trim()];
                              saveStaffList(updated);
                              sounds.playSuccess();
                            }
                          }}
                          className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-[10px] font-bold"
                          title={t('support.btn_add_to_roster_tooltip', undefined, 'Save this name to permanent staff list')}
                        >
                          {t('support.btn_add_to_roster', undefined, '+ To list')}
                        </button>
                      </div>
                    ) : (
                      <select
                        value={selectedTicket.assignedStaff}
                        onChange={(e) => {
                          if (e.target.value === '__custom_mode__') {
                            setIsCustomAssigneeMode(true);
                          } else {
                            updateCurrentTicket({ assignedStaff: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                      >
                        {staffList.map(staff => (
                          <option key={staff} value={staff}>{staff}</option>
                        ))}
                        <option value="__custom_mode__">✏️ {t('support.btn_switch_freetext', undefined, 'Custom name (Free text)...')}</option>
                      </select>
                    )}
                  </div>

                  {/* Priorität */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.label_priority', undefined, 'Priority')}
                    </label>
                    <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
                      {[1, 2, 3].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            updateCurrentTicket({ priority: (selectedTicket.priority === star ? 0 : star) as any });
                          }}
                          className="p-1 hover:scale-115 transition"
                          title={`${star} Star(s)`}
                        >
                          <Star 
                            className={`w-4 h-4 ${star <= selectedTicket.priority ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} 
                          />
                        </button>
                      ))}
                      <span className="text-[10px] text-slate-400 pl-1 pr-2">
                        {selectedTicket.priority === 3 ? t('support.priority_urgent', undefined, 'Urgent / Express') : selectedTicket.priority === 2 ? t('support.priority_high', undefined, 'High') : selectedTicket.priority === 1 ? t('support.priority_standard', undefined, 'Normal') : '–'}
                      </span>
                    </div>
                  </div>

                  {/* Stichwörter / Tags */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.label_tags', undefined, 'Tags & Categories')}
                    </label>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
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
                        placeholder={t('support.placeholder_tag', undefined, 'Enter tag + Enter...')}
                        className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Column 2: Customer Contact Info & Billing Rate */}
                <div className="space-y-4">
                  {/* Kunde (CRM) */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.label_customer', undefined, 'Customer (CRM / Address Book)')}
                    </label>
                    <select
                      value={selectedTicket.contact_id || ''}
                      onChange={(e) => handleSelectContact(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">{t('support.customer_none', undefined, '– No customer assigned –')}</option>
                      {contacts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* E-Mail & Telefon in 2-Spalten */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        {t('support.customer_email', undefined, 'Email')}
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="email"
                          value={selectedTicket.contact_email || ''}
                          onChange={(e) => updateCurrentTicket({ contact_email: e.target.value })}
                          placeholder={t('support.customer_email', undefined, 'Email')}
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                        />
                        {selectedTicket.contact_email && (
                          <a
                            href={`mailto:${selectedTicket.contact_email}?subject=${encodeURIComponent(`[${selectedTicket.ticketNumber}] ${selectedTicket.title}`)}`}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition"
                            title="Open Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        {t('support.customer_phone', undefined, 'Phone')}
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="tel"
                          value={selectedTicket.contact_phone || ''}
                          onChange={(e) => updateCurrentTicket({ contact_phone: e.target.value })}
                          placeholder={t('support.customer_phone', undefined, 'Phone')}
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                        />
                        {selectedTicket.contact_phone && (
                          <a
                            href={`tel:${selectedTicket.contact_phone}`}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                            title="Call"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Firma */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.customer_company', undefined, 'Company / Organization')}
                    </label>
                    <input
                      type="text"
                      value={selectedTicket.contact_company || ''}
                      onChange={(e) => updateCurrentTicket({ contact_company: e.target.value })}
                      placeholder={t('support.customer_company', undefined, 'Company')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  {/* Stundensatz */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.label_hourly_rate', undefined, 'Hourly Rate (€ / hr)')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={selectedTicket.hourlyRate || 95}
                        onChange={(e) => updateCurrentTicket({ hourlyRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                      />
                      <span className="absolute right-3 top-2.5 text-slate-400 font-mono">€</span>
                    </div>
                  </div>

                </div>

              </div>

              {/* Lower Tabbed Section: Beschreibung & Zeiterfassung */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setActiveTab('description');
                    }}
                    className={`pb-1.5 text-xs font-bold border-b-2 transition ${
                      activeTab === 'description'
                        ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {t('support.tab_description', undefined, 'Description & Details')}
                  </button>

                  <button
                    onClick={() => {
                      sounds.playClick();
                      setActiveTab('timesheets');
                    }}
                    className={`pb-1.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
                      activeTab === 'timesheets'
                        ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>{t('support.tab_timesheets', undefined, 'Timesheets (Work Hours)')}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-mono font-bold">
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
                      placeholder={t('support.placeholder_description', undefined, 'Detailed issue description, customer requirements, serial numbers...')}
                      className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden leading-relaxed"
                    />
                  </div>
                )}

                {/* Tab 2: Zeiterfassung with Integrated Live-Timer */}
                {activeTab === 'timesheets' && (
                  <div className="space-y-4">
                    
                    {/* Integrated Live Timer Control Bar */}
                    <div className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      selectedTicket.isTimerRunning
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 shadow-md animate-pulse'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                          selectedTicket.isTimerRunning ? 'bg-rose-600' : 'bg-emerald-600'
                        }`}>
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {selectedTicket.isTimerRunning ? t('support.timer_running', undefined, 'Timer running...') : t('support.timesheet_live_timer_title', undefined, '1-Click Live-Timer (Work Time)')}
                            </span>
                            {selectedTicket.isTimerRunning && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-mono text-[10px] font-bold">
                                {formatTimerDisplay(timerSeconds)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {t('support.timesheet_live_timer_desc', undefined, 'Start the timer when working on the ticket. Stopping automatically records work time.')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleToggleTimer}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition active:scale-95 ${
                            selectedTicket.isTimerRunning
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {selectedTicket.isTimerRunning ? (
                            <>
                              <Square className="w-4 h-4 fill-current" />
                              <span>{t('support.btn_stop_timer', undefined, 'Stop timer & book time')} ({formatTimerDisplay(timerSeconds)})</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>{t('support.btn_start_timer', undefined, 'Start live timer')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Timesheets Table */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">{t('support.th_date', undefined, 'Date')}</th>
                            <th className="py-2.5 px-3">{t('support.th_staff', undefined, 'Staff')}</th>
                            <th className="py-2.5 px-3">{t('support.th_work_done', undefined, 'Work Done / Description')}</th>
                            <th className="py-2.5 px-3 text-right">{t('support.th_hours', undefined, 'Hours')}</th>
                            <th className="py-2.5 px-3 text-right">{t('support.th_actions', undefined, 'Action')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedTicket.timesheets.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-400">
                                {t('support.timesheet_empty', undefined, 'No work hours tracked yet. Use the live timer or add an entry manually.')}
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
                                    title="Delete Entry"
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
                              {t('support.timesheet_total_tracked', undefined, 'Total tracked time:')}
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
                        {t('support.btn_manual_entry', undefined, '+ Manual Time Entry')}
                      </button>
                    ) : (
                      <form onSubmit={handleAddTimesheetEntry} className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                          {t('support.timesheet_add_title', undefined, 'Add Manual Work Time')}
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
                            {staffList.map(staff => (
                              <option key={staff} value={staff}>{staff}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={newTsDesc}
                            onChange={(e) => setNewTsDesc(e.target.value)}
                            placeholder={t('support.timesheet_desc_placeholder', undefined, 'Work description...')}
                            required
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 sm:col-span-2"
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500">{t('support.timesheet_hours_label', undefined, 'Hours (e.g. 1.5):')}</span>
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
                              className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            >
                              {t('action.cancel', undefined, 'Cancel')}
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 text-xs rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700"
                            >
                              {t('support.timesheet_save_btn', undefined, 'Save Time')}
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
          <div className="w-full lg:w-[380px] xl:w-[420px] bg-slate-50 dark:bg-slate-950 flex flex-col border-t lg:border-t-0 border-slate-200/80 dark:border-slate-800 min-h-0">
            
            {/* Customer Quick Mail Action Bar */}
            {selectedTicket.contact_email && (
              <div className="p-2.5 bg-cyan-50/80 dark:bg-cyan-950/40 border-b border-cyan-100 dark:border-cyan-900/50 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-cyan-800 dark:text-cyan-200 truncate">
                  <Mail className="w-3.5 h-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                  <span className="truncate">{selectedTicket.contact_email}</span>
                </div>
                <a
                  href={`mailto:${selectedTicket.contact_email}?subject=${encodeURIComponent(`[${selectedTicket.ticketNumber}] ${selectedTicket.title}`)}`}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition shrink-0"
                >
                  <span>{t('support.customer_email', undefined, 'Email')}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Chatter Action Tabs (High Contrast in both Light and Dark mode) */}
            <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    sounds.playClick();
                    setChatterTab('note');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs transition ${
                    chatterTab === 'note'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-xs'
                      : 'bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 font-semibold'
                  }`}
                >
                  {t('support.tab_internal_note', undefined, 'Internal Note')}
                </button>

                <button
                  onClick={() => {
                    sounds.playClick();
                    setChatterTab('activity');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs transition ${
                    chatterTab === 'activity'
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-xs'
                      : 'bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 font-semibold'
                  }`}
                >
                  {t('support.tab_activity', undefined, 'Activity & Protocol')}
                </button>
              </div>

              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                SOCDOF
              </span>
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
                      ? t('support.placeholder_note', undefined, 'Write internal note, memo or technical comment...') 
                      : t('support.placeholder_activity', undefined, 'Document activity, call, email update or progress...')
                  }
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!chatterInput.trim()}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{t('support.btn_post_entry', undefined, 'Post Entry')}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Chatter Feed / Timeline */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              <div className="text-[11px] font-semibold text-slate-400 text-center uppercase tracking-wider">
                {t('support.logbook_title', undefined, 'Internal Logbook & Activities')}
              </div>

              {selectedTicket.activities.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-8">
                  {t('support.log_empty', undefined, 'No notes or activities recorded yet.')}
                </div>
              ) : (
                selectedTicket.activities.map((act) => (
                  <div key={act.id} className="flex gap-2.5 items-start text-xs">
                    {/* Avatar Badge */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 text-white shadow-2xs ${
                      act.type === 'note' ? 'bg-amber-500' :
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
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
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

      {/* Support Settings Modal (General, Teams, Staff) */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {t('support.settings_modal_title', undefined, 'Support & Service Configuration')}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('support.settings_tooltip', undefined, 'Configure ticket prefix, sequence numbers, teams and staff')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  sounds.playClick();
                  setIsSettingsModalOpen(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Settings Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              {[
                { key: 'general', label: t('support.settings_tab_general', undefined, 'Prefix & Values'), icon: Sliders },
                { key: 'teams', label: `${t('support.settings_tab_teams', undefined, 'Teams')} (${teams.length})`, icon: Users },
                { key: 'staff', label: `${t('support.settings_tab_staff', undefined, 'Staff')} (${staffList.length})`, icon: User }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = settingsActiveTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      sounds.playClick();
                      setSettingsActiveTab(tab.key as any);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      isActive
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs overflow-y-auto flex-1 p-1">
              
              {/* TAB 1: GENERAL (PREFIX & NUMBERING) */}
              {settingsActiveTab === 'general' && (
                <div className="space-y-4">
                  {/* Ticket Prefix */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.settings_prefix_label', undefined, 'Ticket Prefix')}
                    </label>
                    <input
                      type="text"
                      value={tempSettings.ticketPrefix}
                      onChange={(e) => setTempSettings({ ...tempSettings, ticketPrefix: e.target.value.toUpperCase() })}
                      placeholder={t('support.settings_prefix_hint', undefined, 'e.g. SUP-, TICK-, IT-, SERV-')}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Preview: <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{tempSettings.ticketPrefix || 'SUP-'}{tempSettings.nextNumber || 1001}</span>
                    </p>
                  </div>

                  {/* Start Sequence Number */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.settings_next_num_label', undefined, 'Next Ticket Number')}
                    </label>
                    <input
                      type="number"
                      value={tempSettings.nextNumber}
                      onChange={(e) => setTempSettings({ ...tempSettings, nextNumber: parseInt(e.target.value) || 1001 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  {/* Default Hourly Rate */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.settings_default_rate_label', undefined, 'Default Hourly Rate (€)')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="5"
                        value={tempSettings.defaultHourlyRate}
                        onChange={(e) => setTempSettings({ ...tempSettings, defaultHourlyRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-cyan-500"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-mono">€</span>
                    </div>
                  </div>

                  {/* Default Team */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.settings_default_team_label', undefined, 'Default Team')}
                    </label>
                    <select
                      value={tempSettings.defaultTeam}
                      onChange={(e) => setTempSettings({ ...tempSettings, defaultTeam: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500"
                    >
                      {teams.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Default Staff */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.settings_default_staff_label', undefined, 'Default Staff')}
                    </label>
                    <select
                      value={tempSettings.defaultStaff}
                      onChange={(e) => setTempSettings({ ...tempSettings, defaultStaff: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500"
                    >
                      {staffList.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: TEAMS MANAGER */}
              {settingsActiveTab === 'teams' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder={t('support.teams_placeholder', undefined, 'New team name (e.g. 2nd Level Support)...')}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newTeamName.trim()) return;
                        if (!teams.includes(newTeamName.trim())) {
                          const updated = [...teams, newTeamName.trim()];
                          saveTeams(updated);
                          sounds.playSuccess();
                        }
                        setNewTeamName('');
                      }}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('support.teams_add_btn', undefined, 'Add Team')}</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {teams.map((tItem, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {editingTeamIndex === idx ? (
                          <input
                            type="text"
                            value={editingTeamValue}
                            onChange={(e) => setEditingTeamValue(e.target.value)}
                            className="flex-1 px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg"
                          />
                        ) : (
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{tItem}</span>
                        )}

                        <div className="flex items-center gap-1 ml-2">
                          {editingTeamIndex === idx ? (
                            <button
                              onClick={() => {
                                if (editingTeamValue.trim()) {
                                  const updated = [...teams];
                                  updated[idx] = editingTeamValue.trim();
                                  saveTeams(updated);
                                }
                                setEditingTeamIndex(null);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingTeamIndex(idx);
                                setEditingTeamValue(tItem);
                              }}
                              className="p-1 text-slate-400 hover:text-cyan-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {teams.length > 1 && (
                            <button
                              onClick={() => {
                                const updated = teams.filter((_, i) => i !== idx);
                                saveTeams(updated);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: STAFF / ASSIGNEES MANAGER */}
              {settingsActiveTab === 'staff' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder={t('support.staff_placeholder', undefined, 'New staff name (e.g. Alex Miller)...')}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newStaffName.trim()) return;
                        if (!staffList.includes(newStaffName.trim())) {
                          const updated = [...staffList, newStaffName.trim()];
                          saveStaffList(updated);
                          sounds.playSuccess();
                        }
                        setNewStaffName('');
                      }}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('support.staff_add_btn', undefined, 'Add Staff')}</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {staffList.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {editingStaffIndex === idx ? (
                          <input
                            type="text"
                            value={editingStaffValue}
                            onChange={(e) => setEditingStaffValue(e.target.value)}
                            className="flex-1 px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg"
                          />
                        ) : (
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{s}</span>
                        )}

                        <div className="flex items-center gap-1 ml-2">
                          {editingStaffIndex === idx ? (
                            <button
                              onClick={() => {
                                if (editingStaffValue.trim()) {
                                  const updated = [...staffList];
                                  updated[idx] = editingStaffValue.trim();
                                  saveStaffList(updated);
                                }
                                setEditingStaffIndex(null);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingStaffIndex(idx);
                                setEditingStaffValue(s);
                              }}
                              className="p-1 text-slate-400 hover:text-cyan-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {staffList.length > 1 && (
                            <button
                              onClick={() => {
                                const updated = staffList.filter((_, i) => i !== idx);
                                saveStaffList(updated);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setIsSettingsModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                {t('action.cancel', undefined, 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  saveSettings(tempSettings);
                  setIsSettingsModalOpen(false);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('support.settings_save_btn', undefined, 'Save Settings')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Ticket Confirmation Modal */}
      {ticketToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-full bg-rose-100 dark:bg-rose-950/60">
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {t('support.delete_modal_title', undefined, 'Delete Support Ticket')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {ticketToDelete.ticketNumber} – {ticketToDelete.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('support.delete_modal_text', undefined, 'Do you really want to permanently delete the ticket')} "{ticketToDelete.ticketNumber} – {ticketToDelete.title}"?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTicketToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                {t('action.cancel', undefined, 'Cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteTicket}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('support.delete_modal_confirm', undefined, 'Delete Ticket')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Companion Import Modal */}
      <MobileCompanionImportModal
        isOpen={isMobileSyncOpen}
        onClose={() => setIsMobileSyncOpen(false)}
        existingTickets={tickets}
        currency={companyProfile.currency || '€'}
        onImportComplete={(newTickets, updatedTickets) => {
          let currentList = [...tickets];
          // Apply updates
          if (updatedTickets.length > 0) {
            const updatedIds = new Set(updatedTickets.map(u => u.id));
            currentList = currentList.map(t => {
              const match = updatedTickets.find(u => u.id === t.id);
              return match || t;
            });
          }
          // Prepend new tickets
          if (newTickets.length > 0) {
            currentList = [...newTickets, ...currentList];
          }
          saveTickets(currentList);
          if (newTickets.length > 0) {
            setSelectedTicketId(newTickets[0].id);
            setViewMode('detail');
          }
        }}
      />
    </div>
  );
};
