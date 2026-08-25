import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Minus, 
  Square, 
  X, 
  Maximize2, 
  Minimize2, 
  Users, 
  Package, 
  Layers, 
  Receipt, 
  CreditCard, 
  ShoppingCart, 
  Settings, 
  Boxes, 
  Search, 
  Volume2, 
  VolumeX, 
  Sun, 
  Moon, 
  HardDrive, 
  Sparkles, 
  Trash2,
  Folder,
  LayoutGrid,
  CheckCircle2,
  Monitor,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  Power,
  LogOut,
  RotateCcw,
  BookOpen,
  Calculator,
  Compass,
  Pin,
  HelpCircle,
  Lock,
  Utensils,
  Sliders,
  PanelLeft,
  PanelRight,
  Github,
  MessageSquare,
  Globe,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  Check,
  Headphones
} from 'lucide-react';
import { 
  ActiveModule, 
  AppWindow, 
  Contact, 
  Product, 
  StockMove, 
  Invoice, 
  CompanyProfile, 
  PurchaseOrder, 
  POSOrder,
  DesktopFolder 
} from '../types';
import { sounds } from '../lib/sound';
import { applyAccentColor } from '../lib/accent';
import { getLanguage, setLanguage, useLanguage, t, formatSystemDate, LanguageCode } from '../lib/i18n';
import { FlagIcon } from './FlagIcon';
import { LanguageSelectionModal } from './LanguageSelectionModal';
import { WindowsExeNotificationToast } from './WindowsExeNotificationToast';
import { downloadWindowsExecutablePackage } from '../lib/windowsExeDownloader';
import { Dashboard } from './Dashboard';
import { ContactsModule } from './ContactsModule';
import { ProductsModule } from './ProductsModule';
import { StockMovesModule } from './StockMovesModule';
import { InvoicesModule } from './InvoicesModule';
import { POSModule } from './POSModule';
import { PurchasesModule } from './PurchasesModule';
import { SettingsModule } from './SettingsModule';
import { AccountingModule } from './AccountingModule';
import { AppStoreModule } from './AppStoreModule';
import { DocumentationApp } from './DocumentationApp';
import { TutorialModal } from './TutorialModal';
import { WindowsDesktopManagerModal } from './WindowsDesktopManagerModal';
import { DesktopFolderModal } from './DesktopFolderModal';
import { RestaurantModule } from './RestaurantModule';
import { IOSBillingModule } from './IOSBillingModule';
import { SupportServicesModule } from './SupportServicesModule';
import { SocdofLogo } from './SocdofLogo';

interface DesktopWindowWorkspaceProps {
  contacts: Contact[];
  products: Product[];
  stockMoves: StockMove[];
  invoices: Invoice[];
  purchases: PurchaseOrder[];
  posOrders: POSOrder[];
  company: CompanyProfile;
  onRefreshData: () => void;
  onUpdateCompany: (company: CompanyProfile) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isMuted: boolean;
  onToggleSound: () => void;
  onOpenStudio: () => void;
}

interface DesktopShortcutItem {
  id: string;
  module: ActiveModule;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: number | string;
}

export const DEFAULT_STANDARD_MODULES: ActiveModule[] = [
  'dashboard', 'invoices', 'accounting', 'contacts', 
  'products', 'stock', 'purchases', 'docs', 'settings', 'appstore'
];

export const DEFAULT_PINNED_DESKTOP: ActiveModule[] = [
  'dashboard', 'invoices', 'accounting', 'contacts', 
  'products', 'stock', 'purchases', 'appstore', 'docs', 'settings'
];

export const DEFAULT_PINNED_TASKBAR: ActiveModule[] = [
  'dashboard', 'invoices', 'accounting', 'contacts', 'settings'
];

export const SYSTEM_CORE_MODULES: ActiveModule[] = [
  'settings', 'dashboard', 'appstore', 'docs'
];

export const DesktopWindowWorkspace: React.FC<DesktopWindowWorkspaceProps> = ({
  contacts,
  products,
  stockMoves,
  invoices,
  purchases,
  posOrders,
  company,
  onRefreshData,
  onUpdateCompany,
  isDark,
  onToggleTheme,
  isMuted,
  onToggleSound,
  onOpenStudio
}) => {
  const currentLang = useLanguage();

  // Installed modules in App Store with guaranteed standard apps
  const [installedModules, setInstalledModules] = useState<ActiveModule[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_installed_modules');
      if (saved) {
        const parsed: ActiveModule[] = JSON.parse(saved);
        // Exclude optional gastro/restaurant by default unless user has customized
        return Array.from(new Set([...DEFAULT_STANDARD_MODULES, ...parsed])).filter(m => m !== 'restaurant' && m !== 'ios_billing');
      }
    } catch {
      // ignore
    }
    return DEFAULT_STANDARD_MODULES;
  });

  // Pinned desktop modules with guaranteed standard apps
  const [pinnedDesktop, setPinnedDesktop] = useState<ActiveModule[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_pinned_desktop');
      if (saved) {
        const parsed: ActiveModule[] = JSON.parse(saved);
        return Array.from(new Set([...DEFAULT_PINNED_DESKTOP, ...parsed])).filter(m => m !== 'restaurant' && m !== 'ios_billing');
      }
    } catch {
      // ignore
    }
    return DEFAULT_PINNED_DESKTOP;
  });

  // Pinned taskbar modules
  const [pinnedTaskbar, setPinnedTaskbar] = useState<ActiveModule[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_pinned_taskbar');
      if (saved) {
        const parsed: ActiveModule[] = JSON.parse(saved);
        return Array.from(new Set([...DEFAULT_PINNED_TASKBAR, ...parsed])).filter(m => m !== 'restaurant' && m !== 'ios_billing');
      }
    } catch {
      // ignore
    }
    return DEFAULT_PINNED_TASKBAR;
  });

  // Persistent Window Geometry & Maximized States (Restores exact size & maximized state when reopened)
  const [savedWindowStates, setSavedWindowStates] = useState<Record<string, {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
  }>>(() => {
    try {
      const saved = localStorage.getItem('odoo_window_geometry_states');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const saveWindowState = (module: ActiveModule, state: { x: number; y: number; width: number; height: number; isMaximized: boolean }) => {
    setSavedWindowStates(prev => {
      const next = { ...prev, [module]: state };
      try {
        localStorage.setItem('odoo_window_geometry_states', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Persistent Desktop Folders (Android / iOS Style App Nesting)
  const [desktopFolders, setDesktopFolders] = useState<DesktopFolder[]>(() => {
    try {
      const saved = localStorage.getItem('socdof_desktop_folders');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [activeFolderModal, setActiveFolderModal] = useState<DesktopFolder | null>(null);
  const [dragOverIconId, setDragOverIconId] = useState<string | null>(null);

  const saveDesktopFolders = (folders: DesktopFolder[]) => {
    setDesktopFolders(folders);
    try {
      localStorage.setItem('socdof_desktop_folders', JSON.stringify(folders));
    } catch {}
  };

  // Create folder from merging 2 apps
  const handleMergeAppsIntoFolder = (targetModId: ActiveModule, draggedModId: ActiveModule) => {
    sounds.playSuccess();
    const newFolderId = `folder_${Date.now()}`;
    const newFolder: DesktopFolder = {
      id: newFolderId,
      name: 'Ordner',
      modules: [targetModId, draggedModId],
      createdAt: new Date().toISOString()
    };

    // Remove both apps from pinned desktop
    const nextPinned = pinnedDesktop.filter(m => m !== targetModId && m !== draggedModId);
    setPinnedDesktop(nextPinned);
    try { localStorage.setItem('odoo_pinned_desktop', JSON.stringify(nextPinned)); } catch {}

    // Place folder at target position
    const targetPos = desktopPositions[targetModId] || { x: 24, y: 24 };
    setDesktopPositions(prev => {
      const next = { ...prev, [newFolderId]: targetPos };
      delete next[targetModId];
      delete next[draggedModId];
      try { localStorage.setItem('odoo_desktop_icon_positions', JSON.stringify(next)); } catch {}
      return next;
    });

    saveDesktopFolders([...desktopFolders, newFolder]);
    setDragOverIconId(null);
    setDraggedDesktopItem(null);
  };

  // Add app to existing folder
  const handleAddAppToExistingFolder = (folderId: string, draggedModId: ActiveModule) => {
    sounds.playPop();
    const nextFolders = desktopFolders.map(f => {
      if (f.id === folderId) {
        return {
          ...f,
          modules: Array.from(new Set([...f.modules, draggedModId]))
        };
      }
      return f;
    });

    // Remove app from pinned desktop
    const nextPinned = pinnedDesktop.filter(m => m !== draggedModId);
    setPinnedDesktop(nextPinned);
    try { localStorage.setItem('odoo_pinned_desktop', JSON.stringify(nextPinned)); } catch {}

    // Clean position
    setDesktopPositions(prev => {
      const next = { ...prev };
      delete next[draggedModId];
      try { localStorage.setItem('odoo_desktop_icon_positions', JSON.stringify(next)); } catch {}
      return next;
    });

    saveDesktopFolders(nextFolders);
    setDragOverIconId(null);
    setDraggedDesktopItem(null);
  };

  // Remove app from folder -> move back to desktop
  const handleRemoveFromFolder = (folderId: string, modId: ActiveModule) => {
    const targetFolder = desktopFolders.find(f => f.id === folderId);
    if (!targetFolder) return;

    const remainingMods = targetFolder.modules.filter(m => m !== modId);
    // Add app back to pinned desktop
    const nextPinned = Array.from(new Set([...pinnedDesktop, modId]));
    setPinnedDesktop(nextPinned);
    try { localStorage.setItem('odoo_pinned_desktop', JSON.stringify(nextPinned)); } catch {}

    if (remainingMods.length <= 1) {
      // Dissolve folder if 1 or 0 apps remaining
      const otherMod = remainingMods[0];
      const finalPinned = otherMod ? Array.from(new Set([...nextPinned, otherMod])) : nextPinned;
      setPinnedDesktop(finalPinned);
      try { localStorage.setItem('odoo_pinned_desktop', JSON.stringify(finalPinned)); } catch {}
      saveDesktopFolders(desktopFolders.filter(f => f.id !== folderId));
      if (activeFolderModal?.id === folderId) setActiveFolderModal(null);
    } else {
      const nextFolders = desktopFolders.map(f => f.id === folderId ? { ...f, modules: remainingMods } : f);
      saveDesktopFolders(nextFolders);
      if (activeFolderModal?.id === folderId) {
        setActiveFolderModal({ ...targetFolder, modules: remainingMods });
      }
    }
  };

  // Dissolve folder completely
  const handleDissolveFolder = (folderId: string) => {
    const targetFolder = desktopFolders.find(f => f.id === folderId);
    if (!targetFolder) return;

    const nextPinned = Array.from(new Set([...pinnedDesktop, ...targetFolder.modules]));
    setPinnedDesktop(nextPinned);
    try { localStorage.setItem('odoo_pinned_desktop', JSON.stringify(nextPinned)); } catch {}
    saveDesktopFolders(desktopFolders.filter(f => f.id !== folderId));
    if (activeFolderModal?.id === folderId) setActiveFolderModal(null);
  };

  // Rename folder
  const handleRenameFolder = (folderId: string, newName: string) => {
    const nextFolders = desktopFolders.map(f => f.id === folderId ? { ...f, name: newName } : f);
    saveDesktopFolders(nextFolders);
    if (activeFolderModal?.id === folderId) {
      setActiveFolderModal({ ...activeFolderModal, name: newName });
    }
  };

  // Desktop Icon XY Coordinates persistence (Freies Verschieben & Einrasten wie in Windows)
  const [desktopPositions, setDesktopPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem('odoo_desktop_icon_positions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [draggedDesktopItem, setDraggedDesktopItem] = useState<{
    modId: ActiveModule;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [desktopContextMenu, setDesktopContextMenu] = useState<{ x: number; y: number } | null>(null);
  const desktopCanvasRef = useRef<HTMLDivElement>(null);

  const getDesktopPosition = (modId: ActiveModule, index: number) => {
    if (desktopPositions[modId]) {
      return desktopPositions[modId];
    }
    // Windows standard column grid calculation (6 items per column)
    const maxRows = 6;
    const col = Math.floor(index / maxRows);
    const row = index % maxRows;
    return {
      x: 24 + col * 104,
      y: 24 + row * 96
    };
  };

  const handleAutoArrangeDesktop = () => {
    sounds.playClick();
    const nextPositions: Record<string, { x: number; y: number }> = {};
    pinnedDesktop.forEach((modId, index) => {
      const maxRows = 6;
      const col = Math.floor(index / maxRows);
      const row = index % maxRows;
      nextPositions[modId] = {
        x: 24 + col * 104,
        y: 24 + row * 96
      };
    });
    setDesktopPositions(nextPositions);
    try { localStorage.setItem('odoo_desktop_icon_positions', JSON.stringify(nextPositions)); } catch {}
    setDesktopContextMenu(null);
  };

  const handleSnapDesktopToGrid = () => {
    sounds.playClick();
    setDesktopPositions(prev => {
      const next: Record<string, { x: number; y: number }> = {};
      pinnedDesktop.forEach((modId, index) => {
        const current = prev[modId] || getDesktopPosition(modId, index);
        const snapX = Math.round((current.x - 24) / 104) * 104 + 24;
        const snapY = Math.round((current.y - 24) / 96) * 96 + 24;
        next[modId] = { x: Math.max(16, snapX), y: Math.max(16, snapY) };
      });
      try { localStorage.setItem('odoo_desktop_icon_positions', JSON.stringify(next)); } catch {}
      return next;
    });
    setDesktopContextMenu(null);
  };

  const handleDesktopCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = desktopCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const rawModId = e.dataTransfer.getData('text/plain') as ActiveModule;
    const modId = rawModId || draggedDesktopItem?.modId;
    if (!modId) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const offsetX = draggedDesktopItem?.offsetX ?? 48;
    const offsetY = draggedDesktopItem?.offsetY ?? 44;

    const targetX = mouseX - offsetX;
    const targetY = mouseY - offsetY;

    // Snap to Windows Grid (104px horizontal, 96px vertical)
    const snapGridX = 104;
    const snapGridY = 96;
    const snappedX = Math.max(16, Math.min(rect.width - 110, Math.round((targetX - 24) / snapGridX) * snapGridX + 24));
    const snappedY = Math.max(16, Math.min(rect.height - 110, Math.round((targetY - 24) / snapGridY) * snapGridY + 24));

    setDesktopPositions(prev => {
      const next = { ...prev, [modId]: { x: snappedX, y: snappedY } };
      try { localStorage.setItem('odoo_desktop_icon_positions', JSON.stringify(next)); } catch {}
      return next;
    });

    sounds.playPop();
    setDraggedDesktopItem(null);
  };

  const getInitialWindowDimensions = () => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const width = Math.max(920, Math.min(screenW - 60, 1140));
    const height = Math.max(620, Math.min(screenH - 90, 740));
    const x = Math.max(20, Math.floor((screenW - width) / 2));
    const y = Math.max(20, Math.floor((screenH - height) / 2) - 20);
    return { width, height, x, y };
  };

  // Windows State: Clean Desktop without auto-opened windows on initial boot
  const [windows, setWindows] = useState<AppWindow[]>(() => []);
  const [activeWindowId, setActiveWindowId] = useState<string>('');
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isPowerMenuOpen, setIsPowerMenuOpen] = useState(false);
  const [isLockedStandby, setIsLockedStandby] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isWindowsModalOpen, setIsWindowsModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Windows 11 Calendar & Agenda Flyout State
  const [isCalendarFlyoutOpen, setIsCalendarFlyoutOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());

  // Desktop App Name Tooltip State with ~0.6s hover delay for truncated or full titles
  const [desktopTooltip, setDesktopTooltip] = useState<{
    text: string;
    subtext?: string;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  const handleIconMouseEnter = (e: React.MouseEvent, title: string, subtext?: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.bottom + 8;

    tooltipTimeoutRef.current = window.setTimeout(() => {
      setDesktopTooltip({
        text: title,
        subtext,
        x: targetX,
        y: targetY
      });
    }, 600);
  };

  const handleIconMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setDesktopTooltip(null);
  };

  useEffect(() => {
    if (company?.accent_color) {
      applyAccentColor(company.accent_color);
    }
  }, [company?.accent_color]);
  // Unified Payment Config state & helper
  const [snapPreview, setSnapPreview] = useState<'left' | 'right' | 'top' | null>(null);
  const [draggedWindow, setDraggedWindow] = useState<{ id: string; startX: number; startY: number; initX: number; initY: number } | null>(null);
  const [resizingWindow, setResizingWindow] = useState<{
    id: string;
    direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
  } | null>(null);
  const [startSearch, setStartSearch] = useState('');
  const [draggedDesktopIdx, setDraggedDesktopIdx] = useState<number | null>(null);
  const [draggedTaskbarIdx, setDraggedTaskbarIdx] = useState<number | null>(null);

  const startMenuRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const calendarFlyoutRef = useRef<HTMLDivElement>(null);
  const clockTrayButtonRef = useRef<HTMLButtonElement>(null);

  // Global Outside Click Listener for Menus (Start Menu, Calendar Flyout, etc.)
  useEffect(() => {
    const handleGlobalPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (isStartMenuOpen) {
        if (
          startMenuRef.current && !startMenuRef.current.contains(target) &&
          startButtonRef.current && !startButtonRef.current.contains(target)
        ) {
          setIsStartMenuOpen(false);
        }
      }
      if (isCalendarFlyoutOpen) {
        if (
          calendarFlyoutRef.current && !calendarFlyoutRef.current.contains(target) &&
          clockTrayButtonRef.current && !clockTrayButtonRef.current.contains(target)
        ) {
          setIsCalendarFlyoutOpen(false);
        }
      }
    };

    document.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPointerDown);
    };
  }, [isStartMenuOpen, isCalendarFlyoutOpen]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Save module configs
  const saveInstalled = (mods: ActiveModule[]) => {
    setInstalledModules(mods);
    try { localStorage.setItem('odoo_installed_modules', JSON.stringify(mods)); } catch {}
  };
  const savePinnedDesktop = (mods: ActiveModule[]) => {
    setPinnedDesktop(mods);
    try { localStorage.setItem('odoo_pinned_desktop', JSON.stringify(mods)); } catch {}
  };
  const savePinnedTaskbar = (mods: ActiveModule[]) => {
    setPinnedTaskbar(mods);
    try { localStorage.setItem('odoo_pinned_taskbar', JSON.stringify(mods)); } catch {}
  };

  // Restore standard apps to desktop and taskbar
  const handleRestoreStandardApps = () => {
    sounds.playSuccess();
    saveInstalled(DEFAULT_STANDARD_MODULES);
    savePinnedDesktop(DEFAULT_PINNED_DESKTOP);
    savePinnedTaskbar(DEFAULT_PINNED_TASKBAR);
  };

  // Reorder desktop icons via drag & drop
  const handleDesktopReorder = (targetIdx: number) => {
    if (draggedDesktopIdx === null || draggedDesktopIdx === targetIdx) return;
    const updated = [...pinnedDesktop];
    const [moved] = updated.splice(draggedDesktopIdx, 1);
    updated.splice(targetIdx, 0, moved);
    savePinnedDesktop(updated);
    sounds.playClick();
    setDraggedDesktopIdx(null);
  };

  // Reorder taskbar icons via drag & drop
  const handleTaskbarReorder = (targetIdx: number) => {
    if (draggedTaskbarIdx === null || draggedTaskbarIdx === targetIdx) return;
    const updated = [...pinnedTaskbar];
    const [moved] = updated.splice(draggedTaskbarIdx, 1);
    updated.splice(targetIdx, 0, moved);
    savePinnedTaskbar(updated);
    sounds.playClick();
    setDraggedTaskbarIdx(null);
  };

  const handleToggleInstall = (mod: ActiveModule) => {
    if (SYSTEM_CORE_MODULES.includes(mod)) {
      sounds.playWarning();
      return;
    }
    sounds.playInstall();
    if (installedModules.includes(mod)) {
      const next = installedModules.filter(m => m !== mod);
      saveInstalled(next);
      savePinnedDesktop(pinnedDesktop.filter(m => m !== mod));
      savePinnedTaskbar(pinnedTaskbar.filter(m => m !== mod));
      // Close windows of this module
      setWindows(prev => prev.filter(w => w.module !== mod));
    } else {
      const next = [...installedModules, mod];
      saveInstalled(next);
      savePinnedDesktop([...pinnedDesktop, mod]);
    }
  };

  const handleTogglePinDesktop = (mod: ActiveModule) => {
    sounds.playClick();
    if (pinnedDesktop.includes(mod)) {
      savePinnedDesktop(pinnedDesktop.filter(m => m !== mod));
    } else {
      savePinnedDesktop([...pinnedDesktop, mod]);
    }
  };

  const handleTogglePinTaskbar = (mod: ActiveModule) => {
    sounds.playClick();
    if (pinnedTaskbar.includes(mod)) {
      savePinnedTaskbar(pinnedTaskbar.filter(m => m !== mod));
    } else {
      savePinnedTaskbar([...pinnedTaskbar, mod]);
    }
  };

  // Window drag & resize pointer/mouse event listeners
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;

      if (draggedWindow) {
        e.preventDefault();
        const dx = e.clientX - draggedWindow.startX;
        const dy = e.clientY - draggedWindow.startY;

        // Aero Snap edge detection
        if (e.clientX <= 25) {
          setSnapPreview('left');
        } else if (e.clientX >= screenW - 25) {
          setSnapPreview('right');
        } else if (e.clientY <= 20) {
          setSnapPreview('top');
        } else {
          setSnapPreview(null);
        }

        setWindows(prev => prev.map(w => {
          if (w.id === draggedWindow.id) {
            const newX = Math.max(-w.width + 120, Math.min(screenW - 80, draggedWindow.initX + dx));
            const newY = Math.max(0, Math.min(screenH - 70, draggedWindow.initY + dy));
            return {
              ...w,
              x: newX,
              y: newY
            };
          }
          return w;
        }));
      } else if (resizingWindow) {
        e.preventDefault();
        const dx = e.clientX - resizingWindow.startX;
        const dy = e.clientY - resizingWindow.startY;
        const dir = resizingWindow.direction;

        setWindows(prev => prev.map(w => {
          if (w.id === resizingWindow.id) {
            let nextW = resizingWindow.initW;
            let nextH = resizingWindow.initH;
            let nextX = resizingWindow.initX;
            let nextY = resizingWindow.initY;

            // Horizontal resize
            if (dir.includes('e')) {
              nextW = Math.max(520, Math.min(screenW - nextX, resizingWindow.initW + dx));
            } else if (dir.includes('w')) {
              const proposedW = resizingWindow.initW - dx;
              const clampedW = Math.max(520, Math.min(resizingWindow.initX + resizingWindow.initW, proposedW));
              nextX = resizingWindow.initX + (resizingWindow.initW - clampedW);
              nextW = clampedW;
            }

            // Vertical resize
            if (dir.includes('s')) {
              nextH = Math.max(380, Math.min(screenH - 48 - nextY, resizingWindow.initH + dy));
            } else if (dir.includes('n')) {
              const proposedH = resizingWindow.initH - dy;
              const clampedH = Math.max(380, Math.min(resizingWindow.initY + resizingWindow.initH, proposedH));
              nextY = Math.max(0, resizingWindow.initY + (resizingWindow.initH - clampedH));
              nextH = clampedH;
            }

            return {
              ...w,
              x: nextX,
              y: nextY,
              width: nextW,
              height: nextH
            };
          }
          return w;
        }));
      }
    };

    const handlePointerUp = () => {
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;

      if (draggedWindow && snapPreview) {
        sounds.playPop();
        let updatedState: { isMaximized: boolean; x?: number; y?: number; width?: number; height?: number } | null = null;
        if (snapPreview === 'left') {
          updatedState = { isMaximized: false, x: 0, y: 0, width: Math.floor(screenW / 2), height: screenH - 48 };
          setWindows(prev => prev.map(w => w.id === draggedWindow.id ? {
            ...w,
            x: 0,
            y: 0,
            width: Math.floor(screenW / 2),
            height: screenH - 48,
            isMaximized: false
          } : w));
        } else if (snapPreview === 'right') {
          updatedState = { isMaximized: false, x: Math.floor(screenW / 2), y: 0, width: Math.floor(screenW / 2), height: screenH - 48 };
          setWindows(prev => prev.map(w => w.id === draggedWindow.id ? {
            ...w,
            x: Math.floor(screenW / 2),
            y: 0,
            width: Math.floor(screenW / 2),
            height: screenH - 48,
            isMaximized: false
          } : w));
        } else if (snapPreview === 'top') {
          updatedState = { isMaximized: true };
          setWindows(prev => prev.map(w => w.id === draggedWindow.id ? {
            ...w,
            isMaximized: true
          } : w));
        }
        const activeTarget = windows.find(w => w.id === draggedWindow.id);
        if (activeTarget && updatedState) {
          saveWindowState(activeTarget.module, {
            x: updatedState.x ?? activeTarget.x,
            y: updatedState.y ?? activeTarget.y,
            width: updatedState.width ?? activeTarget.width,
            height: updatedState.height ?? activeTarget.height,
            isMaximized: updatedState.isMaximized
          });
        }
      } else if (draggedWindow || resizingWindow) {
        const changedId = draggedWindow?.id || resizingWindow?.id;
        const target = windows.find(w => w.id === changedId);
        if (target) {
          saveWindowState(target.module, {
            x: target.x,
            y: target.y,
            width: target.width,
            height: target.height,
            isMaximized: target.isMaximized
          });
        }
      }

      setSnapPreview(null);
      setDraggedWindow(null);
      setResizingWindow(null);
    };

    if (draggedWindow || resizingWindow) {
      window.addEventListener('pointermove', handlePointerMove, { passive: false });
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [draggedWindow, resizingWindow, snapPreview, windows]);

  // Shortcut registry
  const shortcutMeta: Record<ActiveModule, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; color: string }> = useMemo(() => ({
    dashboard: { title: t('module.dashboard', currentLang, 'Dashboard'), subtitle: t('desc.dashboard', currentLang, 'ERP Dashboard'), icon: Boxes, color: 'bg-purple-600' },
    invoices: { title: t('module.invoices', currentLang, 'Rechnungen'), subtitle: t('desc.invoices', currentLang, 'Fakturierung & DIN-A4'), icon: Receipt, color: 'bg-indigo-600' },
    ios_billing: { title: t('module.ios_billing', currentLang, 'Schnellkasse'), subtitle: t('desc.ios_billing', currentLang, 'Speisen, Beilagen & Billing'), icon: Utensils, color: 'bg-indigo-600' },
    restaurant: { title: t('module.restaurant', currentLang, 'Restaurant'), subtitle: t('desc.restaurant', currentLang, 'Speisekarte & Tische'), icon: Utensils, color: 'bg-amber-600' },
    accounting: { title: t('module.accounting', currentLang, 'Abrechnung'), subtitle: t('desc.accounting', currentLang, 'BWA, EÜR & Finanzen'), icon: Calculator, color: 'bg-emerald-600' },
    contacts: { title: t('module.contacts', currentLang, 'Kontakte'), subtitle: t('desc.contacts', currentLang, 'Kunden & Lieferanten'), icon: Users, color: 'bg-teal-600' },
    support_services: { title: t('module.support_services', currentLang, 'Support'), subtitle: t('desc.support_services', currentLang, 'Dienstleistungen & Zeiterfassung'), icon: Headphones, color: 'bg-cyan-600' },
    products: { title: t('module.products', currentLang, 'Produkte'), subtitle: t('desc.products', currentLang, 'Produkte & Preise'), icon: Package, color: 'bg-blue-600' },
    stock: { title: t('module.stock', currentLang, 'Lager'), subtitle: t('desc.stock', currentLang, 'Warenbewegungen'), icon: Layers, color: 'bg-amber-600' },
    pos: { title: t('module.pos', currentLang, 'POS Kasse'), subtitle: t('desc.pos', currentLang, 'Point of Sale'), icon: CreditCard, color: 'bg-violet-600' },
    purchases: { title: t('module.purchases', currentLang, 'Einkauf'), subtitle: t('desc.purchases', currentLang, 'Lieferantenbestellungen'), icon: ShoppingCart, color: 'bg-orange-600' },
    appstore: { title: t('module.appstore', currentLang, 'App Store'), subtitle: t('desc.appstore', currentLang, 'Module verwalten'), icon: Package, color: 'bg-fuchsia-600' },
    docs: { title: t('module.docs', currentLang, 'Handbuch'), subtitle: t('desc.docs', currentLang, 'Dokumentation & Hilfe'), icon: BookOpen, color: 'bg-sky-600' },
    settings: { title: t('module.settings', currentLang, 'Einstellungen'), subtitle: t('desc.settings', currentLang, 'Briefkopf & Backup'), icon: Settings, color: 'bg-slate-700' },
    launcher: { title: t('module.launcher', currentLang, 'App Launcher'), subtitle: t('desc.launcher', currentLang, 'App Launcher'), icon: LayoutGrid, color: 'bg-indigo-600' }
  }), [currentLang]);

  // Calendar calculations for Windows 11 Calendar & Agenda Flyout
  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    const isSameDate = (d1: Date, d2: Date) => (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );

    const result: Array<{
      date: Date;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasEvent: boolean;
    }> = [];

    // Prev month days
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      result.push({
        date: d,
        dayNum: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: isSameDate(d, currentTime),
        isSelected: isSameDate(d, selectedCalendarDate),
        hasEvent: invoices.some(inv => inv.due_date && isSameDate(new Date(inv.due_date), d))
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      result.push({
        date: d,
        dayNum: i,
        isCurrentMonth: true,
        isToday: isSameDate(d, currentTime),
        isSelected: isSameDate(d, selectedCalendarDate),
        hasEvent: invoices.some(inv => inv.due_date && isSameDate(new Date(inv.due_date), d))
      });
    }

    // Next month days to reach 35 or 42 grid cells
    const remaining = (7 - (result.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      result.push({
        date: d,
        dayNum: i,
        isCurrentMonth: false,
        isToday: isSameDate(d, currentTime),
        isSelected: isSameDate(d, selectedCalendarDate),
        hasEvent: invoices.some(inv => inv.due_date && isSameDate(new Date(inv.due_date), d))
      });
    }

    return result;
  }, [calendarViewDate, currentTime, selectedCalendarDate, invoices]);

  const selectedDateInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!inv.due_date) return false;
      const d = new Date(inv.due_date);
      return (
        d.getFullYear() === selectedCalendarDate.getFullYear() &&
        d.getMonth() === selectedCalendarDate.getMonth() &&
        d.getDate() === selectedCalendarDate.getDate()
      );
    });
  }, [invoices, selectedCalendarDate]);

  const openInvoicesUpcoming = useMemo(() => {
    return invoices
      .filter(inv => inv.status === 'posted' || inv.status === 'draft')
      .slice(0, 3);
  }, [invoices]);

  // Only real, actionable notifications (Red dot / count), no fake 'Live' badge
  const getBadgeForModule = (mod: ActiveModule) => {
    if (mod === 'invoices') {
      const openInv = invoices.filter(i => i.status === 'draft' || i.status === 'posted').length;
      return openInv > 0 ? openInv : undefined;
    }
    if (mod === 'purchases') {
      const pendingPurchases = purchases.filter(p => p.status === 'draft' || p.status === 'rfq').length;
      return pendingPurchases > 0 ? pendingPurchases : undefined;
    }
    if (mod === 'stock') {
      const pendingStock = stockMoves.filter(s => s.status === 'waiting' || s.status === 'ready').length;
      return pendingStock > 0 ? pendingStock : undefined;
    }
    return undefined;
  };

  const openWindow = (module: ActiveModule, customTitle?: string) => {
    sounds.playWindowOpen();
    setIsStartMenuOpen(false);
    setIsPowerMenuOpen(false);

    const existing = windows.find(w => w.module === module);
    const maxZ = Math.max(...windows.map(w => w.zIndex), 10) + 1;
    const meta = shortcutMeta[module] || { title: module, subtitle: '', icon: Boxes, color: 'bg-indigo-600' };
    const title = customTitle || meta.title;

    if (existing) {
      setWindows(prev => prev.map(w => w.id === existing.id ? { ...w, isMinimized: false, zIndex: maxZ } : w));
      setActiveWindowId(existing.id);
    } else {
      const offset = (windows.length % 6) * 25;
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
      
      // Check saved geometry & maximized preference
      const saved = savedWindowStates[module];
      let startX: number;
      let startY: number;
      let startW: number;
      let startH: number;
      let isMaximized = false;

      if (saved) {
        startW = Math.min(screenW - 20, Math.max(450, saved.width || 1000));
        startH = Math.min(screenH - 60, Math.max(350, saved.height || 680));
        startX = Math.max(10, Math.min(screenW - startW - 10, saved.x ?? 40));
        startY = Math.max(10, Math.min(screenH - startH - 50, saved.y ?? 20));
        isMaximized = Boolean(saved.isMaximized);
      } else {
        startW = Math.max(920, Math.min(screenW - 60, 1140));
        startH = Math.max(620, Math.min(screenH - 90, 750));
        startX = Math.max(20, Math.min(screenW - startW - 20, Math.floor((screenW - startW) / 2) + (offset - 50)));
        startY = Math.max(15, Math.min(screenH - startH - 55, Math.floor((screenH - startH) / 2) - 20 + (offset - 50)));
      }

      const newWin: AppWindow = {
        id: `win_${module}_${Date.now()}`,
        module,
        title,
        iconName: 'Boxes',
        isMinimized: false,
        isMaximized,
        zIndex: maxZ,
        x: startX,
        y: startY,
        width: startW,
        height: startH
      };
      setWindows(prev => [...prev, newWin]);
      setActiveWindowId(newWin.id);
    }
  };

  const focusWindow = (id: string) => {
    const maxZ = Math.max(...windows.map(w => w.zIndex), 10) + 1;
    setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: maxZ, isMinimized: false } : w));
    setActiveWindowId(id);
  };

  const minimizeWindow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playWindowClose();
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
    if (activeWindowId === id) {
      const remaining = windows.filter(w => w.id !== id && !w.isMinimized).sort((a, b) => b.zIndex - a.zIndex);
      if (remaining.length > 0) {
        setActiveWindowId(remaining[0].id);
      } else {
        setActiveWindowId('');
      }
    }
  };

  const toggleMaximizeWindow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playClick();
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        const nextMax = !w.isMaximized;
        saveWindowState(w.module, {
          x: w.x,
          y: w.y,
          width: w.width,
          height: w.height,
          isMaximized: nextMax
        });
        return { ...w, isMaximized: nextMax };
      }
      return w;
    }));
  };

  const closeWindow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playWindowClose();
    const closing = windows.find(w => w.id === id);
    if (closing) {
      saveWindowState(closing.module, {
        x: closing.x,
        y: closing.y,
        width: closing.width,
        height: closing.height,
        isMaximized: closing.isMaximized
      });
    }
    setWindows(prev => prev.filter(w => w.id !== id));
    if (activeWindowId === id) {
      const remaining = windows.filter(w => w.id !== id && !w.isMinimized).sort((a, b) => b.zIndex - a.zIndex);
      if (remaining.length > 0) {
        setActiveWindowId(remaining[0].id);
      } else {
        setActiveWindowId('');
      }
    }
  };

  const startDrag = (id: string, e: React.MouseEvent | React.PointerEvent) => {
    focusWindow(id);
    const win = windows.find(w => w.id === id);
    if (!win || win.isMaximized) return;

    setDraggedWindow({
      id,
      startX: e.clientX,
      startY: e.clientY,
      initX: win.x,
      initY: win.y
    });
  };

  const startResize = (
    id: string, 
    direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw', 
    e: React.MouseEvent | React.PointerEvent
  ) => {
    e.stopPropagation();
    focusWindow(id);
    const win = windows.find(w => w.id === id);
    if (!win || win.isMaximized) return;

    setResizingWindow({
      id,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      initX: win.x,
      initY: win.y,
      initW: win.width,
      initH: win.height
    });
  };

  const snapWindowTo = (id: string, snap: 'left' | 'right' | 'full') => {
    sounds.playPop();
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
    if (snap === 'full') {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: true } : w));
    } else if (snap === 'left') {
      setWindows(prev => prev.map(w => w.id === id ? {
        ...w,
        x: 0,
        y: 0,
        width: Math.floor(screenW / 2),
        height: screenH - 48,
        isMaximized: false
      } : w));
    } else if (snap === 'right') {
      setWindows(prev => prev.map(w => w.id === id ? {
        ...w,
        x: Math.floor(screenW / 2),
        y: 0,
        width: Math.floor(screenW / 2),
        height: screenH - 48,
        isMaximized: false
      } : w));
    }
  };

  // Shutdown / Power Handlers
  const handleShutdown = () => {
    sounds.playShutdown();
    setIsPowerMenuOpen(false);
    setIsStartMenuOpen(false);
    setWindows([]);
    setIsLockedStandby(true);
  };

  const handleRestart = () => {
    sounds.playShutdown();
    setIsPowerMenuOpen(false);
    setIsStartMenuOpen(false);
    setWindows([]);
    setTimeout(() => {
      sounds.playStartup();
    }, 600);
  };

  // Filtered Start Menu items
  const startMenuItems = installedModules.filter(m => {
    const meta = shortcutMeta[m];
    if (!meta) return false;
    return meta.title.toLowerCase().includes(startSearch.toLowerCase()) ||
           meta.subtitle.toLowerCase().includes(startSearch.toLowerCase());
  });

  return (
    <div 
      onClick={() => {
        if (isStartMenuOpen) setIsStartMenuOpen(false);
        if (isPowerMenuOpen) setIsPowerMenuOpen(false);
      }}
      className={`relative w-screen h-screen overflow-hidden select-none font-sans flex flex-col justify-between transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}
    >
      
      {/* 1. Desktop Wallpaper Canvas & Ambient Lighting */}
      {company.desktop_wallpaper_url ? (
        <div 
          className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-500"
          style={{ backgroundImage: `url(${company.desktop_wallpaper_url})` }}
        >
          <div className={`absolute inset-0 ${isDark ? 'bg-slate-950/40 backdrop-blur-xs' : 'bg-white/20 backdrop-blur-2xs'}`} />
        </div>
      ) : isDark ? (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-900 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-indigo-50/60 to-blue-100/50 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* 2. Standby / Lockscreen Overlay if user clicked "Beenden" */}
      {isLockedStandby && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-white animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center mb-6 shadow-2xl">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">SOCDOF Beendet</h2>
          <p className="text-sm text-slate-400 max-w-sm text-center mb-8">
            Ihre Sitzung wurde sicher beendet. Alle Daten sind lokal in Ihrer Datenbank gespeichert.
          </p>
          <button
            onClick={() => {
              sounds.playStartup();
              setIsLockedStandby(false);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl transition active:scale-95"
          >
            <RotateCcw className="w-5 h-5" />
            <span>SOCDOF Desktop starten</span>
          </button>
        </div>
      )}

      {/* 3. Desktop Canvas with Windows-style Free Drag & Drop Icon Positioning */}
      <div 
        ref={desktopCanvasRef}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={handleDesktopCanvasDrop}
        onContextMenu={(e) => {
          e.preventDefault();
          setDesktopContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onClick={() => {
          if (desktopContextMenu) setDesktopContextMenu(null);
        }}
        className="relative z-1 w-full h-[calc(100vh-48px)] overflow-hidden select-none"
      >
        {/* Aero Snap Translucent Docking Preview */}
        {snapPreview === 'left' && (
          <div className="absolute left-3 top-3 bottom-3 w-[calc(50%-12px)] rounded-3xl bg-indigo-500/15 border-2 border-indigo-400/80 backdrop-blur-xs z-30 pointer-events-none transition-all duration-150 animate-pulse flex items-center justify-center">
            <div className="px-4 py-2 rounded-2xl bg-indigo-900/90 text-white text-xs font-bold shadow-xl border border-indigo-400/40 flex items-center gap-2">
              <PanelLeft className="w-4 h-4 text-indigo-300" />
              <span>Links anordnen (50%)</span>
            </div>
          </div>
        )}
        {snapPreview === 'right' && (
          <div className="absolute right-3 top-3 bottom-3 w-[calc(50%-12px)] rounded-3xl bg-indigo-500/15 border-2 border-indigo-400/80 backdrop-blur-xs z-30 pointer-events-none transition-all duration-150 animate-pulse flex items-center justify-center">
            <div className="px-4 py-2 rounded-2xl bg-indigo-900/90 text-white text-xs font-bold shadow-xl border border-indigo-400/40 flex items-center gap-2">
              <PanelRight className="w-4 h-4 text-indigo-300" />
              <span>Rechts anordnen (50%)</span>
            </div>
          </div>
        )}
        {snapPreview === 'top' && (
          <div className="absolute inset-3 rounded-3xl bg-indigo-500/15 border-2 border-indigo-400/80 backdrop-blur-xs z-30 pointer-events-none transition-all duration-150 animate-pulse flex items-center justify-center">
            <div className="px-4 py-2 rounded-2xl bg-indigo-900/90 text-white text-xs font-bold shadow-xl border border-indigo-400/40 flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-indigo-300" />
              <span>Vollbild maximieren</span>
            </div>
          </div>
        )}

        {/* Render Each Desktop Icon at its persistent X/Y coordinate */}
        {pinnedDesktop.map((modId, index) => {
          const meta = shortcutMeta[modId];
          if (!meta) return null;
          const Icon = meta.icon;
          const openWin = windows.find(w => w.module === modId);
          const isOpen = Boolean(openWin);
          const isCurrentActive = openWin ? activeWindowId === openWin.id : false;
          const badge = getBadgeForModule(modId);
          const pos = getDesktopPosition(modId, index);
          const isBeingDragged = draggedDesktopItem?.modId === modId;
          const isDragOver = dragOverIconId === modId;

          return (
            <div
              key={modId}
              draggable
              onDragStart={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                const offsetY = e.clientY - rect.top;
                setDraggedDesktopItem({ modId, offsetX, offsetY });
                e.dataTransfer.setData('text/plain', modId);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDraggedDesktopItem(null);
                setDragOverIconId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedDesktopItem && draggedDesktopItem.modId !== modId) {
                  setDragOverIconId(modId);
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverIconId === modId) {
                  setDragOverIconId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const droppedModId = (e.dataTransfer.getData('text/plain') as ActiveModule) || draggedDesktopItem?.modId;
                if (droppedModId && droppedModId !== modId) {
                  handleMergeAppsIntoFolder(modId, droppedModId);
                }
                setDragOverIconId(null);
              }}
              style={{
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                zIndex: isBeingDragged ? 40 : 2
              }}
              className={`cursor-grab active:cursor-grabbing rounded-2xl select-none transition-all duration-150 ${
                isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-indigo-400 ring-dashed' : 'hover:scale-102'
              } ${
                isDragOver ? 'scale-110 ring-4 ring-indigo-500 ring-offset-2 ring-offset-transparent bg-indigo-500/20' : ''
              }`}
            >
              <button
                onClick={() => {
                  handleIconMouseLeave();
                  openWindow(modId, meta.title);
                }}
                onDoubleClick={() => {
                  handleIconMouseLeave();
                  openWindow(modId, meta.title);
                }}
                onMouseEnter={(e) => handleIconMouseEnter(e, meta.title, meta.subtitle)}
                onMouseLeave={handleIconMouseLeave}
                className={`group relative flex flex-col items-center justify-center w-24 p-2 rounded-2xl text-center transition backdrop-blur-xs border border-transparent ${
                  isDark 
                    ? 'hover:bg-white/10 active:bg-white/20 hover:border-white/15' 
                    : 'hover:bg-black/5 active:bg-black/10 hover:border-black/10'
                }`}
              >
                <div className="relative">
                  <div className={`w-12 h-12 rounded-2xl ${meta.color} text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  {/* Clean Red Notification Badge for Actionable Items */}
                  {badge !== undefined && typeof badge === 'number' && badge > 0 && (
                    <span 
                      title={`${badge} Benachrichtigungen`}
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full shadow-md flex items-center justify-center border-2 border-white dark:border-slate-900 animate-scale-up"
                    >
                      {badge}
                    </span>
                  )}
                  
                  {/* Modern Active Indicator Bar (Subtle & Elegant) */}
                  {isOpen && (
                    <span 
                      className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full transition-all duration-300 ${
                        isCurrentActive 
                          ? 'w-5 h-1 bg-indigo-500 shadow-sm' 
                          : 'w-2.5 h-1 bg-slate-400/80 dark:bg-slate-500/80'
                      }`} 
                    />
                  )}
                </div>
                <span className={`mt-2 text-xs font-semibold drop-shadow-sm leading-tight text-center truncate max-w-[85px] ${
                  isDark ? 'text-white' : 'text-slate-800'
                }`}>
                  {meta.title}
                </span>
              </button>
            </div>
          );
        })}

        {/* Render Desktop Folders (Android / iOS Style Container with 2x2 Mini Preview) */}
        {desktopFolders.map((folder, fIndex) => {
          const pos = desktopPositions[folder.id] || { 
            x: 24 + Math.floor((pinnedDesktop.length + fIndex) / 6) * 104, 
            y: 24 + ((pinnedDesktop.length + fIndex) % 6) * 96 
          };
          const isDragOver = dragOverIconId === folder.id;

          return (
            <div
              key={folder.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedDesktopItem) {
                  setDragOverIconId(folder.id);
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverIconId === folder.id) {
                  setDragOverIconId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const droppedModId = (e.dataTransfer.getData('text/plain') as ActiveModule) || draggedDesktopItem?.modId;
                if (droppedModId) {
                  handleAddAppToExistingFolder(folder.id, droppedModId);
                }
                setDragOverIconId(null);
              }}
              style={{
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                zIndex: 3
              }}
              className={`rounded-2xl select-none transition-all duration-150 ${
                isDragOver ? 'scale-110 ring-4 ring-indigo-500 ring-offset-2 ring-offset-transparent bg-indigo-500/20' : 'hover:scale-102'
              }`}
            >
              <button
                onClick={() => {
                  handleIconMouseLeave();
                  sounds.playClick();
                  setActiveFolderModal(folder);
                }}
                onMouseEnter={(e) => handleIconMouseEnter(e, folder.name, `${folder.modules.length} Apps`)}
                onMouseLeave={handleIconMouseLeave}
                className={`group relative flex flex-col items-center justify-center w-24 p-2 rounded-2xl text-center transition backdrop-blur-xs border border-transparent ${
                  isDark 
                    ? 'hover:bg-white/10 active:bg-white/20 hover:border-white/15' 
                    : 'hover:bg-black/5 active:bg-black/10 hover:border-black/10'
                }`}
              >
                {/* 2x2 Mini Apps Grid Squircle (Android Style) */}
                <div className="relative w-12 h-12 rounded-2xl bg-slate-800/40 dark:bg-slate-700/50 backdrop-blur-md p-1.5 grid grid-cols-2 gap-1 border border-white/20 shadow-md group-hover:scale-105 transition-transform duration-200">
                  {folder.modules.slice(0, 4).map((mod) => {
                    const mMeta = shortcutMeta[mod];
                    if (!mMeta) return null;
                    const MIcon = mMeta.icon;
                    return (
                      <div key={mod} className={`rounded-[4px] ${mMeta.color} text-white flex items-center justify-center`}>
                        <MIcon className="w-2.5 h-2.5" />
                      </div>
                    );
                  })}
                  {folder.modules.length < 4 && Array.from({ length: 4 - folder.modules.length }).map((_, i) => (
                    <div key={i} className="rounded-[4px] bg-white/10" />
                  ))}
                </div>

                <span className={`mt-2 text-xs font-semibold drop-shadow-sm leading-tight text-center truncate max-w-[85px] ${
                  isDark ? 'text-white' : 'text-slate-800'
                }`}>
                  {folder.name}
                </span>
              </button>
            </div>
          );
        })}

        {/* Desktop Context Menu (Rechtsklick auf Desktop-Hintergrund) */}
        {desktopContextMenu && (
          <div
            style={{ left: `${desktopContextMenu.x}px`, top: `${desktopContextMenu.y}px` }}
            className="fixed z-50 w-56 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-scale-up text-xs font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleAutoArrangeDesktop}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 transition"
            >
              <Boxes className="w-4 h-4 text-indigo-500" />
              <span>Symbole links anordnen</span>
            </button>
            <button
              onClick={handleSnapDesktopToGrid}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 transition"
            >
              <Sliders className="w-4 h-4 text-indigo-500" />
              <span>Am Raster ausrichten</span>
            </button>
            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
            <button
              onClick={() => {
                openWindow('appstore', 'App Store');
                setDesktopContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 transition"
            >
              <Package className="w-4 h-4 text-purple-500" />
              <span>App Store öffnen</span>
            </button>
            <button
              onClick={() => {
                openWindow('settings', 'Einstellungen');
                setDesktopContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 transition"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>System-Einstellungen</span>
            </button>
          </div>
        )}

        {/* 0.6s Hover Tooltip for Desktop App & Folder Names */}
        {desktopTooltip && (
          <div
            style={{
              left: `${desktopTooltip.x}px`,
              top: `${desktopTooltip.y}px`,
              transform: 'translateX(-50%)'
            }}
            className="fixed z-50 pointer-events-none px-2.5 py-1 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold shadow-2xl border border-slate-700/80 backdrop-blur-xl animate-fade-in flex flex-col items-center max-w-xs text-center select-none"
          >
            <span>{desktopTooltip.text}</span>
            {desktopTooltip.subtext && (
              <span className="text-[10px] text-slate-300 font-normal mt-0.5">{desktopTooltip.subtext}</span>
            )}
          </div>
        )}
      </div>

      {/* 4. Floating Windows Layer */}
      {windows.map((win) => {
        if (win.isMinimized) return null;

        const isActive = activeWindowId === win.id;
        const meta = shortcutMeta[win.module] || { icon: Boxes, color: 'bg-indigo-600' };
        const WindowIcon = meta.icon;

        return (
          <div
            key={win.id}
            onClick={() => focusWindow(win.id)}
            style={{
              zIndex: win.zIndex,
              width: win.isMaximized ? '100vw' : `${win.width}px`,
              height: win.isMaximized ? 'calc(100vh - 48px)' : `${win.height}px`,
              top: win.isMaximized ? 0 : `${win.y}px`,
              left: win.isMaximized ? 0 : `${win.x}px`,
              position: 'absolute',
              ...(isActive && !win.isMaximized ? {
                borderColor: 'var(--accent, #4f46e5)',
                boxShadow: '0 20px 40px -15px var(--accent-ring, rgba(79, 70, 229, 0.3)), 0 0 0 1px var(--accent, #4f46e5)'
              } : {})
            }}
            className={`flex flex-col bg-white dark:bg-slate-900 ${
              win.isMaximized ? 'rounded-none border-0' : 'rounded-2xl border'
            } ${
              isActive 
                ? 'shadow-2xl' 
                : 'border-slate-300 dark:border-slate-800 shadow-xl opacity-98'
            } overflow-hidden ${
              draggedWindow?.id === win.id || resizingWindow?.id === win.id 
                ? 'transition-none select-none' 
                : 'transition-[width,height,border-radius,top,left] duration-150 ease-out'
            } animate-window-open`}
          >
            {/* Windows 11 Titlebar */}
            <div
              onMouseDown={(e) => startDrag(win.id, e)}
              onPointerDown={(e) => startDrag(win.id, e)}
              onDoubleClick={(e) => toggleMaximizeWindow(win.id, e)}
              className={`h-10 px-3.5 flex items-center justify-between cursor-move select-none ${
                isActive 
                  ? 'bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700' 
                  : 'bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-5 h-5 rounded-lg ${meta.color} text-white flex items-center justify-center flex-shrink-0 shadow-xs`}>
                  <WindowIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {win.title}
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  [{win.module.toUpperCase()}]
                </span>
              </div>

              {/* Windows Window Buttons: Snap Assist, Minimize, Maximize, Close */}
              <div className="flex items-center gap-1 -mr-1">
                {/* Snap Layout Quick Actions (Links / Rechts teilen) */}
                <button
                  onClick={(e) => { e.stopPropagation(); snapWindowTo(win.id, 'left'); }}
                  title="Fenster links andocken (50% Split-View)"
                  className="w-7 h-7 hidden sm:flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); snapWindowTo(win.id, 'right'); }}
                  title="Fenster rechts andocken (50% Split-View)"
                  className="w-7 h-7 hidden sm:flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <PanelRight className="w-3.5 h-3.5" />
                </button>

                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:block" />

                <button
                  onClick={(e) => minimizeWindow(win.id, e)}
                  title="Minimieren"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => toggleMaximizeWindow(win.id, e)}
                  title={win.isMaximized ? 'Wiederherstellen' : 'Maximieren'}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  {win.isMaximized ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  onClick={(e) => closeWindow(win.id, e)}
                  title="Schließen"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-rose-600 active:bg-rose-700 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Window Content Body with sleek inner scroll */}
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 text-slate-900 dark:text-slate-100">
              {win.module === 'dashboard' && (
                <Dashboard
                  invoices={invoices}
                  products={products}
                  stockMoves={stockMoves}
                  contacts={contacts}
                  purchases={purchases}
                  posOrders={posOrders}
                  company={company}
                  onNavigate={(mod) => openWindow(mod)}
                  onOpenNewInvoice={() => openWindow('invoices', 'Rechnungen & Fakturierung')}
                  onOpenNewContact={() => openWindow('contacts', 'Kontakte & Kunden')}
                  onOpenStockTransfer={() => openWindow('stock', 'Lager & Warenbewegungen')}
                  currency={company.currency}
                />
              )}

              {win.module === 'invoices' && (
                <InvoicesModule
                  invoices={invoices}
                  contacts={contacts}
                  products={products}
                  company={company}
                  onRefresh={onRefreshData}
                  isCreateOpen={false}
                  onCloseCreate={() => {}}
                  onOpenCreate={() => {}}
                />
              )}

              {win.module === 'accounting' && (
                <AccountingModule
                  invoices={invoices}
                  purchases={purchases}
                  posOrders={posOrders}
                  company={company}
                />
              )}

              {win.module === 'contacts' && (
                <ContactsModule
                  contacts={contacts}
                  invoices={invoices}
                  onRefresh={onRefreshData}
                  onCreateInvoiceForContact={(c) => openWindow('invoices', `Rechnung für ${c.name}`)}
                  currency={company.currency}
                />
              )}

              {win.module === 'products' && (
                <ProductsModule
                  products={products}
                  invoices={invoices}
                  stockMoves={stockMoves}
                  onRefresh={onRefreshData}
                  onOpenStockTransfer={() => openWindow('stock', 'Lagerbuchung')}
                  currency={company.currency}
                />
              )}

              {win.module === 'stock' && (
                <StockMovesModule
                  stockMoves={stockMoves}
                  products={products}
                  onRefresh={onRefreshData}
                  isTransferModalOpen={false}
                  onCloseTransferModal={() => {}}
                  onOpenTransferModal={() => {}}
                />
              )}

              {win.module === 'pos' && (
                <POSModule
                  products={products}
                  contacts={contacts}
                  companyProfile={company}
                  onRefreshData={onRefreshData}
                />
              )}

              {win.module === 'purchases' && (
                <PurchasesModule
                  purchases={purchases}
                  contacts={contacts}
                  products={products}
                  companyProfile={company}
                  onRefreshData={onRefreshData}
                />
              )}

              {win.module === 'restaurant' && (
                <RestaurantModule
                  companyProfile={company}
                  onRefreshData={onRefreshData}
                />
              )}

              {win.module === 'ios_billing' && (
                <IOSBillingModule
                  companyProfile={company}
                />
              )}

              {win.module === 'support_services' && (
                <SupportServicesModule
                  contacts={contacts}
                  companyProfile={company}
                  onCreateInvoiceForService={(ticket) => openWindow('invoices', `Rechnung für ${ticket.contact_name}`)}
                />
              )}

              {win.module === 'appstore' && (
                <AppStoreModule
                  installedModules={installedModules}
                  pinnedDesktopModules={pinnedDesktop}
                  pinnedTaskbarModules={pinnedTaskbar}
                  onToggleInstallModule={handleToggleInstall}
                  onTogglePinDesktop={handleTogglePinDesktop}
                  onTogglePinTaskbar={handleTogglePinTaskbar}
                  onLaunchModule={(mod) => openWindow(mod)}
                />
              )}

              {win.module === 'docs' && (
                <DocumentationApp />
              )}

              {win.module === 'settings' && (
                <SettingsModule
                  company={company}
                  onUpdateCompany={onUpdateCompany}
                  onFullReset={onRefreshData}
                  isDark={isDark}
                  onToggleTheme={onToggleTheme}
                  isMuted={isMuted}
                  onToggleSound={onToggleSound}
                  invoices={invoices}
                  onOpenWindowsModal={() => setIsWindowsModalOpen(true)}
                />
              )}
            </div>

            {/* Windows 8-Direction Drag & Resize Handles with visual indicators */}
            {!win.isMaximized && (
              <>
                {/* 4 Edges */}
                <div
                  onMouseDown={(e) => startResize(win.id, 'n', e)}
                  onPointerDown={(e) => startResize(win.id, 'n', e)}
                  className="absolute top-0 left-3 right-3 h-2 cursor-n-resize z-40 hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors"
                  title="Nach oben/unten ziehen"
                />
                <div
                  onMouseDown={(e) => startResize(win.id, 's', e)}
                  onPointerDown={(e) => startResize(win.id, 's', e)}
                  className="absolute bottom-0 left-3 right-3 h-2 cursor-s-resize z-40 hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors"
                  title="Nach oben/unten ziehen"
                />
                <div
                  onMouseDown={(e) => startResize(win.id, 'w', e)}
                  onPointerDown={(e) => startResize(win.id, 'w', e)}
                  className="absolute left-0 top-3 bottom-3 w-2 cursor-w-resize z-40 hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors"
                  title="Nach links/rechts ziehen"
                />
                <div
                  onMouseDown={(e) => startResize(win.id, 'e', e)}
                  onPointerDown={(e) => startResize(win.id, 'e', e)}
                  className="absolute right-0 top-3 bottom-3 w-2 cursor-e-resize z-40 hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors"
                  title="Nach links/rechts ziehen"
                />

                {/* 4 Corners */}
                <div
                  onMouseDown={(e) => startResize(win.id, 'nw', e)}
                  onPointerDown={(e) => startResize(win.id, 'nw', e)}
                  className="absolute top-0 left-0 w-3.5 h-3.5 cursor-nw-resize z-50 hover:bg-indigo-500/40 rounded-tl-xl transition-colors"
                />
                <div
                  onMouseDown={(e) => startResize(win.id, 'ne', e)}
                  onPointerDown={(e) => startResize(win.id, 'ne', e)}
                  className="absolute top-0 right-0 w-3.5 h-3.5 cursor-ne-resize z-50 hover:bg-indigo-500/40 rounded-tr-xl transition-colors"
                />
                <div
                  onMouseDown={(e) => startResize(win.id, 'sw', e)}
                  onPointerDown={(e) => startResize(win.id, 'sw', e)}
                  className="absolute bottom-0 left-0 w-3.5 h-3.5 cursor-sw-resize z-50 hover:bg-indigo-500/40 rounded-bl-xl transition-colors"
                />
                <div
                  onMouseDown={(e) => startResize(win.id, 'se', e)}
                  onPointerDown={(e) => startResize(win.id, 'se', e)}
                  className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-50 flex items-end justify-end p-1 select-none group"
                  title="Größe anpassen"
                >
                  <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-slate-400 dark:border-slate-500 group-hover:border-indigo-500 rounded-br-xs transition-colors" />
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* 5. Windows 11 Start Menu Overlay */}
      {isStartMenuOpen && (
        <div 
          ref={startMenuRef}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute bottom-14 left-4 z-50 w-96 max-w-[92vw] ${
          isDark 
            ? 'bg-slate-900/95 border-slate-700/80 text-white' 
            : 'bg-white/95 border-slate-200/90 text-slate-900'
        } backdrop-blur-2xl border rounded-3xl shadow-2xl p-5 animate-fade-in flex flex-col justify-between`}
        >
          
          {/* Start Menu Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <SocdofLogo size="md" className="shadow-md flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm">{company.name}</h4>
                <p className="text-[11px] text-slate-400">SOCDOF &bull; Offline Flow OS</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRestoreStandardApps}
                title="Standard-Apps auf dem Desktop & Taskleiste wiederherstellen"
                className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] font-semibold flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Standard-Apps</span>
              </button>

              <button
                onClick={() => { setIsStartMenuOpen(false); onOpenStudio(); }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-purple-600 dark:text-purple-400 text-xs font-semibold flex items-center gap-1 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Studio</span>
              </button>
            </div>
          </div>

          {/* Search bar inside Start Menu */}
          <div className="py-2.5" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="App oder Beleg suchen..."
                value={startSearch}
                onChange={(e) => setStartSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Start Menu Pinned Apps Grid */}
          <div className="py-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Angeheftete Apps
              </span>
              <button
                onClick={() => openWindow('appstore', 'SOCDOF App Store')}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Alle anzeigen ({installedModules.length})
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
              {startMenuItems.map(modId => {
                const meta = shortcutMeta[modId];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <button
                    key={modId}
                    onClick={() => openWindow(modId, meta.title)}
                    className="flex flex-col items-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition text-center group"
                  >
                    <div className={`w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center text-white mb-1 shadow-xs group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-medium truncate max-w-[70px]">
                      {meta.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Links: Language, Docs, GitHub & Discord */}
          <div className="py-2 grid grid-cols-4 gap-1.5">
            <button
              onClick={() => { sounds.playClick(); setIsLanguageModalOpen(true); }}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition border border-emerald-200 dark:border-emerald-800/40"
              title="Sprache ändern / Change Language (Standard: English)"
            >
              <FlagIcon code={getLanguage()} size="sm" />
              <span className="uppercase font-bold tracking-wider">{getLanguage()}</span>
            </button>
            <button
              onClick={() => openWindow('docs', 'Dokumentation & Handbuch')}
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-[11px] font-semibold hover:bg-sky-100 dark:hover:bg-sky-900/40 transition border border-sky-200 dark:border-sky-800/40"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Handbuch</span>
            </button>
            <a
              href="https://github.com/Strudelcode/SOCDOF"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://discord.gg/QW85EaXTgB"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-[#5865F2]/10 text-[#5865F2] dark:text-indigo-300 text-[11px] font-semibold hover:bg-[#5865F2]/20 transition border border-[#5865F2]/30"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Discord</span>
            </a>
          </div>

          {/* Bottom Footer Actions: Power Button & User */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                {company.name.charAt(0)}
              </div>
              <span className="text-xs font-bold truncate max-w-[120px]">{company.name}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onToggleTheme}
                title="Design wechseln"
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
              </button>

              <button
                onClick={() => setIsPowerMenuOpen(!isPowerMenuOpen)}
                title="Beenden & Energieoptionen"
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-700 dark:text-slate-300 transition"
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Power / Beenden Modal Dialog (SOCDOF wirklich schließen?) */}
      {isPowerMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-900 dark:text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md">
                  <Power className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">SOCDOF beenden?</h3>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Desktop-Umgebung schließen</div>
                </div>
              </div>
              <button
                onClick={() => setIsPowerMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Möchten Sie die SOCDOF Arbeitsumgebung jetzt beenden? Alle Rechnungen, Buchungen, Lagerbewegungen und Einstellungen bleiben lokal sicher in Ihrer Datenbank gespeichert.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={handleShutdown}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 text-left transition group"
              >
                <Power className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-xs font-bold">SOCDOF jetzt beenden</div>
                  <div className="text-[11px] opacity-80">Schließt alle offenen Arbeitsfenster und sperrt die Sitzung.</div>
                </div>
              </button>

              <button
                onClick={handleRestart}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 text-left transition group"
              >
                <RotateCcw className="w-5 h-5 flex-shrink-0 group-hover:rotate-45 transition-transform" />
                <div>
                  <div className="text-xs font-bold">Arbeitsbereich neu starten</div>
                  <div className="text-[11px] opacity-80">Startet die Desktop-Umgebung frisch und aufgeräumt neu.</div>
                </div>
              </button>

              <button
                onClick={() => setIsPowerMenuOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Authentic Windows 11 Taskbar with Accent & Tint Customization */}
      <div 
        className={`relative z-40 h-12 backdrop-blur-xl border-t px-3 flex items-center justify-between text-xs transition-colors duration-300 ${
          company.taskbar_tint === 'accent'
            ? 'taskbar-tinted text-slate-800 dark:text-slate-100'
            : company.taskbar_tint === 'dark'
            ? 'bg-slate-950/95 border-slate-800 text-slate-200 shadow-2xl'
            : company.taskbar_tint === 'glass'
            ? 'bg-white/40 dark:bg-slate-900/40 border-white/20 dark:border-white/10 text-slate-800 dark:text-slate-200 backdrop-blur-2xl'
            : isDark 
            ? 'bg-slate-900/90 border-slate-800/80 text-slate-300' 
            : 'bg-white/90 border-slate-200/90 text-slate-700'
        }`}
        style={company.taskbar_tint === 'accent' ? {
          backgroundColor: 'var(--accent-taskbar-bg, rgba(79, 70, 229, 0.2))',
          borderTopColor: 'var(--accent-taskbar-border, rgba(79, 70, 229, 0.45))'
        } : undefined}
      >
        
        {/* Left / Center: Start Button + Unified Taskbar Apps */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {/* Windows Start Button */}
          <button
            ref={startButtonRef}
            onClick={() => {
              sounds.playClick();
              setIsStartMenuOpen(!isStartMenuOpen);
            }}
            title="Start - SOCDOF OS"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition ${
              isStartMenuOpen 
                ? 'ring-2 shadow-md scale-105' 
                : 'hover:bg-slate-200/60 dark:hover:bg-white/10 active:scale-95'
            }`}
            style={isStartMenuOpen ? {
              backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.25))',
              outlineColor: 'var(--accent, #4f46e5)'
            } : undefined}
          >
            <SocdofLogo size="sm" />
          </button>

          {/* Unified Windows 11 Taskbar App Items */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-[60vw]">
            {(() => {
              const taskbarModules = [...pinnedTaskbar];
              windows.forEach(w => {
                if (!taskbarModules.includes(w.module)) {
                  taskbarModules.push(w.module);
                }
              });

              return taskbarModules.map((modId, index) => {
                const meta = shortcutMeta[modId];
                if (!meta) return null;
                const Icon = meta.icon;
                const openWin = windows.find(w => w.module === modId);
                const isOpen = Boolean(openWin);
                const isActive = Boolean(openWin && activeWindowId === openWin.id && !openWin.isMinimized);
                const isMinimized = Boolean(openWin && openWin.isMinimized);
                const isPinned = pinnedTaskbar.includes(modId);
                const badge = getBadgeForModule(modId);

                const handleTaskbarClick = (e: React.MouseEvent) => {
                  sounds.playClick();
                  if (!openWin) {
                    openWindow(modId, meta.title);
                  } else if (isMinimized) {
                    focusWindow(openWin.id);
                  } else if (isActive) {
                    minimizeWindow(openWin.id, e);
                  } else {
                    focusWindow(openWin.id);
                  }
                };

                return (
                  <div
                    key={modId}
                    draggable={isPinned}
                    onDragStart={(e) => {
                      if (isPinned) {
                        setDraggedTaskbarIdx(index);
                        e.dataTransfer.setData('text/plain', `${index}`);
                      }
                    }}
                    onDragOver={(e) => {
                      if (isPinned) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (isPinned) {
                        e.preventDefault();
                        handleTaskbarReorder(index);
                      }
                    }}
                    className={`relative ${isPinned ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <button
                      onClick={handleTaskbarClick}
                      title={`${meta.title}${isOpen ? (isActive ? ' (Aktiv)' : isMinimized ? ' (Minimiert)' : ' (Geöffnet)') : ''}`}
                      className={`group h-9 min-w-[38px] px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition relative active:scale-95 ${
                        draggedTaskbarIdx === index ? 'opacity-40 scale-90' : ''
                      } ${
                        isActive 
                          ? isDark 
                            ? 'bg-slate-800 text-white shadow-xs' 
                            : 'bg-slate-200/90 text-slate-900 shadow-xs'
                          : isOpen
                            ? isDark 
                              ? 'bg-slate-800/40 hover:bg-slate-800/80 text-slate-300' 
                              : 'bg-slate-200/50 hover:bg-slate-200/90 text-slate-700'
                            : isDark 
                              ? 'hover:bg-white/10 text-slate-400 hover:text-white' 
                              : 'hover:bg-black/5 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon 
                        className="w-4 h-4 flex-shrink-0" 
                        style={isActive ? { color: 'var(--accent, #4f46e5)' } : undefined}
                      />
                      
                      {/* Actionable Notification Dot / Count Badge */}
                      {badge !== undefined && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs border border-white dark:border-slate-900">
                          {badge}
                        </span>
                      )}

                      {/* Windows 11 Active Underline Bar Indicator */}
                      {isOpen && (
                        <span 
                          className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full transition-all ${
                            isActive 
                              ? 'w-4 h-1 shadow-xs' 
                              : 'w-2 h-0.5 bg-slate-400 dark:bg-slate-500'
                          }`} 
                          style={isActive ? { backgroundColor: 'var(--accent, #4f46e5)' } : undefined}
                        />
                      )}
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Right: System Tray & Actions */}
        <div className="flex items-center gap-1.5">
          {/* Language Selector in Taskbar Tray */}
          <button
            onClick={() => { sounds.playClick(); setIsLanguageModalOpen(true); }}
            title="Sprache ändern / Change Language (Standard: English)"
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 text-[11px] font-extrabold transition border border-slate-300/80 dark:border-slate-700"
          >
            <FlagIcon code={getLanguage()} size="sm" />
            <span className="uppercase tracking-wider">{getLanguage()}</span>
          </button>

          {/* Tutorial Button in Taskbar */}
          <button
            onClick={() => { sounds.playClick(); setIsTutorialOpen(true); }}
            title="Interaktives Tutorial & Einführung"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Tutorial</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={isMuted ? 'Ton aktivieren' : 'Ton stummschalten'}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Live Digital Clock & Calendar Trigger */}
          <button
            ref={clockTrayButtonRef}
            onClick={() => {
              sounds.playClick();
              setIsCalendarFlyoutOpen(!isCalendarFlyoutOpen);
            }}
            title="Datum, Uhrzeit & Kalender öffnen"
            className={`text-right px-2.5 py-1 rounded-xl transition cursor-pointer select-none active:scale-95 ${
              isCalendarFlyoutOpen
                ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40 shadow-xs'
                : 'hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              {currentTime.toLocaleTimeString([], company.time_show_seconds !== false 
                ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
                : { hour: '2-digit', minute: '2-digit' }
              )}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {formatSystemDate(currentTime, company.date_format || 'DD.MM.YYYY')}
            </div>
          </button>
        </div>
      </div>

      {/* Windows 11 Style Calendar & Agenda Flyout Popup */}
      {isCalendarFlyoutOpen && (
        <div
          ref={calendarFlyoutRef}
          className="fixed bottom-14 right-3 z-50 w-84 max-w-[94vw] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 rounded-3xl shadow-2xl p-4 text-slate-900 dark:text-slate-100 animate-scale-in"
          style={{ transformOrigin: 'bottom right' }}
        >
          {/* Header with full time and date */}
          <div className="pb-3 mb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 capitalize">
                {currentTime.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <button
              onClick={() => {
                const now = new Date();
                setCalendarViewDate(now);
                setSelectedCalendarDate(now);
                sounds.playClick();
              }}
              title="Auf Heute zurücksetzen"
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 transition"
            >
              Heute
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="font-extrabold text-sm capitalize text-slate-800 dark:text-slate-200">
              {calendarViewDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  sounds.playClick();
                  setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
                title="Vorheriger Monat"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
                title="Nächster Monat"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
            <span>Mo</span>
            <span>Di</span>
            <span>Mi</span>
            <span>Do</span>
            <span>Fr</span>
            <span>Sa</span>
            <span>So</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center mb-3">
            {calendarDays.map((item, idx) => {
              return (
                <button
                  key={idx}
                  onClick={() => {
                    sounds.playClick();
                    setSelectedCalendarDate(item.date);
                  }}
                  className={`h-8 rounded-xl text-xs font-semibold relative flex items-center justify-center transition ${
                    item.isSelected
                      ? 'bg-indigo-600 text-white font-bold shadow-md scale-105'
                      : item.isToday
                      ? 'ring-2 ring-indigo-500 font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40'
                      : item.isCurrentMonth
                      ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                      : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
                  }`}
                >
                  <span>{item.dayNum}</span>
                  {item.hasEvent && !item.isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-rose-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Agenda / Upcoming Due Invoices & Deadlines */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>Termine & Fälligkeiten</span>
              </div>
              <button
                onClick={() => {
                  sounds.playClick();
                  setIsCalendarFlyoutOpen(false);
                  openWindow('invoices', 'Rechnungen');
                }}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Alle Rechnungen
              </button>
            </div>

            {selectedDateInvoices.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {selectedDateInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      setIsCalendarFlyoutOpen(false);
                      openWindow('invoices', 'Rechnungen');
                    }}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer transition border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="truncate mr-2">
                      <div className="font-bold truncate text-slate-800 dark:text-slate-200">{inv.number} • {inv.customer_name}</div>
                      <div className="text-[10px] text-slate-500">{inv.status === 'paid' ? 'Bezahlt' : 'Fällig'} am {inv.due_date}</div>
                    </div>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      {inv.total_gross.toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>
            ) : openInvoicesUpcoming.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                <div className="text-[10px] text-slate-400 italic mb-1">Nächste offene Posten:</div>
                {openInvoicesUpcoming.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      setIsCalendarFlyoutOpen(false);
                      openWindow('invoices', 'Rechnungen');
                    }}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer transition border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between text-xs"
                  >
                    <div className="truncate mr-2">
                      <div className="font-bold truncate text-slate-800 dark:text-slate-200">{inv.number} • {inv.customer_name}</div>
                      <div className="text-[10px] text-slate-500">Fällig: {inv.due_date || 'Kein Datum'}</div>
                    </div>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 flex-shrink-0">
                      {inv.total_gross.toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-slate-400">
                Keine anstehenden Fälligkeiten
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop App Folder Modal (Android / iOS Style Overlay) */}
      <DesktopFolderModal
        folder={activeFolderModal}
        isOpen={Boolean(activeFolderModal)}
        onClose={() => setActiveFolderModal(null)}
        onLaunchModule={(mod) => openWindow(mod)}
        onRenameFolder={handleRenameFolder}
        onRemoveFromFolder={handleRemoveFromFolder}
        onDissolveFolder={handleDissolveFolder}
        shortcutMeta={shortcutMeta}
        isDark={isDark}
      />

      {/* Interactive Step-by-Step Tutorial Wizard */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onOpenModule={(mod) => openWindow(mod)}
        onOpenStartMenu={() => setIsStartMenuOpen(true)}
      />

      {/* Windows Desktop Manager Modal */}
      <WindowsDesktopManagerModal
        isOpen={isWindowsModalOpen}
        onClose={() => setIsWindowsModalOpen(false)}
      />

      {/* Language Selection Modal */}
      <LanguageSelectionModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        currentLanguage={getLanguage()}
        onSelectLanguage={(lang) => {
          setLanguage(lang);
          onUpdateCompany({ ...company, language: lang });
        }}
      />

      {/* Windows Desktop .EXE Notification Toast (Disabled if dismissed or in desktop app) */}
      <WindowsExeNotificationToast
        disabled={Boolean(company.disable_exe_reminders)}
        onOpenWindowsManager={() => setIsWindowsModalOpen(true)}
      />
    </div>
  );
};
