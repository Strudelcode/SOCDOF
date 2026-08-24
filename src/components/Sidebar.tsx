import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ArrowLeftRight, 
  Receipt, 
  Settings, 
  Volume2, 
  VolumeX, 
  Sun, 
  Moon,
  AlertTriangle,
  Boxes,
  ShoppingBag,
  ShoppingCart,
  Grid,
  Sparkles,
  Calculator,
  BookOpen,
  Boxes as AppStoreIcon,
  Utensils
} from 'lucide-react';
import { ActiveModule } from '../types';
import { sounds } from '../lib/sound';

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isMuted: boolean;
  onToggleSound: () => void;
  lowStockCount: number;
  openInvoicesCount: number;
  isCleanMode: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  isDark,
  onToggleTheme,
  isMuted,
  onToggleSound,
  lowStockCount,
  openInvoicesCount,
  isCleanMode
}) => {
  const navItems = [
    {
      id: 'dashboard' as ActiveModule,
      label: 'Übersicht',
      icon: LayoutDashboard,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'invoices' as ActiveModule,
      label: 'Verkauf & Faktura',
      icon: Receipt,
      badge: openInvoicesCount > 0 ? openInvoicesCount : null,
      badgeColor: 'bg-purple-600 text-white'
    },
    {
      id: 'accounting' as ActiveModule,
      label: 'Abrechnung & BWA',
      icon: Calculator,
      badge: 'Neu',
      badgeColor: 'bg-emerald-600 text-white'
    },
    {
      id: 'contacts' as ActiveModule,
      label: 'CRM & Kontakte',
      icon: Users,
      badge: null
    },
    {
      id: 'products' as ActiveModule,
      label: 'Artikel & Produkte',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount} knapp` : null,
      badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
    },
    {
      id: 'pos' as ActiveModule,
      label: 'Point of Sale (POS)',
      icon: ShoppingBag,
      badge: null
    },
    {
      id: 'ios_billing' as ActiveModule,
      label: 'iOS Kasse & Speisen',
      icon: Utensils,
      badge: 'iOS',
      badgeColor: 'bg-indigo-600 text-white'
    },
    {
      id: 'restaurant' as ActiveModule,
      label: 'Restaurant & Gastro',
      icon: Utensils,
      badge: 'Neu',
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'purchases' as ActiveModule,
      label: 'Einkauf & RFQ',
      icon: ShoppingCart,
      badge: null
    },
    {
      id: 'stock' as ActiveModule,
      label: 'Lagerbuchungen',
      icon: ArrowLeftRight,
      badge: null
    },
    {
      id: 'docs' as ActiveModule,
      label: 'Handbuch & Docs',
      icon: BookOpen,
      badge: null
    },
    {
      id: 'settings' as ActiveModule,
      label: 'Einstellungen',
      icon: Settings,
      badge: null
    }
  ];

  const handleNavClick = (id: ActiveModule) => {
    sounds.playClick();
    onSelectModule(id);
  };

  return (
    <aside 
      id="main-sidebar" 
      className="no-print w-64 md:w-68 flex-shrink-0 flex flex-col justify-between h-screen sticky top-0 border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-30 transition-colors duration-300 select-none"
    >
      {/* App Branding & Launcher Launcher Button */}
      <div>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            id="sidebar-launcher-toggle"
            onClick={() => handleNavClick('launcher')}
            className="flex items-center gap-3 text-left w-full hover:opacity-85 transition group"
            title="Klicken, um zum Odoo App Launcher (Startbildschirm) zurückzukehren"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#714B67] to-[#875A7B] flex items-center justify-center text-white shadow-md shadow-purple-900/30 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
              <Grid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 dark:text-white tracking-tight text-base">Odoo</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50">
                  Apps
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Startbildschirm öffnen ↗</p>
            </div>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;

            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-[#714B67] text-white shadow-sm shadow-purple-900/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Controls & System Status */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
        {lowStockCount > 0 && (
          <div 
            onClick={() => handleNavClick('products')}
            className="cursor-pointer p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2 transition hover:bg-amber-500/15"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 animate-pulse" />
            <div className="truncate">
              <span className="font-semibold">{lowStockCount} Artikel</span> knapp!
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              id="theme-toggle-btn"
              onClick={() => {
                sounds.playClick();
                onToggleTheme();
              }}
              title={isDark ? 'Heller Modus' : 'Dunkler Modus'}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            <button
              id="sound-toggle-btn"
              onClick={onToggleSound}
              title={isMuted ? 'Soundeffekte aktivieren' : 'Soundeffekte stummschalten'}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-slate-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            <span className={`w-2 h-2 rounded-full ${isCleanMode ? 'bg-amber-400' : 'bg-emerald-500'} animate-ping`} />
            <span>{isCleanMode ? '0 Daten (Clean)' : 'IndexedDB'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

