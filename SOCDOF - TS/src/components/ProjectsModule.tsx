import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  BarChart3,
  TrendingUp,
  DollarSign,
  Receipt,
  Trash2,
  Edit3,
  ChevronRight,
  Kanban,
  ListFilter,
  Layers,
  Sparkles,
  ArrowRight,
  X,
  Tag,
  Check
} from 'lucide-react';
import { ProjectItem, ProjectTaskItem, CompanyProfile, Contact } from '../types';
import { sounds } from '../lib/sound';
import { useLanguage, t } from '../lib/i18n';

interface ProjectsModuleProps {
  companyProfile: CompanyProfile;
  contacts?: Contact[];
  onCreateInvoiceForProject?: (project: ProjectItem, tasks: ProjectTaskItem[]) => void;
}

export const ProjectsModule: React.FC<ProjectsModuleProps> = ({
  companyProfile,
  contacts = [],
  onCreateInvoiceForProject
}) => {
  const currentLang = useLanguage();
  const currency = companyProfile.currency || 'EUR';

  // Active View: 'portfolio' | 'kanban' | 'tasks'
  const [activeView, setActiveView] = useState<'portfolio' | 'kanban' | 'tasks'>('portfolio');
  const [selectedProjectId, setSelectedProjectId] = useState<string | 'all'>('all');

  // Persistent storage for Projects
  const [projects, setProjects] = useState<ProjectItem[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_projects_data');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Save helper
  const saveProjects = (next: ProjectItem[]) => {
    setProjects(next);
    try { localStorage.setItem('odoo_projects_data', JSON.stringify(next)); } catch {}
  };

  // Modals state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<{ projectId: string; task: ProjectTaskItem | null }>({
    projectId: '',
    task: null
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Project Form State
  const [pTitle, setPTitle] = useState('');
  const [pCode, setPCode] = useState('');
  const [pDescription, setPDescription] = useState('');
  const [pContactId, setPContactId] = useState('');
  const [pCategory, setPCategory] = useState<ProjectItem['category']>('client_work');
  const [pStatus, setPStatus] = useState<ProjectItem['status']>('active');
  const [pPriority, setPPriority] = useState<ProjectItem['priority']>('medium');
  const [pBudget, setPBudget] = useState<number>(0);
  const [pHourlyRate, setPHourlyRate] = useState<number>(95);
  const [pStartDate, setPStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [pDeadline, setPDeadline] = useState('');
  const [pColor, setPColor] = useState('#4f46e5');

  // Task Form State
  const [tProjectId, setTProjectId] = useState('');
  const [tTitle, setTTitle] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tStatus, setTStatus] = useState<ProjectTaskItem['status']>('todo');
  const [tPriority, setTPriority] = useState<ProjectTaskItem['priority']>('medium');
  const [tAssignee, setTAssignee] = useState('');
  const [tEstimatedHours, setTEstimatedHours] = useState<number>(2);
  const [tLoggedHours, setTLoggedHours] = useState<number>(0);
  const [tDueDate, setTDueDate] = useState('');
  const [tBillable, setTBillable] = useState<boolean>(true);

  // Open Project Modal
  const handleOpenProjectModal = (proj?: ProjectItem) => {
    sounds.playClick();
    if (proj) {
      setEditingProject(proj);
      setPTitle(proj.title);
      setPCode(proj.code);
      setPDescription(proj.description || '');
      setPContactId(proj.contactId || '');
      setPCategory(proj.category);
      setPStatus(proj.status);
      setPPriority(proj.priority);
      setPBudget(proj.budget || 0);
      setPHourlyRate(proj.hourlyRate || 95);
      setPStartDate(proj.startDate || new Date().toISOString().split('T')[0]);
      setPDeadline(proj.deadline || '');
      setPColor(proj.color || '#4f46e5');
    } else {
      setEditingProject(null);
      setPTitle('');
      setPCode(`PRJ-${new Date().getFullYear()}-${String(projects.length + 1).padStart(2, '0')}`);
      setPDescription('');
      setPContactId(contacts[0]?.id || '');
      setPCategory('client_work');
      setPStatus('active');
      setPPriority('medium');
      setPBudget(2500);
      setPHourlyRate(95);
      setPStartDate(new Date().toISOString().split('T')[0]);
      setPDeadline('');
      setPColor('#4f46e5');
    }
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pTitle.trim()) {
      sounds.playError?.();
      return;
    }

    const clientContact = contacts.find(c => c.id === pContactId);
    const clientName = clientContact?.name || '';

    sounds.playSuccess();
    if (editingProject) {
      const updated = projects.map(p => p.id === editingProject.id ? {
        ...p,
        title: pTitle.trim(),
        code: pCode.trim() || p.code,
        description: pDescription.trim(),
        contactId: pContactId || undefined,
        clientName: clientName || undefined,
        category: pCategory,
        status: pStatus,
        priority: pPriority,
        budget: Number(pBudget) || 0,
        hourlyRate: Number(pHourlyRate) || 0,
        startDate: pStartDate,
        deadline: pDeadline || undefined,
        color: pColor,
        updatedAt: new Date().toISOString()
      } : p);
      saveProjects(updated);
    } else {
      const newProj: ProjectItem = {
        id: `prj_${Date.now()}`,
        code: pCode.trim() || `PRJ-${Date.now()}`,
        title: pTitle.trim(),
        description: pDescription.trim(),
        contactId: pContactId || undefined,
        clientName: clientName || undefined,
        category: pCategory,
        status: pStatus,
        priority: pPriority,
        budget: Number(pBudget) || 0,
        hourlyRate: Number(pHourlyRate) || 0,
        startDate: pStartDate,
        deadline: pDeadline || undefined,
        color: pColor,
        tasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveProjects([newProj, ...projects]);
    }

    setIsProjectModalOpen(false);
  };

  const handleDeleteProject = (id: string) => {
    sounds.playClick();
    saveProjects(projects.filter(p => p.id !== id));
    if (selectedProjectId === id) setSelectedProjectId('all');
  };

  // Open Task Modal
  const handleOpenTaskModal = (projectId: string, task?: ProjectTaskItem) => {
    sounds.playClick();
    setTProjectId(projectId || projects[0]?.id || '');
    if (task) {
      setEditingTask({ projectId, task });
      setTTitle(task.title);
      setTDescription(task.description || '');
      setTStatus(task.status);
      setTPriority(task.priority);
      setTAssignee(task.assignee || '');
      setTEstimatedHours(task.estimatedHours || 1);
      setTLoggedHours(task.loggedHours || 0);
      setTDueDate(task.dueDate || '');
      setTBillable(task.billable !== false);
    } else {
      setEditingTask({ projectId, task: null });
      setTTitle('');
      setTDescription('');
      setTStatus('todo');
      setTPriority('medium');
      setTAssignee('');
      setTEstimatedHours(2);
      setTLoggedHours(0);
      setTDueDate('');
      setTBillable(true);
    }
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim() || !tProjectId) {
      sounds.playError?.();
      return;
    }

    sounds.playSuccess();
    const targetProj = projects.find(p => p.id === tProjectId);
    if (!targetProj) return;

    if (editingTask.task) {
      const updatedTasks = targetProj.tasks.map(tsk => tsk.id === editingTask.task?.id ? {
        ...tsk,
        title: tTitle.trim(),
        description: tDescription.trim(),
        status: tStatus,
        priority: tPriority,
        assignee: tAssignee.trim(),
        estimatedHours: Number(tEstimatedHours) || 0,
        loggedHours: Number(tLoggedHours) || 0,
        dueDate: tDueDate || undefined,
        billable: tBillable
      } : tsk);

      saveProjects(projects.map(p => p.id === tProjectId ? { ...p, tasks: updatedTasks, updatedAt: new Date().toISOString() } : p));
    } else {
      const newTask: ProjectTaskItem = {
        id: `tsk_${Date.now()}`,
        title: tTitle.trim(),
        description: tDescription.trim(),
        status: tStatus,
        priority: tPriority,
        assignee: tAssignee.trim(),
        estimatedHours: Number(tEstimatedHours) || 0,
        loggedHours: Number(tLoggedHours) || 0,
        dueDate: tDueDate || undefined,
        billable: tBillable,
        createdAt: new Date().toISOString()
      };

      saveProjects(projects.map(p => p.id === tProjectId ? { ...p, tasks: [...p.tasks, newTask], updatedAt: new Date().toISOString() } : p));
    }

    setIsTaskModalOpen(false);
  };

  const handleUpdateTaskStatus = (projectId: string, taskId: string, nextStatus: ProjectTaskItem['status']) => {
    sounds.playPop();
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          tasks: p.tasks.map(t => t.id === taskId ? { ...t, status: nextStatus } : t)
        };
      }
      return p;
    });
    saveProjects(updated);
  };

  const handleDeleteTask = (projectId: string, taskId: string) => {
    sounds.playClick();
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          tasks: p.tasks.filter(t => t.id !== taskId)
        };
      }
      return p;
    });
    saveProjects(updated);
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = p.title.toLowerCase().includes(q) ||
                      p.code.toLowerCase().includes(q) ||
                      (p.clientName && p.clientName.toLowerCase().includes(q)) ||
                      (p.description && p.description.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [projects, statusFilter, categoryFilter, searchQuery]);

  // Active project for Kanban
  const activeKanbanProject = useMemo(() => {
    if (selectedProjectId !== 'all') {
      return projects.find(p => p.id === selectedProjectId) || projects[0];
    }
    return projects[0];
  }, [projects, selectedProjectId]);

  // Metrics
  const metrics = useMemo(() => {
    let totalBudget = 0;
    let totalLoggedHours = 0;
    let totalEstimatedHours = 0;
    let totalTasksCount = 0;
    let completedTasksCount = 0;
    let billableRevenue = 0;

    projects.forEach(p => {
      totalBudget += p.budget || 0;
      const rate = p.hourlyRate || 95;
      p.tasks.forEach(t => {
        totalTasksCount++;
        totalLoggedHours += t.loggedHours || 0;
        totalEstimatedHours += t.estimatedHours || 0;
        if (t.status === 'done') completedTasksCount++;
        if (t.billable) billableRevenue += (t.loggedHours || 0) * rate;
      });
    });

    const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

    return {
      activeProjectsCount: projects.filter(p => p.status === 'active').length,
      totalBudget,
      totalLoggedHours,
      totalEstimatedHours,
      totalTasksCount,
      completedTasksCount,
      completionRate,
      billableRevenue
    };
  }, [projects]);

  // Invoice creation from project tasks
  const handleBillProject = (proj: ProjectItem) => {
    sounds.playClick();
    if (onCreateInvoiceForProject) {
      onCreateInvoiceForProject(proj, proj.tasks);
    } else {
      sounds.playSuccess();
      alert(`Rechnungs-Abrechnung für Projekt "${proj.title}" vorbereitet (${proj.tasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0)} Stunden erfasst).`);
    }
  };

  return (
    <div id="projects-module-root" className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      
      {/* Top Header */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-xs">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('module.projects', currentLang, 'Projekte, Aufgaben & Kanban')}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold border border-blue-300 dark:border-blue-800">
                Portfolio & Billing
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('desc.projects', currentLang, 'Projekt-Portfolio, interaktives Kanban-Board, Meilensteine & Stundenerfassung')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {projects.length > 0 && activeView === 'kanban' && (
            <button
              id="btn-add-task-kanban"
              onClick={() => handleOpenTaskModal(activeKanbanProject?.id || projects[0]?.id)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Aufgabe hinzufügen</span>
            </button>
          )}

          <button
            id="btn-add-project"
            onClick={() => handleOpenProjectModal()}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Projekt</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Aktive Projekte</div>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">{metrics.activeProjectsCount} von {projects.length}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Fortschritt</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 truncate">
              {metrics.completionRate}% <span className="text-xs font-normal text-slate-500">({metrics.completedTasksCount}/{metrics.totalTasksCount})</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Erfasste Stunden</div>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">{metrics.totalLoggedHours.toFixed(1)} h</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Abrechenbarer Wert</div>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">{metrics.billableRevenue.toFixed(2)} {currency}</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-4 pt-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
        <button
          onClick={() => { sounds.playClick(); setActiveView('portfolio'); }}
          className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition ${
            activeView === 'portfolio'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Projekt-Portfolio ({filteredProjects.length})</span>
        </button>

        <button
          onClick={() => { sounds.playClick(); setActiveView('kanban'); }}
          className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition ${
            activeView === 'kanban'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Kanban className="w-4 h-4" />
          <span>Aufgaben-Kanban Board</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        
        {/* VIEW 1: PROJEKT-PORTFOLIO */}
        {activeView === 'portfolio' && (
          <div className="space-y-4">
            
            {/* Search and Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Projekte durchsuchen (Name, Code, Kunde)..."
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); sounds.playClick(); }}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold"
                >
                  <option value="all">Alle Status</option>
                  <option value="active">Aktiv / In Arbeit</option>
                  <option value="planning">Planung</option>
                  <option value="review">Review</option>
                  <option value="completed">Abgeschlossen</option>
                  <option value="on_hold">Pausiert</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); sounds.playClick(); }}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold"
                >
                  <option value="all">Alle Kategorien</option>
                  <option value="client_work">Kundenauftrag</option>
                  <option value="internal">Internes Projekt</option>
                  <option value="development">Entwicklung</option>
                  <option value="consulting">Beratung</option>
                </select>
              </div>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                  <Briefcase className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Keine Projekte vorhanden</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                    Erstellen Sie Kundenprojekte, interne Vorhaben oder Entwicklungssprints mit Aufgaben, Stundensätzen und 1-Klick Abrechnung.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenProjectModal()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  + Erstes Projekt anlegen
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((proj) => {
                  const tasks = proj.tasks || [];
                  const doneTasks = tasks.filter(t => t.status === 'done').length;
                  const progressPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
                  const loggedH = tasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);
                  const rate = proj.hourlyRate || 95;
                  const billableVal = loggedH * rate;

                  return (
                    <div
                      key={proj.id}
                      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-500/50 transition"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
                            {proj.code}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            proj.status === 'active'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : proj.status === 'planning'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : proj.status === 'review'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : proj.status === 'completed'
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {proj.status === 'active' ? 'In Arbeit' : proj.status === 'planning' ? 'Planung' : proj.status === 'review' ? 'Review' : proj.status === 'completed' ? 'Abgeschlossen' : 'Pausiert'}
                          </span>
                        </div>

                        <div className="mt-3">
                          <h4 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                            {proj.title}
                          </h4>
                          {proj.clientName && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <User className="w-3.5 h-3.5" />
                              <span>{proj.clientName}</span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                            <span className="text-slate-500">Aufgaben ({doneTasks}/{tasks.length})</span>
                            <span className="text-slate-900 dark:text-white">{progressPct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Financials Strip */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Budget</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                              {proj.budget ? `${proj.budget.toLocaleString()} ${currency}` : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Erfasst</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                              {loggedH.toFixed(1)} h ({billableVal.toFixed(2)} {currency})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setSelectedProjectId(proj.id);
                            setActiveView('kanban');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1 transition"
                        >
                          <Kanban className="w-3.5 h-3.5" />
                          <span>Board öffnen</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleBillProject(proj)}
                            title="1-Klick Abrechnung in Rechnung"
                            className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 transition"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenProjectModal(proj)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(proj.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: INTERAKTIVES KANBAN BOARD */}
        {activeView === 'kanban' && (
          <div className="space-y-4 h-full flex flex-col">
            
            {/* Project Switcher Bar */}
            <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">Aktuelles Projekt:</span>
                <select
                  value={activeKanbanProject?.id || ''}
                  onChange={(e) => { setSelectedProjectId(e.target.value); sounds.playClick(); }}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-bold"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.title}</option>
                  ))}
                </select>
              </div>

              {activeKanbanProject && (
                <button
                  onClick={() => handleOpenTaskModal(activeKanbanProject.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Aufgabe anlegen</span>
                </button>
              )}
            </div>

            {/* Kanban Columns (To Do, In Progress, Review, Done) */}
            {!activeKanbanProject ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500">Bitte legen Sie zuerst ein Projekt an.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 items-start">
                {(['todo', 'in_progress', 'review', 'done'] as ProjectTaskItem['status'][]).map((colStatus) => {
                  const colTasks = activeKanbanProject.tasks.filter(t => t.status === colStatus);
                  const colTitles = {
                    todo: { label: 'To Do (Offen)', color: 'bg-slate-500', countBg: 'bg-slate-200 dark:bg-slate-700' },
                    in_progress: { label: 'In Bearbeitung', color: 'bg-blue-500', countBg: 'bg-blue-100 dark:bg-blue-900/50' },
                    review: { label: 'In Prüfung / Review', color: 'bg-amber-500', countBg: 'bg-amber-100 dark:bg-amber-900/50' },
                    done: { label: 'Erledigt (Done)', color: 'bg-emerald-500', countBg: 'bg-emerald-100 dark:bg-emerald-900/50' }
                  }[colStatus];

                  return (
                    <div
                      key={colStatus}
                      className="bg-slate-100/70 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col space-y-3 min-h-[320px]"
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${colTitles.color}`} />
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">{colTitles.label}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colTitles.countBg} text-slate-700 dark:text-slate-300`}>
                          {colTasks.length}
                        </span>
                      </div>

                      {/* Tasks List */}
                      <div className="space-y-2.5 flex-1">
                        {colTasks.length === 0 ? (
                          <div className="p-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-400">
                            Keine Aufgaben
                          </div>
                        ) : (
                          colTasks.map((task) => (
                            <div
                              key={task.id}
                              className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2.5 hover:shadow-md transition"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                                  {task.title}
                                </h5>
                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                                  task.priority === 'urgent'
                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                    : task.priority === 'high'
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}>
                                  {task.priority}
                                </span>
                              </div>

                              {task.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                  {task.description}
                                </p>
                              )}

                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                                  <Clock className="w-3 h-3 text-blue-500" />
                                  <span>{task.loggedHours || 0} / {task.estimatedHours || 0} h</span>
                                </div>

                                {task.assignee && (
                                  <span className="font-medium text-slate-500">{task.assignee}</span>
                                )}
                              </div>

                              {/* Status Transition Quick Actions */}
                              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60">
                                <div className="flex items-center gap-1">
                                  {colStatus !== 'todo' && (
                                    <button
                                      onClick={() => handleUpdateTaskStatus(activeKanbanProject.id, task.id, colStatus === 'done' ? 'review' : colStatus === 'review' ? 'in_progress' : 'todo')}
                                      className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                                      title="Einen Schritt zurück"
                                    >
                                      ◀
                                    </button>
                                  )}
                                  {colStatus !== 'done' && (
                                    <button
                                      onClick={() => handleUpdateTaskStatus(activeKanbanProject.id, task.id, colStatus === 'todo' ? 'in_progress' : colStatus === 'in_progress' ? 'review' : 'done')}
                                      className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-[10px] font-bold text-blue-600 dark:text-blue-400"
                                      title="Nächster Status"
                                    >
                                      Weiter ▶
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenTaskModal(activeKanbanProject.id, task)}
                                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(activeKanbanProject.id, task.id)}
                                    className="p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600"
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
        )}
      </div>

      {/* MODAL 1: Projekt anlegen / bearbeiten */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-blue-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {editingProject ? 'Projekt bearbeiten' : 'Neues Projekt erstellen'}
                </h3>
              </div>
              <button
                onClick={() => setIsProjectModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Projekt-Titel *</label>
                  <input
                    type="text"
                    required
                    value={pTitle}
                    onChange={(e) => setPTitle(e.target.value)}
                    placeholder="Website Relaunch / App Entwicklung"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Projekt-Code</label>
                  <input
                    type="text"
                    value={pCode}
                    onChange={(e) => setPCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kunde / Auftraggeber</label>
                <select
                  value={pContactId}
                  onChange={(e) => setPContactId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold"
                >
                  <option value="">Kein spezifischer Kunde (Intern)</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.city || 'Kunde'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kategorie</label>
                  <select
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="client_work">Kundenauftrag</option>
                    <option value="internal">Intern</option>
                    <option value="development">Software & IT</option>
                    <option value="consulting">Beratung & Coaching</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={pStatus}
                    onChange={(e) => setPStatus(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="active">Aktiv / In Bearbeitung</option>
                    <option value="planning">In Planung</option>
                    <option value="review">In Prüfung (Review)</option>
                    <option value="completed">Abgeschlossen</option>
                    <option value="on_hold">Pausiert</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Projektbudget ({currency})</label>
                  <input
                    type="number"
                    value={pBudget}
                    onChange={(e) => setPBudget(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Stundensatz ({currency}/h)</label>
                  <input
                    type="number"
                    value={pHourlyRate}
                    onChange={(e) => setPHourlyRate(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Startdatum</label>
                  <input
                    type="date"
                    value={pStartDate}
                    onChange={(e) => setPStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Deadline / Fälligkeit</label>
                  <input
                    type="date"
                    value={pDeadline}
                    onChange={(e) => setPDeadline(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Beschreibung / Projektziel</label>
                <textarea
                  rows={2}
                  value={pDescription}
                  onChange={(e) => setPDescription(e.target.value)}
                  placeholder="Zielsetzung, Meilensteine und besondere Anforderungen..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition"
                >
                  Projekt speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Aufgabe anlegen / bearbeiten */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-blue-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Kanban className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {editingTask.task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe erstellen'}
                </h3>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Aufgaben-Titel *</label>
                <input
                  type="text"
                  required
                  value={tTitle}
                  onChange={(e) => setTTitle(e.target.value)}
                  placeholder="Design Entwurf erstellen, API Endpunkt bauen..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={tStatus}
                    onChange={(e) => setTStatus(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="todo">To Do (Offen)</option>
                    <option value="in_progress">In Bearbeitung</option>
                    <option value="review">In Review</option>
                    <option value="done">Erledigt (Done)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Priorität</label>
                  <select
                    value={tPriority}
                    onChange={(e) => setTPriority(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Hoch</option>
                    <option value="urgent">Dringend (Urgent)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Zugewiesen an (Assignee)</label>
                  <input
                    type="text"
                    value={tAssignee}
                    onChange={(e) => setTAssignee(e.target.value)}
                    placeholder="Mitarbeiter Name"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Fälligkeitsdatum</label>
                  <input
                    type="date"
                    value={tDueDate}
                    onChange={(e) => setTDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Geschätzte Stunden</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tEstimatedHours}
                    onChange={(e) => setTEstimatedHours(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Erfasste Ist-Stunden</label>
                  <input
                    type="number"
                    step="0.25"
                    value={tLoggedHours}
                    onChange={(e) => setTLoggedHours(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="tBillableCheck"
                  checked={tBillable}
                  onChange={(e) => setTBillable(e.target.checked)}
                  className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="tBillableCheck" className="font-semibold text-slate-700 dark:text-slate-300 select-none">
                  Abrechenbare Zeit (Auf Rechnung ausweisen)
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Notizen / Details</label>
                <textarea
                  rows={2}
                  value={tDescription}
                  onChange={(e) => setTDescription(e.target.value)}
                  placeholder="Aufgaben-Beschreibung..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition"
                >
                  Aufgabe speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
