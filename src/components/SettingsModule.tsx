import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Building2, 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  Volume2, 
  VolumeX,
  Check, 
  AlertCircle, 
  Sparkles, 
  CreditCard, 
  FileJson, 
  FileText, 
  Image as ImageIcon, 
  FolderOpen, 
  UserCheck, 
  HardDrive, 
  ShieldAlert, 
  AlertTriangle, 
  FileCheck, 
  HelpCircle, 
  Eye, 
  Trash2, 
  Monitor, 
  ShieldCheck, 
  Laptop, 
  Terminal,
  Palette,
  Sun,
  Moon,
  Globe,
  Calendar as CalendarIcon,
  Link2,
  Share2,
  Search,
  ChevronRight,
  Sliders,
  Layers,
  Clock,
  ExternalLink,
  CheckCircle2,
  Copy,
  Plus,
  Github,
  MessageSquare,
  FolderTree,
  LayoutGrid,
  Save,
  Type,
  Wallpaper
} from 'lucide-react';
import { CompanyProfile, Invoice } from '../types';
import { FlagIcon } from './FlagIcon';
import { db, exportDatabaseToJson, importDatabaseFromJson, resetDatabaseToDemo, clearDatabaseToEmpty, getDatabaseStorageStats } from '../lib/db';
import { sounds } from '../lib/sound';
import { ACCENT_LIST, applyAccentColor, getAccentPreset } from '../lib/accent';
import { SUPPORTED_LANGUAGES, setLanguage, useLanguage, t } from '../lib/i18n';
import { APP_VERSION, APP_NAME, APP_AUTHOR, APP_LOCATION, APP_COPYRIGHT } from '../lib/version';
import { downloadWindowsInstallerPackage } from '../lib/windowsExeDownloader';

interface SettingsModuleProps {
  company: CompanyProfile;
  onUpdateCompany: (updated: CompanyProfile) => void;
  onFullReset: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  isMuted?: boolean;
  onToggleSound?: () => void;
  invoices?: Invoice[];
  onOpenWindowsModal?: () => void;
}

type SettingsSection = 
  | 'home'
  | 'general'
  | 'personalization'
  | 'language'
  | 'connections'
  | 'letterhead'
  | 'storage'
  | 'audio'
  | 'windows'
  | 'danger';

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  company,
  onUpdateCompany,
  onFullReset,
  isDark = false,
  onToggleTheme,
  isMuted = false,
  onToggleSound,
  invoices = [],
  onOpenWindowsModal
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<CompanyProfile>({ ...company });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Storage stats
  const [storageStats, setStorageStats] = useState<{
    sizeBytes: number;
    sizeKB: number;
    sizeMB: number;
    totalRecords: number;
  }>({ sizeBytes: 0, sizeKB: 0, sizeMB: 0, totalRecords: 0 });

  const currentLang = useLanguage();
  const activeLang = profile.language || currentLang;

  // Delete Warning Confirmation Dialog State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationWord, setDeleteConfirmationWord] = useState('');

  // Small file export preference
  const [exportCompact, setExportCompact] = useState(true);

  // Recent Searches / Quick Links list
  const recentSearches = [
    { id: 'personalization', title: 'Dunkelmodus & Design', category: 'Personalisierung', icon: Palette, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/60' },
    { id: 'language', title: 'Sprache & Region', category: 'Sprache & Zeit', icon: Globe, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/60' },
    { id: 'connections', title: 'Google Kalender & iCal', category: 'Verbindungen', icon: CalendarIcon, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/60' },
    { id: 'letterhead', title: 'Briefkopf & DIN 5008', category: 'Dokumente', icon: FileText, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60' },
    { id: 'general', title: 'Bankdaten & IBAN', category: 'Unternehmen', icon: CreditCard, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60' },
    { id: 'storage', title: 'JSON Datensicherung', category: 'Speicher', icon: HardDrive, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60' },
  ];

  useEffect(() => {
    loadStorageInfo();
  }, [company]);

  const loadStorageInfo = async () => {
    try {
      const stats = await getDatabaseStorageStats();
      setStorageStats(stats);
    } catch {
      // ignore
    }
  };

  const handleSaveProfile = async (updates?: Partial<CompanyProfile>) => {
    try {
      const updatedProfile = updates ? { ...profile, ...updates } : profile;
      setProfile(updatedProfile);
      
      if (updatedProfile.accent_color) {
        applyAccentColor(updatedProfile.accent_color);
      }
      if (updatedProfile.language) {
        setLanguage(updatedProfile.language);
      }

      await db.settings.put({ key: 'company_profile', value: updatedProfile });
      onUpdateCompany(updatedProfile);
      sounds.playSuccess();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      loadStorageInfo();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Das Bild ist zu groß. Bitte wählen Sie eine Bilddatei unter 2 MB.');
      sounds.playError();
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const updated = { ...profile, letterhead_photo_url: result, letterhead_show_bg: true };
      setProfile(updated);
      handleSaveProfile(updated);
      sounds.playPhotoUpload();
    };
    reader.readAsDataURL(file);
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Das Hintergrundbild ist zu groß. Bitte wählen Sie eine Bilddatei unter 5 MB.');
      sounds.playError();
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const updated = { ...profile, desktop_wallpaper_url: result };
      setProfile(updated);
      handleSaveProfile(updated);
      sounds.playPhotoUpload();
    };
    reader.readAsDataURL(file);
  };

  const handleExportJson = async () => {
    try {
      sounds.playClick();
      const json = await exportDatabaseToJson({
        pretty: !exportCompact,
        owner: profile.backup_owner || 'System Administrator',
        folder: profile.backup_folder_path || 'C:\\ERP-Daten\\Odoo_Backups'
      });
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `socdof_backup_${(profile.name || 'system').replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      sounds.playSuccess();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    try {
      const text = await file.text();
      await importDatabaseFromJson(text);
      sounds.playImport();
      alert('SOCDOF-Datenbank erfolgreich wiederhergestellt!');
      onFullReset();
      loadStorageInfo();
    } catch (err) {
      console.error(err);
      setImportError('Fehler beim Einlesen der Backup-Datei. Bitte prüfen Sie das JSON-Format.');
      sounds.playError();
    }
  };

  const handleExportCalendarIcs = () => {
    sounds.playClick();
    const calendarEntries: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SOCDOF//DE//Calendar 1.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:SOCDOF Rechnungen & Fristen'
    ];

    // Generate iCal events from active invoices with due dates
    invoices.forEach(inv => {
      const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.date);
      const dtFormatted = dueDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      
      calendarEntries.push('BEGIN:VEVENT');
      calendarEntries.push(`UID:socdof-inv-${inv.id}-${inv.number}@socdof.local`);
      calendarEntries.push(`DTSTAMP:${dtFormatted}`);
      calendarEntries.push(`DTSTART;VALUE=DATE:${dueDate.toISOString().slice(0, 10).replace(/-/g, '')}`);
      calendarEntries.push(`SUMMARY:Fälligkeit ${inv.number} - ${inv.contact_name || 'Kunde'} (${inv.total.toFixed(2)} €)`);
      calendarEntries.push(`DESCRIPTION:SOCDOF Rechnung ${inv.number} fällig am ${inv.due_date || inv.date}. Status: ${inv.status}`);
      calendarEntries.push('STATUS:CONFIRMED');
      calendarEntries.push('END:VEVENT');
    });

    calendarEntries.push('END:VCALENDAR');

    const icsContent = calendarEntries.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `socdof_kalender_${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    sounds.playSuccess();
  };

  const handleCopyGoogleCalUrl = () => {
    sounds.playClick();
    const fakeCalUrl = `webcal://${window.location.host}/api/calendar/socdof-feed.ics`;
    navigator.clipboard.writeText(fakeCalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleExecuteFullDelete = async () => {
    if (deleteConfirmationWord.trim().toUpperCase() !== 'LOESCHEN' && deleteConfirmationWord.trim().toUpperCase() !== 'LÖSCHEN') {
      sounds.playError();
      alert('Bitte geben Sie zur Bestätigung das Wort "LÖSCHEN" ein.');
      return;
    }

    try {
      await clearDatabaseToEmpty();
      sounds.playDelete();
      setIsDeleteModalOpen(false);
      setDeleteConfirmationWord('');
      alert('Alle Daten wurden vollständig und unwiderruflich gelöscht. Das System ist nun im sauberen Ausgangszustand.');
      onFullReset();
      loadStorageInfo();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const isStorageWarning = (profile.max_storage_warning_kb && storageStats.sizeKB > profile.max_storage_warning_kb) || storageStats.sizeKB > 5000;

  // Search filter matching
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();

    const items = [
      { id: 'general', title: 'Unternehmensname & Anschrift', desc: 'Firmenname, Straße, PLZ, Ort, Land', section: 'general' as SettingsSection },
      { id: 'general', title: 'Steuernummer & USt-IdNr', desc: 'Finanzamt, Steuer-ID, USt-Befreiung', section: 'general' as SettingsSection },
      { id: 'general', title: 'Bankverbindung & IBAN / BIC', desc: 'Bankname, IBAN, BIC, Zahlungskonditionen', section: 'general' as SettingsSection },
      { id: 'personalization', title: 'Dunkelmodus / Hellmodus', desc: 'Design, Farbschema, Dark Mode, Light Mode', section: 'personalization' as SettingsSection },
      { id: 'personalization', title: 'Farbakzente & Overlay', desc: 'Akzentfarben, Windows Mica/Glas-Effekt', section: 'personalization' as SettingsSection },
      { id: 'language', title: 'Sprache (Deutsch / Englisch)', desc: 'Systemsprache, Lokalisierung', section: 'language' as SettingsSection },
      { id: 'language', title: 'Währung & Datumsformat', desc: 'Euro (€), Dollar ($), Datumsdarstellung', section: 'language' as SettingsSection },
      { id: 'connections', title: 'Google Kalender Synchronisation', desc: 'Termine, Fristen, Rechnungen mit Google Calendar synchronisieren', section: 'connections' as SettingsSection },
      { id: 'connections', title: 'iCal Kalender-Export (.ics)', desc: 'Apple Kalender, Outlook, Google Cal Feed', section: 'connections' as SettingsSection },
      { id: 'letterhead', title: 'Briefkopf & DIN 5008', desc: 'Logo-Upload, Faltmarken, Fußzeilen', section: 'letterhead' as SettingsSection },
      { id: 'storage', title: 'Datensicherung & JSON Export', desc: 'Vollständiges Backup, Wiederherstellung', section: 'storage' as SettingsSection },
      { id: 'audio', title: 'Soundeffekte & Lautstärke', desc: 'Klicktöne, Bestätigungssounds', section: 'audio' as SettingsSection },
      { id: 'windows', title: 'Windows Desktop-App', desc: 'Lokaler Launcher, Autostart, Offline-App', section: 'windows' as SettingsSection },
      { id: 'danger', title: 'Datenbank zurücksetzen / löschen', desc: 'Demo-Daten laden oder sauberes Zurücksetzen', section: 'danger' as SettingsSection },
    ];

    return items.filter(i => i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
  }, [searchQuery]);

  const navItems: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string; danger?: boolean }[] = [
    { id: 'home', label: t('settings.home', activeLang, 'Startseite'), icon: Settings },
    { id: 'general', label: t('settings.general', activeLang, 'Allgemein & Stammdaten'), icon: Building2 },
    { id: 'personalization', label: t('settings.personalization', activeLang, 'Personalisierung & Farben'), icon: Palette },
    { id: 'language', label: t('settings.language', activeLang, 'Spracheinstellungen & Region'), icon: Globe },
    { id: 'connections', label: t('settings.connections', activeLang, 'Verbindungen & Kalender'), icon: Link2, badge: 'Google Sync' },
    { id: 'letterhead', label: t('settings.letterhead', activeLang, 'Briefkopf & DIN 5008'), icon: FileText },
    { id: 'storage', label: t('settings.storage', activeLang, 'Speicher & Backup'), icon: HardDrive },
    { id: 'audio', label: t('settings.audio', activeLang, 'Sound & Audio'), icon: Volume2 },
    { id: 'windows', label: t('settings.windows', activeLang, 'Windows Desktop-App'), icon: Monitor },
    { id: 'danger', label: t('settings.danger', activeLang, 'System zurücksetzen'), icon: ShieldAlert, danger: true }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in text-slate-900 dark:text-slate-100">
      
      {/* 1. Windows 11 Inspired Top Navigation & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md font-bold text-lg shrink-0">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  SOCDOF Einstellungen
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  Windows 11 Flow
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile.name || 'Lokales Unternehmen'} • Alle Einstellungen werden sicher lokal gespeichert
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Einstellung suchen (z.B. Kalender, Sprache, Dunkelmodus)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Live Search Results Popup / Panel if searching */}
        {searchResults && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-fade-in">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Gefundene Einstellungen ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">Keine passenden Einstellungen gefunden.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchResults.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      sounds.playClick();
                      setActiveSection(r.section);
                      setSearchQuery('');
                    }}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-700/60 text-left transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {r.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {r.desc}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Main Two-Column Layout (Windows Settings Style Sidebar + Content) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Sidebar Navigation */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3 shadow-xs space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    sounds.playClick();
                    setActiveSection(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                    isActive
                      ? item.danger
                        ? 'bg-rose-600 text-white shadow-xs font-bold'
                        : 'text-white shadow-xs font-bold'
                      : item.danger
                      ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  style={isActive && !item.danger ? { backgroundColor: 'var(--accent, #4f46e5)' } : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick System Status Card & Community Links */}
          <div className="p-4 rounded-3xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-3 text-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
              <span>{t('status.system_title', activeLang, 'System-Status')}</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {t('status.local_active', activeLang, 'Lokal aktiv')}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 pb-1 border-b border-slate-200 dark:border-slate-700/60">
              <div>{t('status.version_label', activeLang, 'Version:')} <span className="font-mono font-bold">{APP_NAME} v{APP_VERSION}</span></div>
              <div>{t('status.storage_label', activeLang, 'Speicher:')} <span className="font-mono font-bold">{storageStats.sizeKB} KB</span> ({storageStats.totalRecords} {t('status.records_label', activeLang, 'Datensätze')})</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                {APP_COPYRIGHT} • {APP_AUTHOR} ({APP_LOCATION})
              </div>
            </div>

            {/* Open Source & Support Links */}
            <div className="space-y-1.5 pt-0.5">
              <a
                href="https://github.com/Strudelcode/SOCDOF"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-800 dark:text-slate-200 text-[11px] font-semibold transition group"
              >
                <div className="flex items-center gap-2">
                  <Github className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                  <span>GitHub Repository</span>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
              </a>

              <a
                href="https://discord.gg/QW85EaXTgB"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-[#5865F2] dark:text-indigo-300 text-[11px] font-semibold transition group"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Hilfe auf Discord</span>
                </div>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>

          {/* Quick Manual Save Button at bottom left */}
          <button
            type="button"
            onClick={() => handleSaveProfile()}
            className="w-full py-3 px-4 rounded-2xl text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 active:scale-98 hover:brightness-110"
            style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
          >
            <Save className="w-4 h-4" />
            <span>Einstellungen jetzt speichern</span>
          </button>
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-8 space-y-6">

          {/* SECTION: HOME / OVERVIEW (Recent Searches & Quick Tiles) */}
          {activeSection === 'home' && (
            <div className="space-y-6">
              
              {/* Windows 11 Profile Banner */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white shadow-md border border-indigo-800/40 relative overflow-hidden">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl font-bold">
                      {profile.name ? profile.name.slice(0, 2).toUpperCase() : 'SO'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{profile.name || 'Ihr Unternehmen'}</h3>
                      <p className="text-xs text-indigo-200">{profile.email || 'Keine E-Mail hinterlegt'} • {profile.city || 'Deutschland'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          100% Offline & Kostenlos
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white">
                          DIN 5008 bereit
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveSection('general')}
                    className="px-4 py-2 bg-white text-indigo-950 hover:bg-indigo-50 font-bold text-xs rounded-xl transition shadow-xs self-start sm:self-auto"
                  >
                    Profil anpassen
                  </button>
                </div>
              </div>

              {/* Zuletzt gesucht & Empfohlene Einstellungen (Windows Inspired) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Zuletzt gesucht & Schnelleinstieg</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Häufig verwendete Einstellungen und Personalisierungsoptionen auf einen Blick:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recentSearches.map((tile) => {
                    const Icon = tile.icon;
                    return (
                      <button
                        key={tile.id}
                        onClick={() => {
                          sounds.playClick();
                          setActiveSection(tile.id as SettingsSection);
                        }}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-700/60 text-left transition group flex items-start gap-3.5"
                      >
                        <div className={`p-2.5 rounded-xl ${tile.color} shrink-0 group-hover:scale-105 transition-transform`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                            {tile.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {tile.category}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Preferences Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Dark Mode Quick Toggle */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {isDark ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                    <span className="text-xs font-bold">{isDark ? 'Dunkelmodus' : 'Hellmodus'}</span>
                  </div>
                  <button
                    onClick={onToggleTheme}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      isDark ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    Wechseln
                  </button>
                </div>

                {/* Sound Quick Toggle */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
                    <span className="text-xs font-bold">{isMuted ? 'Stumm' : 'Sounds an'}</span>
                  </div>
                  <button
                    onClick={onToggleSound}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      !isMuted ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {isMuted ? 'Aktivieren' : 'Stumm'}
                  </button>
                </div>

                {/* Google Cal Link Quick Tile */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CalendarIcon className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold">Google Cal</span>
                  </div>
                  <button
                    onClick={() => setActiveSection('connections')}
                    className="px-2.5 py-1 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-xs font-semibold transition"
                  >
                    Sync
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: GENERAL (Unternehmensprofil & Stammdaten) */}
          {activeSection === 'general' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      Unternehmensdaten & Finanzen
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Stammdaten Ihres Unternehmens für Rechnungen, Angebote und Kassenbelege.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Firmenname *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="z.B. Strudel's Test GmbH"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Rechtsform
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. GmbH"
                      value={profile.legal_form}
                      onChange={(e) => setProfile({ ...profile, legal_form: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Straße & Hausnummer
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. Strudelstreet 99"
                      value={profile.street}
                      onChange={(e) => setProfile({ ...profile, street: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      PLZ & Ort
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. 12345 Strudelstadt"
                      value={profile.zip_city}
                      onChange={(e) => setProfile({ ...profile, zip_city: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Land
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. Deutschland"
                      value={profile.country}
                      onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      E-Mail-Adresse
                    </label>
                    <input
                      type="email"
                      placeholder="buchhaltung@strudels-test.example"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Telefonnummer
                    </label>
                    <input
                      type="text"
                      placeholder="+00 12 3456 789"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Bank & Tax Details */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Bankverbindung & Steuer-Identifikation</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        USt-IdNr. / Steuernummer
                      </label>
                      <input
                        type="text"
                        placeholder="AB 123 456 789"
                        value={profile.tax_id}
                        onChange={(e) => setProfile({ ...profile, tax_id: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Bankname / Kreditinstitut
                      </label>
                      <input
                        type="text"
                        placeholder="z.B. StrudelBank DE"
                        value={profile.bank_name}
                        onChange={(e) => setProfile({ ...profile, bank_name: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        IBAN (wird für EPC-QR GiroCode genutzt)
                      </label>
                      <input
                        type="text"
                        placeholder="DE00 1234 5678 9012 3456 78"
                        value={profile.iban}
                        onChange={(e) => setProfile({ ...profile, iban: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        BIC / SWIFT
                      </label>
                      <input
                        type="text"
                        placeholder="STRUDELXXX"
                        value={profile.bic}
                        onChange={(e) => setProfile({ ...profile, bic: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Änderungen speichern</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION: PERSONALIZATION & COLORS (Overlay, Dark Mode, Colors) */}
          {activeSection === 'personalization' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {t('settings.personalization_title', activeLang, 'Personalisierung & Farbschema (Windows-Stil)')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('settings.personalization_desc', activeLang, 'Passen Sie das Erscheinungsbild, Akzentfarben und Fenstereffekte an.')}
                  </p>
                </div>
              </div>

              {/* 1. Theme Mode: Light / Dark */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-900 dark:text-white block">
                  {t('settings.theme_mode', activeLang, 'Design-Modus auswählen')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (isDark && onToggleTheme) onToggleTheme();
                      handleSaveProfile({ theme_mode: 'light' });
                    }}
                    className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                      !isDark 
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-2 ring-indigo-500/20' 
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{t('settings.light_mode', activeLang, 'Hellmodus (Light)')}</div>
                        <div className="text-[11px] text-slate-500">{t('settings.light_mode_desc', activeLang, 'Klarer, kontrastreicher Hintergrund')}</div>
                      </div>
                    </div>
                    {!isDark && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isDark && onToggleTheme) onToggleTheme();
                      handleSaveProfile({ theme_mode: 'dark' });
                    }}
                    className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                      isDark 
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-2 ring-indigo-500/20' 
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-purple-900 text-purple-200">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{t('settings.dark_mode', activeLang, 'Dunkelmodus (Dark)')}</div>
                        <div className="text-[11px] text-slate-500">{t('settings.dark_mode_desc', activeLang, 'Augenschonender Windows-Dark Look')}</div>
                      </div>
                    </div>
                    {isDark && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                  </button>
                </div>
              </div>

              {/* 2. Glass Overlay / Windows Mica Effect Toggle */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      <span>{t('settings.mica_glass', activeLang, 'Windows Mica / Acryl Glas-Overlay')}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {t('settings.mica_glass_desc', activeLang, 'Subtiler Weichzeichner und transparente Titelleisten für ein natives Desktop-Gefühl.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !profile.glass_overlay;
                      handleSaveProfile({ glass_overlay: next });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                      profile.glass_overlay !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      profile.glass_overlay !== false ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* 3. Accent Colors & Color Picasso */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" style={{ color: 'var(--accent, #4f46e5)' }} />
                      <span>System-Akzentfarbe & Color Picasso</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Wird sofort systemweit auf Fensterleisten, Buttons, Badges und Taskleiste angewendet.
                    </p>
                  </div>
                  <span 
                    className="px-2.5 py-1 rounded-lg text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
                    style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Aktiv</span>
                  </span>
                </div>

                {/* Color Picasso Custom Color Palette Picker */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-pink-50/50 dark:from-slate-800/80 dark:via-indigo-950/40 dark:to-slate-800/80 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs"
                        style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                      >
                        <Palette className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Color Picasso Farbwähler</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                            HEX / RGB
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Eigene Akzentfarbe nach Wunsch frei definieren & speichern
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                        <input
                          type="color"
                          id="picasso-color-picker"
                          value={(profile.accent_color?.startsWith('#') ? profile.accent_color : profile.accent_color?.startsWith('custom_') ? `#${profile.accent_color.replace('custom_', '')}` : '#4f46e5')}
                          onChange={(e) => {
                            const newHex = e.target.value;
                            handleSaveProfile({ accent_color: `custom_${newHex.replace('#', '')}` });
                          }}
                          className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                          title="Farbwähler öffnen"
                        />
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {profile.accent_color?.startsWith('custom_') 
                            ? `#${profile.accent_color.replace('custom_', '').toUpperCase()}` 
                            : profile.accent_color?.startsWith('#') 
                              ? profile.accent_color.toUpperCase() 
                              : '#4F46E5'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const quickColors = ['#ec4899', '#f97316', '#10b981', '#06b6d4', '#8b5cf6', '#e11d48', '#3b82f6', '#14b8a6'];
                          const randomColor = quickColors[Math.floor(Math.random() * quickColors.length)];
                          handleSaveProfile({ accent_color: `custom_${randomColor.replace('#', '')}` });
                        }}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5 shadow-xs"
                        title="Zufällige Picasso-Farbe generieren"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Zufall</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preset Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {ACCENT_LIST.map(c => {
                    const isSelected = (profile.accent_color || 'indigo') === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSaveProfile({ accent_color: c.id })}
                        className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition group ${
                          isSelected 
                            ? 'border-2 text-slate-950 dark:text-white shadow-sm ring-2 ring-offset-1 dark:ring-offset-slate-900 font-extrabold' 
                            : 'border-slate-200 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100/90 dark:hover:bg-slate-700/90'
                        }`}
                        style={isSelected ? { 
                          borderColor: c.hex, 
                          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(241, 245, 249, 0.95)',
                          '--tw-ring-color': c.ringRgba 
                        } as any : {}}
                      >
                        <div className="flex items-center gap-2.5">
                          <span 
                            className="w-4 h-4 rounded-full shadow-xs shrink-0 ring-1 ring-black/10 dark:ring-white/20 group-hover:scale-110 transition" 
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="truncate text-slate-900 dark:text-slate-100 group-hover:text-black dark:group-hover:text-white font-semibold">
                            {c.label}
                          </span>
                        </div>
                        {isSelected && (
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 shadow-xs"
                            style={{ backgroundColor: c.hex }}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 4. Taskbar / Bottom Bar Color Style */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-indigo-500" style={{ color: 'var(--accent, #4f46e5)' }} />
                      <span>Farbe &amp; Stil der unteren Leiste (Taskbar / Bottom Bar)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Wählen Sie, wie die Leiste am unteren Bildschirmrand gestaltet wird.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'default', label: 'Standard Windows 11', desc: 'Neutrales Hell / Dunkel' },
                      { id: 'accent', label: 'Akzentfarbe getönt', desc: 'Übernimmt die gewählte Farbe' },
                      { id: 'glass', label: 'Acryl Glas', desc: 'Halbtransparent & Weichzeichner' },
                      { id: 'dark', label: 'Tiefschwarz (Dark)', desc: 'Klassisch dunkle Leiste' },
                    ].map(styleOpt => {
                      const isSelected = (profile.taskbar_tint || 'default') === styleOpt.id;
                      return (
                        <button
                          key={styleOpt.id}
                          type="button"
                          onClick={() => handleSaveProfile({ taskbar_tint: styleOpt.id as any })}
                          className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'border-2 text-slate-900 dark:text-white shadow-sm ring-2 ring-offset-1 dark:ring-offset-slate-900 bg-indigo-50/50 dark:bg-indigo-950/30'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                          style={isSelected ? { borderColor: 'var(--accent, #4f46e5)' } : undefined}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{styleOpt.label}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent, #4f46e5)' }} />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{styleOpt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Live Accent Preview Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Live-Vorschau der Farbübernahme:
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      Texte, Buttons, Rahmen &amp; Badges
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Accent colored text */}
                    <span className="text-xs font-extrabold" style={{ color: 'var(--accent, #4f46e5)' }}>
                      Beispiel-Textfarbe (Akzent)
                    </span>

                    {/* Accent button */}
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs transition"
                      style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                    >
                      Aktions-Button
                    </button>

                    {/* Accent badge */}
                    <span 
                      className="px-2.5 py-1 rounded-lg text-xs font-bold border"
                      style={{ 
                        backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.15))',
                        color: 'var(--accent, #4f46e5)',
                        borderColor: 'var(--accent-border, rgba(79, 70, 229, 0.4))'
                      }}
                    >
                      Status-Badge
                    </span>

                    {/* Active Tab Simulation */}
                    <div 
                      className="px-3 py-1 rounded-xl text-xs font-bold border-b-2"
                      style={{ 
                        borderBottomColor: 'var(--accent, #4f46e5)',
                        color: 'var(--accent, #4f46e5)'
                      }}
                    >
                      Aktiver Reiter
                    </div>
                  </div>
                </div>

                {/* 6. Global Font Size Scale Slider */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Type className="w-4 h-4 text-indigo-500" style={{ color: 'var(--accent, #4f46e5)' }} />
                        <span>Schriftgröße & Skalierung (Zoom)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Passen Sie die Gesamt-Schriftgröße des Systems stufenlos an (90% bis 130%).
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-xs">
                      {profile.font_scale || 100}%
                    </span>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <span className="text-xs text-slate-500">A</span>
                    <input
                      type="range"
                      min="90"
                      max="130"
                      step="5"
                      value={profile.font_scale || 100}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleSaveProfile({ font_scale: val });
                      }}
                      className="flex-1 accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                    />
                    <span className="text-base font-bold text-slate-800 dark:text-slate-200">A</span>
                    <button
                      type="button"
                      onClick={() => handleSaveProfile({ font_scale: 100 })}
                      className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      100% Reset
                    </button>
                  </div>
                </div>

                {/* 7. Custom Desktop Wallpaper Background */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Wallpaper className="w-4 h-4 text-indigo-500" style={{ color: 'var(--accent, #4f46e5)' }} />
                        <span>Desktop-Hintergrundbild (Wallpaper)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Wählen Sie ein eigenes Hintergrundbild für Ihren Arbeitsbereich oder nutzen Sie den Standard-Verlauf.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                    {profile.desktop_wallpaper_url ? (
                      <div className="relative w-28 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                        <img 
                          src={profile.desktop_wallpaper_url} 
                          alt="Wallpaper Preview" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-28 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-[10px] text-slate-400 shrink-0">
                        <Wallpaper className="w-4 h-4 mb-0.5 opacity-60" />
                        <span>Standard</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer px-3.5 py-2 rounded-xl text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs" style={{ backgroundColor: 'var(--accent, #4f46e5)' }}>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Bild hochladen</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleWallpaperUpload}
                          className="hidden"
                        />
                      </label>

                      {profile.desktop_wallpaper_url && (
                        <button
                          type="button"
                          onClick={() => handleSaveProfile({ desktop_wallpaper_url: undefined })}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Hintergrund entfernen</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: LANGUAGE, TIME & REGION */}
          {activeSection === 'language' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-xl">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Sprache, Region & Zeitformat
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Einstellungen für Systemsprache, Währungssymbole und Datumsanzeige.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* 1. Language Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('settings.language_title', activeLang, 'Systemsprache')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { code: 'de', label: 'Deutsch (DE)' },
                      { code: 'en', label: 'English (US)' },
                      { code: 'fr', label: 'Français (FR)' },
                      { code: 'es', label: 'Español (ES)' }
                    ].map(lang => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLanguage(lang.code as any);
                          handleSaveProfile({ language: lang.code as any });
                        }}
                        className={`p-3 rounded-2xl border text-xs font-bold transition flex items-center justify-between ${
                          (profile.language || currentLang) === lang.code
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 shadow-xs ring-1 ring-sky-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <FlagIcon code={lang.code} size="md" />
                          <span>{lang.label}</span>
                        </span>
                        {(profile.language || currentLang) === lang.code && <Check className="w-3.5 h-3.5 text-sky-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Currency & Date Format */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Währungssymbol
                    </label>
                    <select
                      value={profile.currency || '€'}
                      onChange={(e) => handleSaveProfile({ currency: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:outline-none"
                    >
                      <option value="€">EUR (€) - Euro</option>
                      <option value="$">USD ($) - US Dollar</option>
                      <option value="CHF">CHF - Schweizer Franken</option>
                      <option value="£">GBP (£) - Britisches Pfund</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Datumsformat
                    </label>
                    <select
                      value={profile.date_format || 'DD.MM.YYYY'}
                      onChange={(e) => handleSaveProfile({ date_format: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:outline-none font-mono"
                    >
                      <option value="DD.MM.YYYY">DD.MM.YYYY (z.B. 25.08.2026)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO-Standard 2026-08-25)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (US-Standard 08/25/2026)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Time Display & Timezone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        <span>Sekunden in Uhrzeit anzeigen</span>
                      </span>
                    </label>
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {profile.time_show_seconds !== false ? 'Live-Sekunden (HH:MM:SS)' : 'Kompakt (HH:MM)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = profile.time_show_seconds === false ? true : false;
                          handleSaveProfile({ time_show_seconds: next });
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                          profile.time_show_seconds !== false ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          profile.time_show_seconds !== false ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-500" />
                      <span>Zeitzone</span>
                    </label>
                    <select
                      value={profile.timezone || 'Europe/Berlin'}
                      onChange={(e) => handleSaveProfile({ timezone: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-sky-500 focus:outline-none font-mono"
                    >
                      <option value="Europe/Berlin">Europe/Berlin (UTC+1 / MESZ UTC+2) • Standard</option>
                      <option value="Europe/Vienna">Europe/Vienna (Wien, Österreich)</option>
                      <option value="Europe/Zurich">Europe/Zurich (Zürich, Schweiz)</option>
                      <option value="Europe/London">Europe/London (GMT/BST UTC+0/+1)</option>
                      <option value="America/New_York">America/New_York (US Eastern Time)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (US Pacific Time)</option>
                      <option value="UTC">UTC (Universal Time Coordinated)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: CONNECTIONS & GOOGLE CALENDAR */}
          {activeSection === 'connections' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Verbindungen, Google Kalender & Schnittstellen
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Koppeln Sie SOCDOF bei Bedarf mit Google Kalender, Apple iCal oder Microsoft Outlook.
                  </p>
                </div>
              </div>

              {/* 1. Google Calendar 1-Click Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/40 dark:to-slate-800/60 border border-blue-200/80 dark:border-blue-900/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        Google Kalender & iCal Synchronisation
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Exportiert Fälligkeitstermine aller {invoices.length} Rechnungen und Kundentermine.
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border self-start sm:self-auto ${
                    copiedLink 
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}>
                    {copiedLink ? 'Verbunden / Aktiv' : 'Nicht verbunden (Inaktiv)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Action 1: Download .ics */}
                  <button
                    onClick={handleExportCalendarIcs}
                    className="p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 hover:border-blue-500 rounded-xl text-left transition group shadow-xs"
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-blue-600 dark:text-blue-400 group-hover:underline">
                      <Download className="w-4 h-4" />
                      <span>Kalender-Datei (.ics) herunterladen</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Öffnet sich direkt in Google Calendar, Outlook, Thunderbird oder Apple Kalender.
                    </p>
                  </button>

                  {/* Action 2: Copy Live Feed */}
                  <button
                    onClick={handleCopyGoogleCalUrl}
                    className="p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 hover:border-blue-500 rounded-xl text-left transition group shadow-xs"
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-indigo-600 dark:text-indigo-400 group-hover:underline">
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Link kopiert!' : 'Google Kalender Feed-Link kopieren'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      In Google Kalender unter "Anderer Kalender per URL hinzufügen" einfügen.
                    </p>
                  </button>
                </div>
              </div>

              {/* 2. Free Offline REST API / Webhook Integration */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Terminal className="w-4 h-4 text-indigo-500" />
                    <span>Lokale REST & Webhook Schnittstelle</span>
                  </div>
                  <span className="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-950 text-indigo-600 px-2 py-0.5 rounded-md">
                    Port 3000 / localhost
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ermöglicht den lokalen Datenaustausch mit externen Buchhaltungs- oder Lagerprogrammen ohne Cloud-Zwang.
                </p>
              </div>
            </div>
          )}

          {/* SECTION: LETTERHEAD & DIN 5008 */}
          {activeSection === 'letterhead' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Briefkopf & DIN 5008 Briefpapier
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Konfigurieren Sie Ihr Firmenlogo, Faltmarken und die 4 rechtlichen Fußzeilen.
                  </p>
                </div>
              </div>

              {/* Logo / Letterhead Upload Box */}
              <div className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-center space-y-3">
                {profile.letterhead_photo_url ? (
                  <div className="space-y-3">
                    <div className="max-w-xs mx-auto p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                      <img
                        src={profile.letterhead_photo_url}
                        alt="Firmenlogo"
                        className="max-h-24 mx-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <label className="cursor-pointer px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition">
                        <span>Logo ändern</span>
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </label>
                      <button
                        onClick={() => handleSaveProfile({ letterhead_photo_url: undefined, letterhead_show_bg: false })}
                        className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-semibold transition"
                      >
                        Logo entfernen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <ImageIcon className="w-8 h-8 mx-auto text-slate-400" />
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Firmenlogo oder Briefpapier-Vorlage hochladen
                    </div>
                    <p className="text-[11px] text-slate-500">
                      PNG, JPG oder SVG (max. 2 MB). Erscheint auf DIN 5008 Rechnungen.
                    </p>
                    <label className="inline-block cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition mt-2 shadow-xs">
                      <span>Datei auswählen</span>
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  </div>
                )}
              </div>

              {/* DIN 5008 Options */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      DIN 5008 Falt- und Lochmarken anzeigen
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Erleichtert das präzise Falten für Briefumschläge mit Sichtfenster (DIN Lang).
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.letterhead_show_fold_marks !== false}
                    onChange={(e) => handleSaveProfile({ letterhead_show_fold_marks: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                {/* Managing Director & Register */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Geschäftsführung / Inhaber
                    </label>
                    <input
                      type="text"
                      placeholder="Geschäftsführer: Max Mustermann"
                      value={profile.letterhead_managing_director || ''}
                      onChange={(e) => setProfile({ ...profile, letterhead_managing_director: e.target.value })}
                      onBlur={() => handleSaveProfile()}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Handelsregister (HRB / HRA)
                    </label>
                    <input
                      type="text"
                      placeholder="Amtsgericht Berlin HRB 123456"
                      value={profile.letterhead_commercial_register || ''}
                      onChange={(e) => setProfile({ ...profile, letterhead_commercial_register: e.target.value })}
                      onBlur={() => handleSaveProfile()}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4 Footer Lines */}
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white">
                    DIN 5008 4-Spalten Fußzeile (Rechtliche Pflichtangaben)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Spalte 1: Firmenanschrift"
                      value={profile.letterhead_footer_line1 || ''}
                      onChange={(e) => setProfile({ ...profile, letterhead_footer_line1: e.target.value })}
                      onBlur={() => handleSaveProfile()}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Spalte 2: Register & Leitung"
                      value={profile.letterhead_footer_line2 || ''}
                      onChange={(e) => setProfile({ ...profile, letterhead_footer_line2: e.target.value })}
                      onBlur={() => handleSaveProfile()}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Spalte 3: Bankverbindung & IBAN"
                      value={profile.letterhead_footer_line3 || ''}
                      onChange={(e) => setProfile({ ...profile, letterhead_footer_line3: e.target.value })}
                      onBlur={() => handleSaveProfile()}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Spalte 4: Steuernummer & USt-IdNr"
                      value={profile.letterhead_footer_line4 || ''}
                      onChange={(e) => setProfile({ ...profile, letterhead_footer_line4: e.target.value })}
                      onBlur={() => handleSaveProfile()}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: STORAGE & BACKUP */}
          {activeSection === 'storage' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Speicher & Datensicherung (JSON Backup)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sichern Sie Ihre gesamte ERP-Datenbank als handliche JSON-Datei oder stellen Sie ein Backup wieder her.
                  </p>
                </div>
              </div>

              {/* Storage Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-500 block">Speicherplatz</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">{storageStats.sizeKB} KB</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-500 block">Gesamteinträge</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">{storageStats.totalRecords}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-500 block">Format</span>
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">IndexedDB</span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block">Status</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">Gesund</span>
                </div>
              </div>

              {/* Export & Import Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Backup exportieren</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Erstellt eine vollständige Sicherungskopie aller Kunden, Rechnungen, Produkte und Buchungen.
                  </p>
                  <button
                    onClick={handleExportJson}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>JSON Backup herunterladen</span>
                  </button>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">Backup wiederherstellen</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Liest eine zuvor exportierte .json Sicherungsdatei ein und stellt den Zustand wieder her.
                  </p>
                  <label className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Backup-Datei einlesen</span>
                    <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Local Windows Directory & Backup Path Management */}
              <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h4 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                        Lokaler Windows Installations- &amp; Sicherungspfad
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Definieren Sie das Zielverzeichnis für automatische Backups und lokale Datendateien.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadWindowsInstallerPackage({
                      installPath: profile.backup_folder_path?.replace(/\\Backups\\?$/, '') || 'C:\\SOCDOF',
                      createDesktopShortcut: true,
                      createStartMenuShortcut: true,
                      createDataFolders: true
                    })}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Setup-Assistent (.cmd)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Backup-Verzeichnis (z. B. auf externer Festplatte / Netzlaufwerk):
                    </label>
                    <input
                      type="text"
                      placeholder="C:\SOCDOF\Backups"
                      value={profile.backup_folder_path || 'C:\\SOCDOF\\Backups'}
                      onChange={(e) => setProfile({ ...profile, backup_folder_path: e.target.value })}
                      onBlur={() => handleSaveProfile()}
                      className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sicherungsverantwortlicher / Notizen:
                    </label>
                    <input
                      type="text"
                      placeholder="Administrator / IT-Verantwortlicher"
                      value={profile.backup_owner || ''}
                      onChange={(e) => setProfile({ ...profile, backup_owner: e.target.value })}
                      onBlur={() => handleSaveProfile()}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Automatische Ordnerstruktur:</span>
                    <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                      {profile.backup_folder_path || 'C:\\SOCDOF\\Backups'} • \Data • \Exports • \Config
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Lokal &amp; Offline
                  </span>
                </div>
              </div>

              {importError && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{importError}</span>
                </div>
              )}
            </div>
          )}

          {/* SECTION: SOUND & AUDIO */}
          {activeSection === 'audio' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    System-Audio & Soundeffekte
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Akustisches Feedback für Klicks, Bestätigungen, Fensteraktionen und Fehler.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Soundeffekte aktivieren
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Spielt dezente Windows-artige Klick- und Bestätigungstöne ab.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleSound}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    !isMuted ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {!isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  <span>{!isMuted ? 'Aktiviert' : 'Stummgeschaltet'}</span>
                </button>
              </div>

              {/* Sound Test Panel */}
              {!isMuted && (
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold text-slate-900 dark:text-white block">
                    Sound-Vorschau testen
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <button
                      onClick={() => sounds.playClick()}
                      className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                    >
                      Klick-Ton
                    </button>
                    <button
                      onClick={() => sounds.playPop()}
                      className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                    >
                      Pop / Fenster
                    </button>
                    <button
                      onClick={() => sounds.playSuccess()}
                      className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition"
                    >
                      Erfolg
                    </button>
                    <button
                      onClick={() => sounds.playError()}
                      className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-rose-600 dark:text-rose-400 transition"
                    >
                      Fehler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION: WINDOWS DESKTOP APP */}
          {activeSection === 'windows' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Windows Desktop-App &amp; Lokaler Launcher
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Starten Sie SOCDOF direkt von Ihrem Windows-Desktop oder der Taskleiste.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span>Windows Installer (.EXE v18.3.5) &amp; Offline-Modus</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    100% Offline
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  SOCDOF läuft 100% lokal auf Ihrem PC als eigenständige Windows-Desktop App mit voller Unterstützung für Tastaturkürzel (F11, Win+D) und ohne Internetverbindung.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href="https://github.com/Strudelcode/SOCDOF/releases/download/v18/SOCDOF.Setup.18.3.5.exe"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Setup .EXE herunterladen (v18.3.5)</span>
                  </a>

                  {onOpenWindowsModal && (
                    <button
                      onClick={onOpenWindowsModal}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition border border-slate-300 dark:border-slate-700 flex items-center gap-1.5"
                    >
                      <Terminal className="w-4 h-4 text-indigo-500" />
                      <span>Windows Starter &amp; Scripts</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Toggle to disable periodic reminders */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Download-Hinweise / Installations-Erinnerungen
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Deaktiviert periodische Erinnerungen zum Herunterladen der Windows-App.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !profile.disable_exe_reminders;
                    handleSaveProfile({ disable_exe_reminders: next });
                    if (next) {
                      localStorage.setItem('socdof_dismiss_exe_reminder', 'true');
                      localStorage.setItem('socdof_exe_installed', 'true');
                    } else {
                      localStorage.removeItem('socdof_dismiss_exe_reminder');
                      localStorage.removeItem('socdof_exe_installed');
                    }
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    profile.disable_exe_reminders ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    profile.disable_exe_reminders ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* SECTION: DANGER ZONE (Reset / Demo Data) */}
          {activeSection === 'danger' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 shadow-xs p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-rose-100 dark:border-rose-900/40">
                <div className="p-2 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-rose-900 dark:text-rose-200 text-sm">
                    Gefahrenzone: System zurücksetzen
                  </h3>
                  <p className="text-xs text-rose-600/80 dark:text-rose-400/80">
                    Aktionen in diesem Bereich wirken sich direkt auf die gesamte Datenbank aus.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Reset to Demo */}
                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Demo-Datensatz laden
                    </div>
                    <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                      Befüllt das System mit Beispiel-Kunden, Rechnungen und Lagerartikeln zum Testen.
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('Möchten Sie Beispieldaten in das System laden?')) {
                        sounds.playClick();
                        await resetDatabaseToDemo();
                        onFullReset();
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition shadow-xs self-start sm:self-auto"
                  >
                    Demo laden
                  </button>
                </div>

                {/* Hard Reset / Clear Database */}
                <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-rose-900 dark:text-rose-200">
                      Alle Daten vollständig löschen
                    </div>
                    <div className="text-[11px] text-rose-700/80 dark:text-rose-400/80">
                      Setzt die gesamte Datenbank sauber auf 0 zurück (leeres System).
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      sounds.playPop();
                      setIsDeleteModalOpen(true);
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-xs self-start sm:self-auto flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>System leeren</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Windows 11 Action Center Style Settings Saved Toast Notification */}
      {savedSuccess && (
        <div className="fixed bottom-12 right-6 z-50 animate-fade-in select-none">
          <div 
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 flex items-center gap-3 min-w-[280px]"
            style={{ borderColor: 'var(--accent-border, rgba(79, 70, 229, 0.4))' }}
          >
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
              style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Einstellungen gespeichert</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Lokal in IndexedDB gesichert • Sofort aktiv
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Datenbank wirklich leeren?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Diese Aktion löscht alle Kontakte, Rechnungen, Buchungen und Produkte unwiderruflich.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Geben Sie zur Bestätigung <span className="font-mono font-bold text-rose-600">LÖSCHEN</span> ein:
              </label>
              <input
                type="text"
                value={deleteConfirmationWord}
                onChange={(e) => setDeleteConfirmationWord(e.target.value)}
                placeholder="LÖSCHEN"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmationWord('');
                }}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleExecuteFullDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                Unwiderruflich löschen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
