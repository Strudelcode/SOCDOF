import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Receipt, 
  UserPlus, 
  PackagePlus, 
  ArrowDownToLine, 
  Sparkles,
  Grid,
  ShoppingCart,
  ShoppingBag,
  Clock,
  Trash2,
  Sliders,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Building2,
  ChevronDown,
  Command,
  Bell,
  CheckCircle2
} from 'lucide-react';
import { ActiveModule, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';

interface TopBarProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  onQuickAction: (action: 'new_invoice' | 'new_contact' | 'new_product' | 'new_stock_move' | 'new_purchase') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isCleanMode: boolean;
  onToggleCleanMode: (enableClean: boolean) => void;
  company: CompanyProfile;
  onOpenStudio: () => void;
  onOpenCommandPalette: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isMuted: boolean;
  onToggleSound: () => void;
  totalRecordsCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeModule,
  onSelectModule,
  onQuickAction,
  searchQuery,
  onSearchChange,
  isCleanMode,
  onToggleCleanMode,
  company,
  onOpenStudio,
  onOpenCommandPalette,
  isDark,
  onToggleTheme,
  isMuted,
  onToggleSound,
  totalRecordsCount
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const getModuleMeta = () => {
    switch (activeModule) {
      case 'launcher':
        return { name: 'App Übersicht', parent: 'SOCDOF' };
      case 'dashboard':
        return { name: 'Dashboard & Berichte', parent: 'Analytics' };
      case 'contacts':
        return { name: 'CRM & Kontakte', parent: 'Verkauf' };
      case 'products':
        return { name: 'Artikel & Stammdaten', parent: 'Lager' };
      case 'stock':
        return { name: 'Lagerbuchungen', parent: 'Logistik' };
      case 'invoices':
        return { name: 'Verkauf & Faktura', parent: 'Buchhaltung' };
      case 'pos':
        return { name: 'Point of Sale (Kasse)', parent: 'Verkauf' };
      case 'purchases':
        return { name: 'Einkauf & Beschaffung', parent: 'Beschaffung' };
      case 'settings':
        return { name: 'Einstellungen & Backup', parent: 'Administration' };
      default:
        return { name: 'Übersicht', parent: 'SOCDOF' };
    }
  };

  const meta = getModuleMeta();

  // Get current active color theme from company
  const getHeaderBg = () => {
    switch (company.theme_color) {
      case 'odoo-teal':
        return 'bg-[#017e84] text-white';
      case 'odoo-blue':
        return 'bg-[#1e3a8a] text-white';
      case 'odoo-emerald':
        return 'bg-[#065f46] text-white';
      case 'odoo-dark':
        return 'bg-[#0f172a] text-white';
      case 'odoo-purple':
      default:
        return 'bg-[#714B67] text-white';
    }
  };

  return (
    <header 
      id="top-bar" 
      className={`no-print sticky top-0 z-30 shadow-md ${getHeaderBg()} px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4 transition-all`}
    >
      {/* Left: Odoo App Switcher & Breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* 9-dot Waffle App Switcher Button */}
        <button
          type="button"
          id="topbar-launcher-btn"
          onClick={() => {
            sounds.playClick();
            onSelectModule('launcher');
          }}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition shadow-xs flex items-center justify-center"
          title="SOCDOF App Launcher (Alt+A)"
        >
          <Grid className="w-5 h-5" />
        </button>

        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold tracking-wide text-white/80 hidden sm:inline">
            {company.name || 'SOCDOF Suite'}
          </span>
          <span className="text-white/40 hidden sm:inline">/</span>
          <span className="text-white/70 hidden md:inline">{meta.parent}</span>
          <span className="text-white/40 hidden md:inline">/</span>
          <span className="font-bold text-white tracking-tight text-sm">
            {meta.name}
          </span>
        </div>
      </div>

      {/* Center: Command Palette Trigger & Universal Search */}
      <div className="flex-1 max-w-md mx-2 hidden md:block">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full bg-black/20 hover:bg-black/30 text-white/90 placeholder-white/50 px-3.5 py-1.5 rounded-xl text-xs flex items-center justify-between border border-white/15 transition shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-white/60" />
            <span className="text-white/70">Befehl, Kunde, Artikel suchen...</span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 text-white rounded">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Studio Button (Signature Odoo Feature) */}
        <button
          type="button"
          id="btn-odoo-studio"
          onClick={() => {
            sounds.playClick();
            onOpenStudio();
          }}
          className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/20 transition shadow-xs"
          title="Odoo Studio: Unternehmensdaten, Theme, Steuern & Layouts anpassen"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Studio</span>
        </button>

        {/* Clean Database Status Pill / Reset */}
        <div className="hidden lg:flex items-center">
          {totalRecordsCount === 0 ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
              0 Daten (Produktiv)
            </span>
          ) : (
            <button
              onClick={() => {
                if (confirm('Möchten Sie alle Daten leeren und mit 0,00 € starten?')) {
                  onToggleCleanMode(true);
                }
              }}
              className="px-2 py-0.5 rounded-md bg-amber-500/30 hover:bg-amber-500/50 border border-amber-400/40 text-amber-200 text-[11px] font-medium flex items-center gap-1 transition"
              title="Auf 0 zurücksetzen"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              {totalRecordsCount} Datensätze (Zurücksetzen)
            </button>
          )}
        </div>

        {/* Audio Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs"
          title={isMuted ? 'Audio aktivieren' : 'Audio stummschalten'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>

        {/* Dark/Light Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs"
          title={isDark ? 'Light Mode' : 'Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-white/90" />}
        </button>

        {/* User Avatar Menu */}
        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 pl-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/15"
          >
            <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-bold flex items-center justify-center text-xs shadow-xs">
              M
            </div>
            <span className="hidden xl:inline text-xs font-medium">Mitchell Admin</span>
            <ChevronDown className="w-3 h-3 text-white/70" />
          </button>

          {isUserMenuOpen && (
            <div 
              className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 text-slate-800 dark:text-slate-200 text-xs animate-scale-up"
              onClick={() => setIsUserMenuOpen(false)}
            >
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold block text-slate-900 dark:text-white">Mitchell Admin</span>
                <span className="text-[10px] text-slate-400 font-mono">admin@odoo.local (Superuser)</span>
              </div>
              <button
                onClick={onOpenStudio}
                className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Sliders className="w-3.5 h-3.5 text-purple-600" />
                <span>Odoo Studio Konfigurator</span>
              </button>
              <button
                onClick={() => onSelectModule('settings')}
                className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Firmeneinstellungen & Backup</span>
              </button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
              <button
                onClick={() => onToggleCleanMode(true)}
                className="w-full px-4 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Datenbank auf 0 leeren</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
