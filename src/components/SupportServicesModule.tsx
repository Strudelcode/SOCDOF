import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Pencil,
  Trash2, 
  X, 
  ArrowUpRight, 
  DollarSign, 
  Sparkles, 
  Check, 
  HelpCircle, 
  Receipt,
  Play,
  Pause,
  Square,
  RefreshCw,
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
  MessageSquare,
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
import { useLanguage, t, formatSystemDate, formatSystemTime } from '../lib/i18n';
import { MobileCompanionImportModal } from './MobileCompanionImportModal';
import { CustomerPickerModal } from './CustomerPickerModal';
import { ContactEditModal } from './ContactEditModal';
import { Smartphone, QrCode } from 'lucide-react';

interface SupportServicesModuleProps {
  contacts: Contact[];
  companyProfile: CompanyProfile;
  onCreateInvoiceForService?: (ticket: SupportServiceTicket) => void;
  onRefreshContacts?: () => void;
}

interface SupportSettings {
  ticketPrefix: string;
  nextNumber: number;
  defaultHourlyRate: number;
  defaultTeam: string;
  defaultStaff: string;
  disableTeams?: boolean;
}

const STORAGE_KEY = 'socdof_support_services_tickets_v2';
const TEAMS_STORAGE_KEY = 'socdof_support_teams_list_v2';
const STAFF_STORAGE_KEY = 'socdof_support_staff_list_v2';
const SETTINGS_STORAGE_KEY = 'socdof_support_settings_v3';

const DEFAULT_TEAMS = [
  'Standard'
];

// Clean role/staff list without arbitrary dummy presets
const DEFAULT_STAFF: string[] = [];

export const SupportServicesModule: React.FC<SupportServicesModuleProps> = ({
  contacts,
  companyProfile,
  onCreateInvoiceForService,
  onRefreshContacts
}) => {
  // Subscribe to active language state for real-time reactivity
  const lang = useLanguage();

  // Standard company fallback label
  const companyRoleName = companyProfile.name?.trim() || t('support.default_company_role', undefined, 'Firma (Eigener Betrieb)');

  const defaultSettingsObj: SupportSettings = useMemo(() => ({
    ticketPrefix: 'SUP-',
    nextNumber: 1001,
    defaultHourlyRate: 95,
    defaultTeam: 'Standard',
    defaultStaff: companyRoleName,
    disableTeams: false
  }), [companyRoleName]);

  // Support Settings (e.g. ticket prefix, default rate)
  const [settings, setSettings] = useState<SupportSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Sanitize out any personal friend names or legacy dummy defaults
        if (
          parsed.defaultStaff?.toLowerCase().includes('robert') || 
          parsed.defaultStaff?.toLowerCase().includes('hölzl') ||
          parsed.defaultStaff === 'Support Agent' ||
          parsed.defaultStaff === 'Staff Member'
        ) {
          parsed.defaultStaff = companyProfile.name || 'Firma';
        }
        if (parsed.defaultTeam?.toLowerCase().includes('kundendienst & service')) {
          parsed.defaultTeam = 'Standard';
        }
        return { 
          ticketPrefix: parsed.ticketPrefix || 'SUP-',
          nextNumber: parsed.nextNumber || 1001,
          defaultHourlyRate: parsed.defaultHourlyRate || 95,
          defaultTeam: parsed.defaultTeam || 'Standard',
          defaultStaff: parsed.defaultStaff || companyProfile.name || 'Firma',
          disableTeams: typeof parsed.disableTeams === 'boolean' ? parsed.disableTeams : false
        };
      }
    } catch (e) {
      console.error(e);
    }
    return {
      ticketPrefix: 'SUP-',
      nextNumber: 1001,
      defaultHourlyRate: 95,
      defaultTeam: 'Standard',
      defaultStaff: companyProfile.name || 'Firma',
      disableTeams: false
    };
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

  // Staff / Agents state (customizable by user, clean without dummy presets)
  const [staffList, setStaffList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STAFF_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sanitize out any personal friend names or legacy dummy defaults
          const sanitized = parsed.filter(
            s => typeof s === 'string' && 
                 !s.toLowerCase().includes('robert') && 
                 !s.toLowerCase().includes('hölzl') &&
                 s !== 'Support Agent' &&
                 s !== 'Staff Member'
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
          const fallbackStaff = companyProfile.name || 'Firma';
          return parsed.map((t: any) => ({
            ...t,
            assignedStaff: (t.assignedStaff?.toLowerCase().includes('robert') || t.assignedStaff?.toLowerCase().includes('hölzl') || t.assignedStaff === 'Support Agent') 
              ? fallbackStaff 
              : t.assignedStaff || fallbackStaff,
            activities: Array.isArray(t.activities) 
              ? t.activities.map((a: any) => ({
                  ...a,
                  author: (a.author?.toLowerCase().includes('robert') || a.author?.toLowerCase().includes('hölzl') || a.author === 'Support Agent') 
                    ? fallbackStaff 
                    : a.author || fallbackStaff
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

  // Chatter / Logbook Visibility (Default: false / hidden as requested, with localStorage persistence)
  const [isChatterVisible, setIsChatterVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('socdof_support_chatter_visible');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });

  // Customer In-App Picker Modal State
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);

  // Direct Contact Edit Modal State
  const [isDirectContactEditOpen, setIsDirectContactEditOpen] = useState(false);
  const [directContactToEdit, setDirectContactToEdit] = useState<Contact | null>(null);

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

  // Kanban status columns with cohesive professional identities
  const kanbanColumns = useMemo(() => [
    { key: 'new', label: getStatusLabel('new'), dotColor: 'bg-blue-500', badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700' },
    { key: 'in_progress', label: getStatusLabel('in_progress'), dotColor: 'bg-sky-500', badgeColor: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800' },
    { key: 'waiting', label: getStatusLabel('waiting'), dotColor: 'bg-amber-500', badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800' },
    { key: 'resolved', label: getStatusLabel('resolved'), dotColor: 'bg-emerald-500', badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
    { key: 'closed', label: getStatusLabel('closed'), dotColor: 'bg-slate-400', badgeColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700' }
  ], [lang]);

  const activeKanbanColumns = useMemo(() => {
    if (selectedStatusFilter === 'all') return kanbanColumns;
    return kanbanColumns.filter(c => c.key === selectedStatusFilter);
  }, [kanbanColumns, selectedStatusFilter]);

  // Detail / Edit Form state
  const [activeTab, setActiveTab] = useState<'description' | 'timesheets'>('description');
  const [chatterTab, setChatterTab] = useState<'note' | 'activity'>('note');
  const [chatterInput, setChatterInput] = useState('');
  
  // Custom Free-Text Assignee Mode
  const [isCustomAssigneeMode, setIsCustomAssigneeMode] = useState(false);

  // Effective staff options (includes companyRoleName / companyProfile.name as primary default)
  const effectiveStaffList = useMemo(() => {
    const list = [...staffList];
    if (companyRoleName && !list.includes(companyRoleName)) {
      list.unshift(companyRoleName);
    }
    return list.length > 0 ? list : [companyRoleName];
  }, [staffList, companyRoleName]);

  // Quick Timesheet Row Form
  const [isAddingTimesheet, setIsAddingTimesheet] = useState(false);
  const [newTsDate, setNewTsDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTsStaff, setNewTsStaff] = useState(companyRoleName);
  const [newTsDesc, setNewTsDesc] = useState('');
  const [newTsHours, setNewTsHours] = useState('1.0');
  const [tagInput, setTagInput] = useState('');

  // Live Timer elapsed time tracker (in seconds)
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Resizable Modules Split Ratio (Module 1 vs Module 2) (persisted)
  const [formModulesRatio, setFormModulesRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('socdof_support_form_modules_ratio');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 25 && val <= 75) return val;
      }
    } catch {}
    return 50;
  });
  const [isDraggingModulesSplitter, setIsDraggingModulesSplitter] = useState(false);
  const modulesContainerRef = useRef<HTMLDivElement>(null);

  const handleModulesSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingModulesSplitter(true);
    const startX = e.clientX;
    const startRatio = formModulesRatio;
    const container = modulesContainerRef.current;
    const containerWidth = container ? container.getBoundingClientRect().width : 800;

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX;
      const deltaRatio = (deltaX / containerWidth) * 100;
      const newRatio = Math.min(75, Math.max(25, startRatio + deltaRatio));
      setFormModulesRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDraggingModulesSplitter(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setFormModulesRatio(current => {
        try {
          localStorage.setItem('socdof_support_form_modules_ratio', current.toString());
        } catch {}
        return current;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Live Timer custom work description
  const [liveTimerDescription, setLiveTimerDescription] = useState('');

  // Timesheet inline editing state
  const [editingTimesheetId, setEditingTimesheetId] = useState<string | null>(null);
  const [editTsDate, setEditTsDate] = useState('');
  const [editTsStaff, setEditTsStaff] = useState('');
  const [editTsDesc, setEditTsDesc] = useState('');
  const [editTsHours, setEditTsHours] = useState('');

  const handleStartEditTimesheet = (ts: SupportTimesheetEntry) => {
    sounds.playClick();
    setEditingTimesheetId(ts.id);
    setEditTsDate(ts.date || new Date().toISOString().split('T')[0]);
    setEditTsStaff(ts.staff || selectedTicket?.assignedStaff || companyRoleName);
    setEditTsDesc(ts.description || '');
    setEditTsHours(ts.hours.toString());
  };

  const handleCancelEditTimesheet = () => {
    sounds.playClick();
    setEditingTimesheetId(null);
  };

  // Resizable Chatter / Logbook Column Width (persisted)
  const [chatterWidth, setChatterWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('socdof_support_chatter_width');
      return saved ? Math.max(280, Math.min(800, parseInt(saved, 10))) : 400;
    } catch {
      return 400;
    }
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    const startX = e.clientX;
    const startWidth = chatterWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      // Dragging mouse left expands chatter width; dragging right shrinks it
      const deltaX = startX - ev.clientX;
      const maxAllowed = typeof window !== 'undefined' ? window.innerWidth * 0.65 : 800;
      const newWidth = Math.max(280, Math.min(maxAllowed, startWidth + deltaX));
      setChatterWidth(Math.round(newWidth));
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setChatterWidth(current => {
        try {
          localStorage.setItem('socdof_support_chatter_width', current.toString());
        } catch {}
        return current;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Formatted date helper matching settings format
  const formatDate = (dateInput: Date | string | number | undefined | null) => {
    if (!dateInput) return '';
    return formatSystemDate(dateInput, companyProfile.date_format || 'DD.MM.YYYY');
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

  const assignedContact = useMemo(() => {
    if (!selectedTicket?.contact_id) return undefined;
    return contacts.find(c => String(c.id) === String(selectedTicket.contact_id));
  }, [contacts, selectedTicket?.contact_id]);

  // Global background running ticket (if any)
  const activeRunningTicket = useMemo(() => {
    return tickets.find(t => t.isTimerRunning && t.timerStartedAt);
  }, [tickets]);

  // Calculate live total seconds for any ticket (accounting for accumulated + active run)
  const calculateTicketTimerSeconds = (tItem: SupportServiceTicket | null) => {
    if (!tItem) return 0;
    const base = tItem.timerAccumulatedSeconds || 0;
    if (tItem.isTimerRunning && tItem.timerStartedAt) {
      const startMs = new Date(tItem.timerStartedAt).getTime();
      const elapsed = isNaN(startMs) ? 0 : Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      return base + elapsed;
    }
    return base;
  };

  // Live Timer Interval with session & crash-recovery persistence
  useEffect(() => {
    let interval: any = null;
    const updateSeconds = () => {
      if (selectedTicket) {
        setTimerSeconds(calculateTicketTimerSeconds(selectedTicket));
      } else {
        setTimerSeconds(0);
      }
    };

    updateSeconds();

    if (selectedTicket?.isTimerRunning) {
      interval = setInterval(updateSeconds, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedTicket?.id, selectedTicket?.isTimerRunning, selectedTicket?.timerStartedAt, selectedTicket?.timerAccumulatedSeconds]);

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
    
    // Clean initial state without prefilling first contact
    const newTicket: SupportServiceTicket = {
      id: newId,
      ticketNumber: newTicketNumber,
      title: `${t('support.new_ticket', undefined, 'New Ticket')} #${newTicketNumber}`,
      team: settings.defaultTeam || teams[0] || 'Standard',
      assignedStaff: settings.defaultStaff || staffList[0] || 'Support Agent',
      priority: 1,
      tags: ['Support'],
      contact_id: undefined,
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      contact_company: '',
      status: 'new',
      description: '',
      hourlyRate: settings.defaultHourlyRate || 95,
      billable: true,
      timesheets: [],
      timerAccumulatedSeconds: 0,
      activities: [
        {
          id: `act_${Date.now()}`,
          author: settings.defaultStaff || staffList[0] || companyRoleName,
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
      author: selectedTicket.assignedStaff || companyRoleName,
      type: 'system',
      content: `${t('support.act_status_changed', undefined, 'Status changed to')} "${getStatusLabel(newStatus)}".`,
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      status: newStatus,
      activities: [newActivity, ...selectedTicket.activities]
    });
  };

  // Live Timer Actions with full persistence across reload/crashes
  const handleStartTimer = () => {
    if (!selectedTicket) return;
    sounds.playClick();
    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: selectedTicket.assignedStaff || companyRoleName,
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
  };

  const handlePauseTimer = () => {
    if (!selectedTicket) return;
    sounds.playClick();
    const currentElapsed = selectedTicket.timerStartedAt 
      ? Math.max(0, Math.floor((Date.now() - new Date(selectedTicket.timerStartedAt).getTime()) / 1000))
      : 0;
    const newAccumulated = (selectedTicket.timerAccumulatedSeconds || 0) + currentElapsed;

    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: selectedTicket.assignedStaff || companyRoleName,
      type: 'system',
      content: `${t('support.timer_paused', undefined, 'Live-Timer paused:')} ${formatDetailedTimer(newAccumulated, lang)}.`,
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      isTimerRunning: false,
      timerStartedAt: undefined,
      timerAccumulatedSeconds: newAccumulated,
      timerPausedAt: new Date().toISOString(),
      activities: [newActivity, ...selectedTicket.activities]
    });
  };

  const handleResumeTimer = () => {
    if (!selectedTicket) return;
    sounds.playClick();
    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: selectedTicket.assignedStaff || companyRoleName,
      type: 'system',
      content: t('support.btn_resume_timer', undefined, 'Live-Timer resumed.'),
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      isTimerRunning: true,
      timerStartedAt: new Date().toISOString(),
      activities: [newActivity, ...selectedTicket.activities]
    });
  };

  const handleStopAndBookTimer = () => {
    if (!selectedTicket) return;
    sounds.playClick();

    const totalSec = calculateTicketTimerSeconds(selectedTicket);
    const durationHours = Math.max(0.05, Number((totalSec / 3600).toFixed(2)));
    const formattedDur = formatDetailedTimer(totalSec, lang);

    const customDesc = liveTimerDescription.trim();
    const entryDescription = customDesc 
      ? `${customDesc} [${formattedDur}]` 
      : `${t('support.timesheet_live_timer_title', undefined, '1-Click Live-Timer (Work Time)')} [${formattedDur}]`;

    const newEntry: SupportTimesheetEntry = {
      id: `ts_${Date.now()}`,
      ticket_id: selectedTicket.id,
      staff: selectedTicket.assignedStaff || companyRoleName,
      description: entryDescription,
      hours: durationHours,
      hourlyRate: selectedTicket.hourlyRate || settings.defaultHourlyRate || 95,
      billable: selectedTicket.billable,
      date: new Date().toISOString().split('T')[0],
      startedAt: selectedTicket.timerStartedAt || new Date().toISOString(),
      endedAt: new Date().toISOString()
    };

    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: selectedTicket.assignedStaff || companyRoleName,
      type: 'activity',
      content: `${t('support.act_timer_stopped', undefined, 'Live-Timer stopped & recorded:')} ${durationHours} h (${entryDescription}).`,
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      isTimerRunning: false,
      timerStartedAt: undefined,
      timerAccumulatedSeconds: 0,
      timerPausedAt: undefined,
      timesheets: [newEntry, ...selectedTicket.timesheets],
      activities: [newActivity, ...selectedTicket.activities]
    });
    setLiveTimerDescription('');
    sounds.playSuccess();
  };

  const handleResetTimer = () => {
    if (!selectedTicket) return;
    sounds.playClick();
    updateCurrentTicket({
      isTimerRunning: false,
      timerStartedAt: undefined,
      timerAccumulatedSeconds: 0,
      timerPausedAt: undefined
    });
  };

  // Save edited timesheet entry
  const handleSaveEditTimesheet = (tsId: string) => {
    if (!selectedTicket) return;
    sounds.playClick();
    const parsedHours = Math.max(0.05, parseFloat(editTsHours) || 0.25);
    const updatedTimesheets = selectedTicket.timesheets.map(t => {
      if (t.id === tsId) {
        return {
          ...t,
          date: editTsDate,
          staff: editTsStaff.trim() || companyRoleName,
          description: editTsDesc.trim() || t('support.tab_timesheets', undefined, 'Work Hours'),
          hours: parsedHours
        };
      }
      return t;
    });

    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: companyRoleName,
      type: 'activity',
      content: `${t('support.timesheet_editing_title', undefined, 'Timesheet updated')}: ${editTsStaff} – "${editTsDesc}" (${parsedHours} h)`,
      createdAt: new Date().toISOString()
    };

    updateCurrentTicket({
      timesheets: updatedTimesheets,
      activities: [newActivity, ...selectedTicket.activities]
    });
    setEditingTimesheetId(null);
    sounds.playSuccess();
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
      staff: newTsStaff || selectedTicket.assignedStaff || companyRoleName,
      description: newTsDesc.trim() || t('support.tab_timesheets', undefined, 'Work Hours'),
      hours: hours,
      hourlyRate: selectedTicket.hourlyRate || 95,
      billable: selectedTicket.billable,
      date: newTsDate || new Date().toISOString().split('T')[0]
    };

    const newActivity: SupportActivityEntry = {
      id: `act_${Date.now()}`,
      author: newTsStaff || selectedTicket.assignedStaff || companyRoleName,
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
      author: selectedTicket.assignedStaff || companyRoleName,
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
  const handleSelectContact = (contactIdOrContact: string | number | Contact | null | undefined) => {
    if (!selectedTicket) return;
    sounds.playClick();
    if (!contactIdOrContact || contactIdOrContact === '') {
      updateCurrentTicket({
        contact_id: undefined,
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        contact_company: ''
      });
      return;
    }

    // Direct Contact object passed from CustomerPickerModal or ID passed from select
    let found: Contact | undefined;
    if (typeof contactIdOrContact === 'object' && 'id' in contactIdOrContact) {
      found = contactIdOrContact;
    } else {
      found = contacts.find(c => String(c.id) === String(contactIdOrContact));
    }

    if (found) {
      const hasRate = found.default_hourly_rate !== undefined && found.default_hourly_rate > 0;
      const rateInfo = hasRate 
        ? ` (${t('support.applied_customer_rate', undefined, 'Kunden-Stundensatz übernommen: {rate} / Std.').replace('{rate}', `${found.default_hourly_rate?.toFixed(2)} ${companyProfile.currency || '€'}`)})` 
        : '';

      const newActivity: SupportActivityEntry = {
        id: `act_${Date.now()}`,
        author: selectedTicket.assignedStaff || companyRoleName,
        type: 'system',
        content: `${t('support.act_customer_assigned', undefined, 'Kunde zugewiesen:')} ${found.name || found.company}${rateInfo}`,
        createdAt: new Date().toISOString()
      };

      const patch: Partial<SupportServiceTicket> = {
        contact_id: typeof found.id === 'number' ? found.id : Number(found.id) || undefined,
        contact_name: found.name || '',
        contact_email: found.email || '',
        contact_phone: found.phone || '',
        contact_company: found.company || '',
        activities: [newActivity, ...selectedTicket.activities]
      };

      // Automatically apply customer's standard hourly rate if configured
      if (hasRate && found.default_hourly_rate) {
        patch.hourlyRate = found.default_hourly_rate;
      }

      updateCurrentTicket(patch);
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

  // Detailed human-readable timer breakdown (Seconds, Minutes, Hours, Days) without redundant 0 units
  const formatDetailedTimer = (totalSeconds: number, langCode: string = 'de') => {
    const sec = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;

    const dayLabel = langCode === 'de' ? (days === 1 ? 'Tag' : 'Tage') : langCode === 'fr' ? (days === 1 ? 'jour' : 'jours') : langCode === 'es' ? (days === 1 ? 'día' : 'días') : (days === 1 ? 'day' : 'days');
    const hrLabel = langCode === 'de' ? 'Std.' : langCode === 'fr' ? 'h' : langCode === 'es' ? 'h' : (hours === 1 ? 'hr' : 'hrs');
    const minLabel = langCode === 'de' ? 'Min.' : langCode === 'fr' ? 'min' : langCode === 'es' ? 'min' : (mins === 1 ? 'min' : 'mins');
    const secLabel = langCode === 'de' ? 'Sek.' : langCode === 'fr' ? 's' : langCode === 'es' ? 'seg' : (secs === 1 ? 'sec' : 'secs');

    const parts: string[] = [];
    if (days > 0) {
      parts.push(`${days} ${dayLabel}`);
    }
    if (hours > 0 || days > 0) {
      parts.push(`${days > 0 ? hours.toString().padStart(2, '0') : hours} ${hrLabel}`);
    }
    if (mins > 0 || hours > 0 || days > 0) {
      parts.push(`${(days > 0 || hours > 0) ? mins.toString().padStart(2, '0') : mins} ${minLabel}`);
    }
    parts.push(`${(days > 0 || hours > 0 || mins > 0) ? secs.toString().padStart(2, '0') : secs} ${secLabel}`);

    return parts.join(', ');
  };

  // Clock format: e.g. 00:00:00 or 1d 04:15:30
  const formatTimerDisplay = (totalSeconds: number) => {
    const sec = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (days > 0) {
      return `${days}d ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
      if (diff < 60) return t('support.time_just_now', undefined, 'Just now');
      if (diff < 3600) return `${Math.floor(diff / 60)} ${t('support.time_mins_ago', undefined, 'min.')}`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('support.time_hours_ago', undefined, 'hours')}`;
      return formatDate(isoString);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none overflow-hidden">
      
      {/* Top Application Ribbon / Header */}
      <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shadow-xs shrink-0 border border-slate-700/60 dark:border-slate-700">
            <Headphones className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {t('support.title', undefined, 'Customer Support & Service')}
              </h2>
              {selectedTicket && viewMode === 'detail' && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 font-mono text-xs font-bold border border-slate-200 dark:border-slate-700">
                  {selectedTicket.ticketNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              {t('support.subtitle', undefined, 'Tickets, field service, timesheets & activities')}
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
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-2xs"
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

      {/* Active Timer Running Persistent Banner (Crash recovery / Session notification) */}
      {activeRunningTicket && (selectedTicketId !== activeRunningTicket.id || viewMode !== 'detail') && (
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-4 py-2 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-200">
              {t('support.timer_running', undefined, 'Live-Timer running')}: <strong className="text-white font-medium">{activeRunningTicket.ticketNumber} – {activeRunningTicket.title}</strong>
            </span>
            <span className="font-mono bg-slate-800 text-cyan-300 px-2.5 py-0.5 rounded-md text-[11px] font-bold border border-slate-700">
              {formatDetailedTimer(calculateTicketTimerSeconds(activeRunningTicket), lang)}
            </span>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              setSelectedTicketId(activeRunningTicket.id);
              setViewMode('detail');
              setActiveTab('timesheets');
            }}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1"
          >
            <span>{t('support.open_ticket', undefined, 'Open ticket')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Team Filter - Hidden in Solo Mode */}
              {!settings.disableTeams && (
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
              )}

              {/* Status Quick Filter Bar - Directly visible, responsive, and click-to-filter */}
              <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-300/60 dark:border-slate-700 max-w-full overflow-x-auto scrollbar-thin">
                {[
                  { key: 'all', label: t('support.filter_all_statuses', undefined, 'All Statuses'), count: tickets.length, color: 'bg-slate-400' },
                  { key: 'new', label: getStatusLabel('new'), count: tickets.filter(t => t.status === 'new').length, color: 'bg-blue-500' },
                  { key: 'in_progress', label: getStatusLabel('in_progress'), count: tickets.filter(t => t.status === 'in_progress').length, color: 'bg-sky-500' },
                  { key: 'waiting', label: getStatusLabel('waiting'), count: tickets.filter(t => t.status === 'waiting').length, color: 'bg-amber-500' },
                  { key: 'resolved', label: getStatusLabel('resolved'), count: tickets.filter(t => t.status === 'resolved').length, color: 'bg-emerald-500' },
                  { key: 'closed', label: getStatusLabel('closed'), count: tickets.filter(t => t.status === 'closed').length, color: 'bg-slate-400' }
                ].map(phase => {
                  const isActive = selectedStatusFilter === phase.key;
                  return (
                    <button
                      key={phase.key}
                      onClick={() => {
                        sounds.playClick();
                        setSelectedStatusFilter(phase.key);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
                        isActive
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs ring-1 ring-slate-300 dark:ring-slate-700'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-300/40 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${phase.color}`} />
                      <span>{phase.label}</span>
                      <span className={`text-[10px] px-1 rounded-full ${isActive ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold' : 'text-slate-400'}`}>
                        {phase.count}
                      </span>
                    </button>
                  );
                })}
              </div>
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
                        {!settings.disableTeams && <th className="py-3 px-4">{t('support.th_team', undefined, 'Team')}</th>}
                        <th className="py-3 px-4">{t('support.th_customer', undefined, 'Customer (CRM)')}</th>
                        {!settings.disableTeams && <th className="py-3 px-4">{t('support.th_assignee', undefined, 'Assignee')}</th>}
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

                            {!settings.disableTeams && (
                              <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                                {ticket.team}
                              </td>
                            )}

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

                            {!settings.disableTeams && (
                              <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{ticket.assignedStaff || '–'}</span>
                                </div>
                              </td>
                            )}

                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                                ticket.status === 'new' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' :
                                ticket.status === 'in_progress' ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' :
                                ticket.status === 'waiting' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                                ticket.status === 'resolved' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  ticket.status === 'new' ? 'bg-blue-500' :
                                  ticket.status === 'in_progress' ? 'bg-sky-500' :
                                  ticket.status === 'waiting' ? 'bg-amber-500' :
                                  ticket.status === 'resolved' ? 'bg-emerald-500' :
                                  'bg-slate-400'
                                }`} />
                                <span>{getStatusLabel(ticket.status)}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right font-mono">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {hours.toFixed(1)} h
                                </span>
                                {ticket.isTimerRunning && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[9px] font-bold animate-pulse flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>{formatTimerDisplay(calculateTicketTimerSeconds(ticket))}</span>
                                  </span>
                                )}
                              </div>
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
            <div className="flex-1 overflow-x-auto p-3 sm:p-4 md:p-5 flex gap-3 sm:gap-4 min-h-0 h-full scrollbar-thin">
              {activeKanbanColumns.map(column => {
                const columnTickets = filteredTickets.filter(t => t.status === column.key);
                return (
                  <div 
                    key={column.key}
                    className="flex-1 min-w-[220px] max-w-[340px] shrink-0 xl:shrink flex flex-col h-full min-h-0 bg-slate-200/50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs"
                  >
                    <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`} />
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {column.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {columnTickets.length}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-2.5 space-y-2 sm:space-y-2.5 scrollbar-thin">
                      {columnTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-28 text-center p-3 text-slate-400 dark:text-slate-500 text-xs border border-dashed border-slate-300/70 dark:border-slate-700/60 rounded-xl">
                          <span className="italic">{t('support.no_tickets_in_status', undefined, 'No tickets in this phase')}</span>
                        </div>
                      ) : (
                        columnTickets.map(ticket => (
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
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                                  {ticket.ticketNumber}
                                </span>
                                {ticket.isTimerRunning && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[9px] font-bold animate-pulse flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>{formatTimerDisplay(calculateTicketTimerSeconds(ticket))}</span>
                                  </span>
                                )}
                              </div>
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
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : selectedTicket ? (
        /* DETAIL VIEW: Modern Support / CRM Form with 2-Column Split (Form & Internal Logbook) */
        <div className={`flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 ${isDraggingSplitter ? 'select-none cursor-col-resize' : ''}`}>
          
          {/* Left Column: Ticket Main Form */}
          <div className={`flex-1 flex flex-col overflow-y-auto bg-white dark:bg-slate-900 ${!isChatterVisible ? 'border-r border-slate-200/80 dark:border-slate-800' : ''} min-h-0 min-w-0`}>
            
            {/* Top Action Ribbon & Status Stepper */}
            <div className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 shrink-0 sticky top-0 z-10 backdrop-blur-md shadow-2xs">
              
              {/* Row 1: Ticket Metadata & Primary Action Toolbar */}
              <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 flex-wrap border-b border-slate-200/60 dark:border-slate-800/60">
                {/* Left: Ticket Identifier & Current Status Badge */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-200 font-mono text-xs font-bold border border-cyan-200 dark:border-cyan-800/80 shadow-2xs">
                    {selectedTicket.ticketNumber}
                  </span>

                  {/* Active Status Badge */}
                  <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs border ${
                    selectedTicket.status === 'new'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      : selectedTicket.status === 'in_progress'
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                      : selectedTicket.status === 'waiting'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : selectedTicket.status === 'resolved'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      selectedTicket.status === 'new' ? 'bg-blue-500' :
                      selectedTicket.status === 'in_progress' ? 'bg-sky-500' :
                      selectedTicket.status === 'waiting' ? 'bg-amber-500' :
                      selectedTicket.status === 'resolved' ? 'bg-emerald-500' :
                      'bg-slate-400'
                    }`} />
                    <span>{getStatusLabel(selectedTicket.status)}</span>
                  </div>

                  {/* Creation Date */}
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    {formatDate(selectedTicket.created_at)}
                  </span>
                </div>

                {/* Right: Actions Group */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Create Invoice */}
                  {onCreateInvoiceForService && (
                    <button
                      onClick={() => {
                        sounds.playClick();
                        onCreateInvoiceForService(selectedTicket);
                      }}
                      className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 transition shadow-2xs"
                      title={t('support.btn_invoice_tooltip', undefined, 'Create invoice from recorded times')}
                    >
                      <Receipt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="hidden sm:inline">{t('support.btn_invoice', undefined, 'Create Invoice')}</span>
                    </button>
                  )}

                  {/* Close / Reopen */}
                  {selectedTicket.status !== 'closed' ? (
                    <button
                      onClick={() => handleStatusChange('closed')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-300 dark:border-emerald-800 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition shadow-2xs active:scale-95"
                      title={t('support.btn_close', undefined, 'Close Ticket')}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t('support.btn_close', undefined, 'Close Ticket')}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange('in_progress')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-800 bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition shadow-2xs active:scale-95"
                      title={t('support.btn_reopen', undefined, 'Reopen')}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('support.btn_reopen', undefined, 'Reopen')}</span>
                    </button>
                  )}

                  {/* Toggle Chatter Logbook Button */}
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setIsChatterVisible(prev => {
                        const next = !prev;
                        try {
                          localStorage.setItem('socdof_support_chatter_visible', String(next));
                        } catch {}
                        return next;
                      });
                    }}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                      isChatterVisible
                        ? 'border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    title={t('support.toggle_chatter', undefined, 'Toggle Activity & Notes Log')}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>
                      {isChatterVisible 
                        ? t('support.hide_chatter', undefined, 'Hide Logbook') 
                        : t('support.show_chatter', undefined, 'Show Logbook')}
                    </span>
                    {!isChatterVisible && selectedTicket.activities && selectedTicket.activities.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-900/80 text-cyan-700 dark:text-cyan-300">
                        {selectedTicket.activities.length}
                      </span>
                    )}
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => setTicketToDelete(selectedTicket)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition border border-transparent hover:border-rose-200 dark:hover:border-rose-900"
                    title={t('support.btn_delete', undefined, 'Delete Ticket')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Row 2: Workflow Pipeline Stepper across full width */}
              <div className="px-3 sm:px-4 py-2 bg-slate-100/70 dark:bg-slate-900/50 overflow-x-auto no-scrollbar">
                <div className="flex items-center min-w-max gap-1">
                  {[
                    { key: 'new', step: '1', label: getStatusLabel('new'), color: 'bg-blue-500' },
                    { key: 'in_progress', step: '2', label: getStatusLabel('in_progress'), color: 'bg-sky-500' },
                    { key: 'waiting', step: '3', label: getStatusLabel('waiting'), color: 'bg-amber-500' },
                    { key: 'resolved', step: '4', label: getStatusLabel('resolved'), color: 'bg-emerald-500' },
                    { key: 'closed', step: '5', label: getStatusLabel('closed'), color: 'bg-slate-400' }
                  ].map((phase, idx, arr) => {
                    const isCurrent = selectedTicket.status === phase.key;
                    return (
                      <React.Fragment key={phase.key}>
                        <button
                          onClick={() => handleStatusChange(phase.key as any)}
                          className={`px-3 py-1.5 rounded-xl transition text-xs font-medium flex items-center gap-2 border cursor-pointer ${
                            isCurrent
                              ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs font-bold'
                              : 'bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300'
                          }`}
                          title={phase.label}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-white animate-pulse' : phase.color}`} />
                          <span className="font-semibold whitespace-nowrap">{phase.label}</span>
                        </button>
                        {idx < arr.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 mx-0.5" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
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
              {/* 2-Column Form Fields with Draggable Resizer between the two modules */}
              <div 
                ref={modulesContainerRef}
                style={{ '--m1-width': `${formModulesRatio}%` } as React.CSSProperties}
                className="flex flex-col md:flex-row gap-0 text-xs border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/40 dark:bg-slate-900/30 shadow-2xs"
              >
                
                {/* Column 1 / Module 1: Assignment, Team & Priority */}
                <div 
                  className="p-4 sm:p-5 space-y-4 min-w-0 w-full md:w-[var(--m1-width)] md:shrink-0"
                >
                  {/* Kundendienstteam - Hidden in Solo Mode */}
                  {!settings.disableTeams && (
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
                  )}

                  {/* Zugewiesen an - Hidden in Solo Mode */}
                  {!settings.disableTeams && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">
                          {t('support.label_assignee', undefined, 'Assigned to')}
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSettingsActiveTab('staff');
                              setIsSettingsModalOpen(true);
                            }}
                            className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{t('support.btn_add_role_staff', undefined, 'Rollen / Mitarbeiter')}</span>
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
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
                            } else if (e.target.value === '__manage_staff__') {
                              setSettingsActiveTab('staff');
                              setIsSettingsModalOpen(true);
                            } else {
                              updateCurrentTicket({ assignedStaff: e.target.value });
                            }
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                        >
                          {effectiveStaffList.map(staff => (
                            <option key={staff} value={staff}>{staff}</option>
                          ))}
                          {selectedTicket.assignedStaff && !effectiveStaffList.includes(selectedTicket.assignedStaff) && (
                            <option value={selectedTicket.assignedStaff}>{selectedTicket.assignedStaff}</option>
                          )}
                          <option value="__custom_mode__">✏️ {t('support.btn_switch_freetext', undefined, 'Custom name (Free text)...')}</option>
                          <option value="__manage_staff__">⚙️ + {t('support.btn_manage_staff', undefined, 'Rollen & Mitarbeiter verwalten...')}</option>
                        </select>
                      )}
                    </div>
                  )}

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

                {/* Draggable Splitter Line between Module 1 and Module 2 (Slim & Minimal) */}
                <div
                  onMouseDown={handleModulesSplitterMouseDown}
                  className={`hidden md:flex items-center justify-center w-[3px] cursor-col-resize group shrink-0 select-none transition-colors relative z-10 ${
                    isDraggingModulesSplitter
                      ? 'bg-cyan-500'
                      : 'bg-slate-200 hover:bg-cyan-500/80 dark:bg-slate-800 dark:hover:bg-cyan-500/80'
                  }`}
                  title={t('support.drag_resize_modules', undefined, 'Drag to resize form modules')}
                >
                  <div className="w-full h-8 rounded-full bg-slate-400/60 group-hover:bg-cyan-400 dark:bg-slate-600 transition-colors" />
                </div>

                {/* Column 2 / Module 2: Customer Contact Info & Billing Rate */}
                <div className="p-4 sm:p-5 space-y-4 min-w-0 flex-1 border-t md:border-t-0 border-slate-200/80 dark:border-slate-800">
                  {/* Kunde (CRM / Address Book) Section */}
                  <div className="space-y-2">
                    {/* Header Label & Modal Trigger Button */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        {t('support.label_customer', undefined, 'Customer (CRM / Address Book)')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomerPickerOpen(true)}
                        className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer transition"
                      >
                        <Search className="w-3 h-3" />
                        <span>{contacts.length} {t('support.contacts_found_count', undefined, 'Contacts')}</span>
                      </button>
                    </div>

                    {/* Customer Selection Card: Assigned vs Unassigned */}
                    {(() => {
                      const hasAssigned = Boolean(assignedContact || selectedTicket.contact_id || selectedTicket.contact_name);

                      if (hasAssigned) {
                        const displayName = assignedContact?.name || selectedTicket.contact_name || selectedTicket.contact_company || 'Customer';
                        const displayCompany = selectedTicket.contact_company || assignedContact?.company;
                        const initials = displayName.substring(0, 2).toUpperCase();

                        return (
                          <div className="p-3 rounded-2xl border border-cyan-200 dark:border-cyan-800/80 bg-gradient-to-br from-cyan-50/70 to-white dark:from-cyan-950/30 dark:to-slate-900 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-9 h-9 rounded-xl ${assignedContact?.avatar_color || 'bg-cyan-600'} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}>
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                      {displayName}
                                    </h4>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-900/80 text-cyan-800 dark:text-cyan-200 font-semibold uppercase">
                                      {assignedContact?.type || 'CRM'}
                                    </span>
                                  </div>
                                  {displayCompany && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                      <Building2 className="w-3 h-3 shrink-0 text-slate-400" />
                                      <span>{displayCompany}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    sounds.playClick();
                                    setDirectContactToEdit(assignedContact || null);
                                    setIsDirectContactEditOpen(true);
                                  }}
                                  className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
                                  title={t('support.btn_edit_contact', undefined, 'Edit Contact & Rate')}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsCustomerPickerOpen(true)}
                                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title={t('support.btn_change_customer', undefined, 'Change customer')}
                                >
                                  <Search className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                                  <span className="hidden sm:inline">{t('support.btn_change_customer', undefined, 'Change')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSelectContact('')}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition border border-transparent hover:border-rose-200 dark:hover:border-rose-900 cursor-pointer"
                                  title={t('support.btn_clear_customer', undefined, 'Remove customer assignment')}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Customer Standard Hourly Rate Badge & Sync */}
                            {assignedContact?.default_hourly_rate !== undefined && assignedContact.default_hourly_rate > 0 ? (
                              <div className="flex items-center justify-between pt-2 border-t border-cyan-100/80 dark:border-cyan-900/40 text-[11px]">
                                <div className="flex items-center gap-1.5 font-semibold text-cyan-800 dark:text-cyan-300">
                                  <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                                  <span>{t('support.customer_standard_rate', undefined, 'Kunden-Stundensatz')}:</span>
                                  <span className="font-mono font-bold">{assignedContact.default_hourly_rate.toFixed(2)} {companyProfile.currency || '€'} / Std.</span>
                                </div>
                                {selectedTicket.hourlyRate !== assignedContact.default_hourly_rate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      sounds.playClick();
                                      updateCurrentTicket({ hourlyRate: assignedContact.default_hourly_rate });
                                    }}
                                    className="text-[10px] font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 underline cursor-pointer"
                                    title="Stundensatz des Kunden in diesen Auftrag übernehmen"
                                  >
                                    Übernehmen
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <div 
                          onClick={() => setIsCustomerPickerOpen(true)}
                          className="p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20 hover:border-cyan-300 dark:hover:border-cyan-700 transition flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-950/80 text-slate-500 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 flex items-center justify-center shrink-0 transition">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition truncate">
                                {t('support.no_customer_assigned_title', undefined, 'No customer assigned')}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {t('support.no_customer_assigned_desc', undefined, 'Click to open the customer directory')}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsCustomerPickerOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-2xs transition active:scale-95 cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>{t('support.btn_choose_customer', undefined, 'Select Customer')}</span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* Quick Dropdown Selector for Fast Selection */}
                    <select
                      value={selectedTicket.contact_id !== undefined && selectedTicket.contact_id !== null ? String(selectedTicket.contact_id) : ''}
                      onChange={(e) => handleSelectContact(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 text-xs"
                    >
                      <option value="">{t('support.customer_none', undefined, '– No customer assigned –')}</option>
                      {contacts.map(c => (
                        <option key={String(c.id)} value={String(c.id)}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Contact Person / Name */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.customer_name', undefined, 'Contact Person / Name')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={selectedTicket.contact_name || ''}
                        onChange={(e) => updateCurrentTicket({ contact_name: e.target.value })}
                        placeholder={t('support.customer_name', undefined, 'Contact Person / Name')}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 text-xs"
                      />
                    </div>
                  </div>

                  {/* E-Mail Address */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.customer_email', undefined, 'Email')}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={selectedTicket.contact_email || ''}
                          onChange={(e) => updateCurrentTicket({ contact_email: e.target.value })}
                          placeholder={t('support.customer_email', undefined, 'Email')}
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 text-xs"
                        />
                      </div>
                      {selectedTicket.contact_email && (
                        <a
                          href={`mailto:${selectedTicket.contact_email}?subject=${encodeURIComponent(`[${selectedTicket.ticketNumber}] ${selectedTicket.title}`)}`}
                          className="p-2.5 rounded-xl border border-cyan-200 dark:border-cyan-800/80 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition shrink-0 shadow-2xs"
                          title="Open Email"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.customer_phone', undefined, 'Phone')}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          type="tel"
                          value={selectedTicket.contact_phone || ''}
                          onChange={(e) => updateCurrentTicket({ contact_phone: e.target.value })}
                          placeholder={t('support.customer_phone', undefined, 'Phone')}
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 text-xs"
                        />
                      </div>
                      {selectedTicket.contact_phone && (
                        <a
                          href={`tel:${selectedTicket.contact_phone}`}
                          className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition shrink-0 shadow-2xs"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Firma */}
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('support.customer_company', undefined, 'Company / Organization')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={selectedTicket.contact_company || ''}
                        onChange={(e) => updateCurrentTicket({ contact_company: e.target.value })}
                        placeholder={t('support.customer_company', undefined, 'Company')}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 text-xs"
                      />
                    </div>
                  </div>

                  {/* Stundensatz */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block text-xs">
                        {t('support.label_hourly_rate', undefined, 'Hourly Rate')}
                      </label>
                      {assignedContact?.default_hourly_rate !== undefined && assignedContact.default_hourly_rate > 0 && (
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Kunde: {assignedContact.default_hourly_rate.toFixed(2)} {companyProfile.currency || '€'}</span>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={selectedTicket.hourlyRate ?? 95}
                        onChange={(e) => updateCurrentTicket({ hourlyRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 text-xs"
                      />
                      <span className="absolute right-3 top-2.5 text-slate-400 font-mono text-xs">{companyProfile.currency || '€'}</span>
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
                    
                    {/* Integrated Professional Live-Timer Widget */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0 transition-colors ${
                            selectedTicket.isTimerRunning
                              ? 'bg-rose-600'
                              : (selectedTicket.timerAccumulatedSeconds || 0) > 0
                              ? 'bg-amber-600'
                              : 'bg-slate-700 dark:bg-slate-700'
                          }`}>
                            <Clock className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {selectedTicket.isTimerRunning 
                                  ? t('support.timer_running', undefined, 'Live-Timer läuft...') 
                                  : (selectedTicket.timerAccumulatedSeconds || 0) > 0
                                  ? t('support.timer_paused', undefined, 'Live-Timer pausiert')
                                  : t('support.timesheet_live_timer_title', undefined, '1-Klick Live-Timer')}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold tracking-wider ${
                                selectedTicket.isTimerRunning 
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800' 
                                  : (selectedTicket.timerAccumulatedSeconds || 0) > 0
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                              }`}>
                                {formatTimerDisplay(timerSeconds)}
                              </span>
                              {timerSeconds > 0 && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                  ({(timerSeconds / 3600).toFixed(2)} h)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {formatDetailedTimer(timerSeconds, lang)}
                            </div>
                          </div>
                        </div>

                        {/* Timer Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedTicket.isTimerRunning ? (
                            <>
                              <button
                                type="button"
                                onClick={handlePauseTimer}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition active:scale-95"
                                title={t('support.btn_pause_timer', undefined, 'Pausieren')}
                              >
                                <Pause className="w-3.5 h-3.5" />
                                <span>{t('support.btn_pause_timer', undefined, 'Pausieren')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleStopAndBookTimer}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition active:scale-95"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>{t('support.btn_stop_timer', undefined, 'Stoppen & buchen')}</span>
                              </button>
                            </>
                          ) : (selectedTicket.timerAccumulatedSeconds || 0) > 0 ? (
                            <>
                              <button
                                type="button"
                                onClick={handleResumeTimer}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition active:scale-95"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>{t('support.btn_resume_timer', undefined, 'Fortsetzen')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleStopAndBookTimer}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs transition active:scale-95"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{t('support.btn_stop_timer', undefined, 'Zeit buchen')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleResetTimer}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
                                title={t('support.btn_reset_timer', undefined, 'Zurücksetzen')}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={handleStartTimer}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition active:scale-95"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{t('support.btn_start_timer', undefined, 'Live-Timer starten')}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Work Description field for the Live Timer */}
                      <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
                          <Type className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                          <span>{t('support.label_work_description', undefined, 'Tätigkeitsbeschreibung / Work Description')}:</span>
                        </label>
                        <input
                          type="text"
                          value={liveTimerDescription}
                          onChange={(e) => setLiveTimerDescription(e.target.value)}
                          placeholder={t('support.live_timer_description_placeholder', undefined, 'Woran wird gearbeitet? (z.B. Fehlerdiagnose, Server-Patch, Vor-Ort Montage)...')}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Timesheets Table with Inline Editing */}
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
                            selectedTicket.timesheets.map(ts => {
                              const isEditing = editingTimesheetId === ts.id;
                              return (
                                <tr key={ts.id} className={isEditing ? "bg-cyan-50/50 dark:bg-cyan-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}>
                                  {isEditing ? (
                                    <>
                                      <td className="py-2 px-2">
                                        <input
                                          type="date"
                                          value={editTsDate}
                                          onChange={(e) => setEditTsDate(e.target.value)}
                                          className="w-full px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-mono"
                                        />
                                      </td>
                                      <td className="py-2 px-2">
                                        <input
                                          type="text"
                                          value={editTsStaff}
                                          onChange={(e) => setEditTsStaff(e.target.value)}
                                          list={`staff-list-edit-${ts.id}`}
                                          placeholder={t('support.th_staff', undefined, 'Staff')}
                                          className="w-full px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-medium"
                                        />
                                        <datalist id={`staff-list-edit-${ts.id}`}>
                                          {effectiveStaffList.map(s => (
                                            <option key={s} value={s} />
                                          ))}
                                        </datalist>
                                      </td>
                                      <td className="py-2 px-2">
                                        <input
                                          type="text"
                                          value={editTsDesc}
                                          onChange={(e) => setEditTsDesc(e.target.value)}
                                          placeholder={t('support.th_work_done', undefined, 'Work description...')}
                                          className="w-full px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs"
                                        />
                                      </td>
                                      <td className="py-2 px-2 text-right">
                                        <input
                                          type="number"
                                          step="0.25"
                                          min="0.05"
                                          value={editTsHours}
                                          onChange={(e) => setEditTsHours(e.target.value)}
                                          className="w-20 px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-mono text-right"
                                        />
                                      </td>
                                      <td className="py-2 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleSaveEditTimesheet(ts.id)}
                                            className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition"
                                            title={t('support.save_edit', undefined, 'Speichern')}
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={handleCancelEditTimesheet}
                                            className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition"
                                            title={t('support.cancel_edit', undefined, 'Abbrechen')}
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-2.5 px-3 font-mono">{formatDate(ts.date)}</td>
                                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                                        {ts.staff || <span className="text-slate-400 italic">–</span>}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                        {ts.description || <span className="text-slate-400 italic">–</span>}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                                        {Number(ts.hours).toFixed(2)} h
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditTimesheet(ts)}
                                            className="p-1 hover:text-cyan-600 text-slate-400 transition"
                                            title={t('support.edit_timesheet', undefined, 'Eintrag bearbeiten')}
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTimesheet(ts.id)}
                                            className="p-1 hover:text-rose-600 text-slate-400 transition"
                                            title={t('support.delete_timesheet', undefined, 'Eintrag löschen')}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })
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
                        <span>{t('support.btn_manual_entry', undefined, 'Manuelle Zeiterfassung')}</span>
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
                            {effectiveStaffList.map(staff => (
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

          {/* Draggable Splitter Handle between Form and Chatter (Slim & Clean) */}
          {isChatterVisible && (
            <div
              onMouseDown={handleSplitterMouseDown}
              className={`hidden md:flex items-center justify-center w-[3px] cursor-col-resize group shrink-0 select-none transition-colors relative z-20 ${
                isDraggingSplitter
                  ? 'bg-cyan-500'
                  : 'bg-slate-200 hover:bg-cyan-500/80 dark:bg-slate-800 dark:hover:bg-cyan-500/80'
              }`}
              title={t('support.drag_resize_chatter', undefined, 'Drag to resize logbook and notes')}
            >
              <div className="w-full h-8 rounded-full bg-slate-400/60 group-hover:bg-cyan-400 dark:bg-slate-600 transition-colors" />
            </div>
          )}

          {/* Right Column: Internal Logbook & Activity Chatter */}
          {isChatterVisible && (
            <div 
              style={{ width: `${chatterWidth}px` }}
              className="w-full max-w-full md:max-w-[70%] bg-slate-50 dark:bg-slate-950 flex flex-col border-t md:border-t-0 border-slate-200/80 dark:border-slate-800 min-h-0 shrink-0"
            >
              
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

                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80" title="Total Entries">
                  {selectedTicket.activities.length} {selectedTicket.activities.length === 1 ? 'entry' : 'entries'}
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
          )}

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
                ...(!tempSettings.disableTeams ? [
                  { key: 'teams', label: `${t('support.settings_tab_teams', undefined, 'Teams')} (${teams.length})`, icon: Users },
                  { key: 'staff', label: `${t('support.settings_tab_staff', undefined, 'Staff')} (${staffList.length})`, icon: User }
                ] : [])
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

                  {/* Solo Mode / Keine Teams Toggle */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span>{t('support.solo_mode_toggle_title', undefined, 'Solo-Modus / Keine Teams (Nur ich)')}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t('support.solo_mode_toggle_desc', undefined, 'Deaktiviert Teams & Mitarbeiter für eine kompakte Ansicht ohne Team-Overhead.')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={tempSettings.disableTeams || false}
                        onChange={(e) => setTempSettings({ ...tempSettings, disableTeams: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-600"></div>
                    </label>
                  </div>

                  {/* Default Team (Hidden in Solo Mode) */}
                  {!tempSettings.disableTeams && (
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
                  )}

                  {/* Default Staff (Hidden in Solo Mode) */}
                  {!tempSettings.disableTeams && (
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        {t('support.settings_default_staff_label', undefined, 'Default Staff')}
                      </label>
                      <select
                        value={tempSettings.defaultStaff}
                        onChange={(e) => setTempSettings({ ...tempSettings, defaultStaff: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500"
                      >
                        {effectiveStaffList.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
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

      {/* Searchable In-App Customer Picker Modal */}
      <CustomerPickerModal
        isOpen={isCustomerPickerOpen}
        onClose={() => setIsCustomerPickerOpen(false)}
        contacts={contacts}
        selectedContactId={selectedTicket?.contact_id}
        onSelectContact={(contact) => {
          handleSelectContact(contact);
        }}
        onContactsChange={onRefreshContacts}
        currency={companyProfile.currency || '€'}
      />

      {/* Direct Contact Edit/Create Modal from Ticket View */}
      <ContactEditModal
        isOpen={isDirectContactEditOpen}
        onClose={() => {
          setIsDirectContactEditOpen(false);
          setDirectContactToEdit(null);
        }}
        contact={directContactToEdit}
        currency={companyProfile.currency || '€'}
        onSaveSuccess={(savedContact) => {
          setIsDirectContactEditOpen(false);
          setDirectContactToEdit(null);
          onRefreshContacts?.();
          // Update the selected ticket's contact info and hourly rate if this is the assigned contact
          if (selectedTicket && (!selectedTicket.contact_id || String(selectedTicket.contact_id) === String(savedContact.id))) {
            handleSelectContact(savedContact);
          }
        }}
      />
    </div>
  );
};
