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
  PinOff,
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
  Headphones,
  User,
  Plus,
  StickyNote,
  Zap
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
  DesktopFolder,
  VirtualDesktop,
  DesktopWidget,
  DesktopWidgetType
} from '../types';
import { sounds } from '../lib/sound';
import { applyAccentColor } from '../lib/accent';
import { getLanguage, setLanguage, useLanguage, t, formatSystemDate, formatSystemTime, LanguageCode, formatShortcut } from '../lib/i18n';
import { getStoredCalendarEvents, CustomCalendarEvent } from '../lib/ical';
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
import { SettingsModule, type SettingsSection } from './SettingsModule';
import { AccountingModule } from './AccountingModule';
import { AppStoreModule } from './AppStoreModule';
import { DocumentationApp } from './DocumentationApp';
import { TutorialModal } from './TutorialModal';
import { WindowsDesktopManagerModal } from './WindowsDesktopManagerModal';
import { DesktopFolderModal } from './DesktopFolderModal';
import { RestaurantModule } from './RestaurantModule';
import { IOSBillingModule } from './IOSBillingModule';
import { SupportServicesModule } from './SupportServicesModule';
import { CalendarModule } from './CalendarModule';
import { DynamicCalendarIcon } from './DynamicCalendarIcon';
import { buildUnifiedCalendarEvents, formatLocalDate, isEventOnDate } from '../lib/googleCalendar';
import { SocdofLogo } from './SocdofLogo';
import { isElectron, GITHUB_RELEASES_URL, quitDesktopApp } from '../lib/platform';
import { WebPreviewModal } from './WebPreviewModal';
import { UpdatePromptModal } from './UpdatePromptModal';
import { checkForAppUpdates, isVersionSkipped, isUpdateSnoozed, UpdateInfo } from '../lib/updateChecker';
import { CommandPaletteModal } from './CommandPaletteModal';
import { TaskViewModal } from './TaskViewModal';
import { DesktopWidgetsLayer } from './DesktopWidgetsLayer';
import { DesktopWidgetsModal } from './DesktopWidgetsModal';
import { WidgetsModule } from './WidgetsModule';
import { WidgetsIcon } from './WidgetsIcon';

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
  'products', 'stock', 'purchases', 'calendar', 'docs', 'settings', 'appstore'
];

export const DEFAULT_PINNED_DESKTOP: ActiveModule[] = [
  'dashboard', 'invoices', 'accounting', 'contacts', 
  'products', 'stock', 'purchases', 'calendar', 'appstore', 'docs', 'settings'
];

export const DEFAULT_PINNED_TASKBAR: ActiveModule[] = [
  'dashboard', 'invoices', 'accounting', 'contacts', 'calendar', 'settings'
];

export const SYSTEM_CORE_MODULES: ActiveModule[] = [
  'settings', 'dashboard', 'appstore', 'docs'
];

// Windows Desktop Grid Configuration (104px horizontal, 96px vertical)
const DESKTOP_GRID_ORIGIN_X = 24;
const DESKTOP_GRID_ORIGIN_Y = 24;
const DESKTOP_GRID_STEP_X = 104;
const DESKTOP_GRID_STEP_Y = 96;
const DESKTOP_GRID_MAX_ROWS = 6;

// Helper to find the next free grid slot without collisions
function findNextFreeDesktopSlot(occupiedKeys: Set<string>): { x: number; y: number } {
  let col = 0;
  let row = 0;
  for (let i = 0; i < 300; i++) {
    const key = `${col},${row}`;
    if (!occupiedKeys.has(key)) {
      occupiedKeys.add(key);
      return {
        x: DESKTOP_GRID_ORIGIN_X + col * DESKTOP_GRID_STEP_X,
        y: DESKTOP_GRID_ORIGIN_Y + row * DESKTOP_GRID_STEP_Y
      };
    }
    row++;
    if (row >= DESKTOP_GRID_MAX_ROWS) {
      row = 0;
      col++;
    }
  }
  return {
    x: DESKTOP_GRID_ORIGIN_X + col * DESKTOP_GRID_STEP_X,
    y: DESKTOP_GRID_ORIGIN_Y + row * DESKTOP_GRID_STEP_Y
  };
}

// Function to resolve collisions and guarantee unique non-overlapping coordinates for all items
function resolveAllDesktopPositions(
  pinned: ActiveModule[],
  folders: DesktopFolder[],
  currentPositions: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {};
  const occupiedSlots = new Set<string>();

  const allItemIds = [...pinned, ...folders.map(f => f.id)];

  allItemIds.forEach(id => {
    const saved = currentPositions[id];
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      const snapCol = Math.max(0, Math.round((saved.x - DESKTOP_GRID_ORIGIN_X) / DESKTOP_GRID_STEP_X));
      const snapRow = Math.max(0, Math.round((saved.y - DESKTOP_GRID_ORIGIN_Y) / DESKTOP_GRID_STEP_Y));
      const key = `${snapCol},${snapRow}`;
      if (!occupiedSlots.has(key)) {
        occupiedSlots.add(key);
        result[id] = {
          x: DESKTOP_GRID_ORIGIN_X + snapCol * DESKTOP_GRID_STEP_X,
          y: DESKTOP_GRID_ORIGIN_Y + snapRow * DESKTOP_GRID_STEP_Y
        };
        return;
      }
    }
    // Slot collision or unassigned: allocate next available free grid position
    result[id] = findNextFreeDesktopSlot(occupiedSlots);
  });

  return result;
}

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

  // Automatically validate and resolve any coordinate collisions on desktop
  useEffect(() => {
    setDesktopPositions(prev => {
      const resolved = resolveAllDesktopPositions(pinnedDesktop, desktopFolders, prev);
      const isDifferent = Object.keys(resolved).some(k => !prev[k] || prev[k].x !== resolved[k].x || prev[k].y !== resolved[k].y);
      if (isDifferent) {
        try { localStorage.setItem('odoo_desktop_icon_positions', JSON.stringify(resolved)); } catch {}
        return resolved;
      }
      return prev;
    });
  }, [pinnedDesktop, desktopFolders]);

  const [draggedDesktopItem, setDraggedDesktopItem] = useState<{
    id: string;
    type: 'app' | 'folder';
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [dragPreviewPos, setDragPreviewPos] = useState<{
    x: number;
    y: number;
    col: number;
    row: number;
  } | null>(null);

  const [desktopContextMenu, setDesktopContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [desktopIconContextMenu, setDesktopIconContextMenu] = useState<{ x: number; y: number; modId: ActiveModule } | null>(null);
  const [startMenuIconContextMenu, setStartMenuIconContextMenu] = useState<{ x: number; y: number; modId: ActiveModule } | null>(null);
  const [taskbarIconContextMenu, setTaskbarIconContextMenu] = useState<{ x: number; y: number; modId: ActiveModule } | null>(null);
  const desktopCanvasRef = useRef<HTMLDivElement>(null);

  // Desktop App Name Tooltip State with ~0.6s hover delay for truncated or full titles
  const [desktopTooltip, setDesktopTooltip] = useState<{
    text: string;
    subtext?: string;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  const hasAnyContextMenu = !!(desktopContextMenu || desktopIconContextMenu || startMenuIconContextMenu || taskbarIconContextMenu);

  const closeAllContextMenus = () => {
    setDesktopContextMenu(null);
    setDesktopIconContextMenu(null);
    setStartMenuIconContextMenu(null);
    setTaskbarIconContextMenu(null);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setDesktopTooltip(null);
  };

  const getDesktopPosition = (id: string, index: number) => {
    if (desktopPositions[id]) {
      return desktopPositions[id];
    }
    const col = Math.floor(index / DESKTOP_GRID_MAX_ROWS);
    const row = index % DESKTOP_GRID_MAX_ROWS;
    return {
      x: DESKTOP_GRID_ORIGIN_X + col * DESKTOP_GRID_STEP_X,
      y: DESKTOP_GRID_ORIGIN_Y + row * DESKTOP_GRID_STEP_Y
    };
  };

  const handleAutoArrangeDesktop = () => {
    sounds.playClick();
    const nextPositions: Record<string, { x: number; y: number }> = {};
    const allItemIds = [...pinnedDesktop, ...desktopFolders.map(f => f.id)];
    allItemIds.forEach((id, index) => {
      const col = Math.floor(index / DESKTOP_GRID_MAX_ROWS);
      const row = index % DESKTOP_GRID_MAX_ROWS;
      nextPositions[id] = {
        x: DESKTOP_GRID_ORIGIN_X + col * DESKTOP_GRID_STEP_X,
        y: DESKTOP_GRID_ORIGIN_Y + row * DESKTOP_GRID_STEP_Y
      };
    });
    setDesktopPositions(nextPositions);
    try { localStorage.setItem('odoo_desktop_icon_positions', JSON.stringify(nextPositions)); } catch {}
    closeAllContextMenus();
  };

  const handleSnapDesktopToGrid = () => {
    sounds.playClick();
    setDesktopPositions(prev => {
      const resolved = resolveAllDesktopPositions(pinnedDesktop, desktopFolders, prev);
      try { localStorage.setItem('odoo_desktop_icon_positions', JSON.stringify(resolved)); } catch {}
      return resolved;
    });
    closeAllContextMenus();
  };

  const handleDesktopCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = desktopCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const rawData = e.dataTransfer.getData('text/plain');
    const itemId = draggedDesktopItem?.id || rawData;
    if (!itemId) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const offsetX = draggedDesktopItem?.offsetX ?? 48;
    const offsetY = draggedDesktopItem?.offsetY ?? 44;

    const targetX = mouseX - offsetX;
    const targetY = mouseY - offsetY;

    // Snap to Grid coordinates
    const snapCol = Math.max(0, Math.round((targetX - DESKTOP_GRID_ORIGIN_X) / DESKTOP_GRID_STEP_X));
    const snapRow = Math.max(0, Math.min(DESKTOP_GRID_MAX_ROWS - 1, Math.round((targetY - DESKTOP_GRID_ORIGIN_Y) / DESKTOP_GRID_STEP_Y)));
    const targetSlotKey = `${snapCol},${snapRow}`;

    let nextX = DESKTOP_GRID_ORIGIN_X + snapCol * DESKTOP_GRID_STEP_X;
    let nextY = DESKTOP_GRID_ORIGIN_Y + snapRow * DESKTOP_GRID_STEP_Y;

    // Check if slot is occupied by another item (and not hovering to merge into a folder)
    const occupiedByOther = Object.entries(desktopPositions).find(([id, rawPos]) => {
      if (id === itemId) return false;
      const pos = rawPos as { x: number; y: number };
      const col = Math.round((pos.x - DESKTOP_GRID_ORIGIN_X) / DESKTOP_GRID_STEP_X);
      const row = Math.round((pos.y - DESKTOP_GRID_ORIGIN_Y) / DESKTOP_GRID_STEP_Y);
      return `${col},${row}` === targetSlotKey;
    });

    if (occupiedByOther && draggedDesktopItem?.type === 'folder') {
      const occupiedSet = new Set<string>();
      Object.entries(desktopPositions).forEach(([id, rawPos]) => {
        if (id !== itemId) {
          const pos = rawPos as { x: number; y: number };
          const c = Math.round((pos.x - DESKTOP_GRID_ORIGIN_X) / DESKTOP_GRID_STEP_X);
          const r = Math.round((pos.y - DESKTOP_GRID_ORIGIN_Y) / DESKTOP_GRID_STEP_Y);
          occupiedSet.add(`${c},${r}`);
        }
      });
      const freeSlot = findNextFreeDesktopSlot(occupiedSet);
      nextX = freeSlot.x;
      nextY = freeSlot.y;
    }

    setDragPreviewPos({
      x: nextX,
      y: nextY,
      col: snapCol,
      row: snapRow
    });
  };

  const handleDesktopCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragPreviewPos(null);
    setDragOverIconId(null);
    const rect = desktopCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const rawData = e.dataTransfer.getData('text/plain');
    const itemId = rawData || draggedDesktopItem?.id;
    if (!itemId) return;

    // If dragged from Start menu or App launcher and not yet on desktop, add it
    if (Object.prototype.hasOwnProperty.call(shortcutMeta, itemId) && !pinnedDesktop.includes(itemId as ActiveModule)) {
      savePinnedDesktop([...pinnedDesktop, itemId as ActiveModule]);
    }

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const offsetX = draggedDesktopItem?.offsetX ?? 48;
    const offsetY = draggedDesktopItem?.offsetY ?? 44;

    const targetX = mouseX - offsetX;
    const targetY = mouseY - offsetY;

    // Snap to Grid coordinates
    const snapCol = Math.max(0, Math.round((targetX - DESKTOP_GRID_ORIGIN_X) / DESKTOP_GRID_STEP_X));
    const snapRow = Math.max(0, Math.min(DESKTOP_GRID_MAX_ROWS - 1, Math.round((targetY - DESKTOP_GRID_ORIGIN_Y) / DESKTOP_GRID_STEP_Y)));
    const targetSlotKey = `${snapCol},${snapRow}`;

    setDesktopPositions(prev => {
      // Check if slot is occupied by ANOTHER item
      const occupiedByOther = Object.entries(prev).find(([id, rawPos]) => {
        if (id === itemId) return false;
        const pos = rawPos as { x: number; y: number };
        const col = Math.round((pos.x - DESKTOP_GRID_ORIGIN_X) / DESKTOP_GRID_STEP_X);
        const row = Math.round((pos.y - DESKTOP_GRID_ORIGIN_Y) / DESKTOP_GRID_STEP_Y);
        return `${col},${row}` === targetSlotKey;
      });

      let nextX = DESKTOP_GRID_ORIGIN_X + snapCol * DESKTOP_GRID_STEP_X;
      let nextY = DESKTOP_GRID_ORIGIN_Y + snapRow * DESKTOP_GRID_STEP_Y;

      // If slot is taken, find the nearest unoccupied slot so items NEVER overlap
      if (occupiedByOther) {
        const occupiedSet = new Set<string>();
        Object.entries(prev).forEach(([id, rawPos]) => {
          if (id !== itemId) {
            const pos = rawPos as { x: number; y: number };
            const c = Math.round((pos.x - DESKTOP_GRID_ORIGIN_X) / DESKTOP_GRID_STEP_X);
            const r = Math.round((pos.y - DESKTOP_GRID_ORIGIN_Y) / DESKTOP_GRID_STEP_Y);
            occupiedSet.add(`${c},${r}`);
          }
        });
        const freeSlot = findNextFreeDesktopSlot(occupiedSet);
        nextX = freeSlot.x;
        nextY = freeSlot.y;
      }

      const next = { ...prev, [itemId]: { x: nextX, y: nextY } };
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
  const [isWebPreviewModalOpen, setIsWebPreviewModalOpen] = useState(false);
  const [isWebPreviewExitMode, setIsWebPreviewExitMode] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Virtual Desktops (Windows 11 Style Task View & Multiple Desktops)
  const [virtualDesktops, setVirtualDesktops] = useState<VirtualDesktop[]>(() => {
    try {
      const saved = localStorage.getItem('socdof_virtual_desktops');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'desktop-1', name: 'Desktop 1', createdAt: new Date().toISOString() },
      { id: 'desktop-2', name: 'Desktop 2', createdAt: new Date().toISOString() }
    ];
  });

  const [activeDesktopId, setActiveDesktopId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('socdof_active_desktop_id');
      if (saved) return saved;
    } catch {}
    return 'desktop-1';
  });

  const [isTaskViewOpen, setIsTaskViewOpen] = useState(false);

  const saveVirtualDesktops = (desktops: VirtualDesktop[]) => {
    setVirtualDesktops(desktops);
    try { localStorage.setItem('socdof_virtual_desktops', JSON.stringify(desktops)); } catch {}
  };

  const handleSelectDesktop = (id: string) => {
    sounds.playClick();
    setActiveDesktopId(id);
    try { localStorage.setItem('socdof_active_desktop_id', id); } catch {}
    setIsTaskViewOpen(false);

    // Update activeWindowId to top unminimized window on the selected desktop
    const desktopWindows = windows
      .filter(w => (!w.desktopId || w.desktopId === 'all' || w.desktopId === id) && !w.isMinimized)
      .sort((a, b) => b.zIndex - a.zIndex);

    if (desktopWindows.length > 0) {
      setActiveWindowId(desktopWindows[0].id);
    } else {
      setActiveWindowId('');
    }
  };

  const handleAddDesktop = () => {
    sounds.playPop();
    const newDesk: VirtualDesktop = {
      id: `desktop-${Date.now()}`,
      name: `Desktop ${virtualDesktops.length + 1}`,
      createdAt: new Date().toISOString()
    };
    const next = [...virtualDesktops, newDesk];
    saveVirtualDesktops(next);
    handleSelectDesktop(newDesk.id);
  };

  const handleRemoveDesktop = (id: string) => {
    if (virtualDesktops.length <= 1) return;
    sounds.playWarning();
    const remaining = virtualDesktops.filter(d => d.id !== id);
    saveVirtualDesktops(remaining);
    const fallbackId = remaining[0].id;
    setWindows(prev => prev.map(w => w.desktopId === id ? { ...w, desktopId: fallbackId } : w));
    if (activeDesktopId === id) {
      handleSelectDesktop(fallbackId);
    }
  };

  const handleRenameDesktop = (id: string, name: string) => {
    const next = virtualDesktops.map(d => d.id === id ? { ...d, name } : d);
    saveVirtualDesktops(next);
  };

  const handleMoveWindowToDesktop = (windowId: string, targetDesktopId: string) => {
    sounds.playPop();
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, desktopId: targetDesktopId } : w));
  };

  // Desktop Mini-Widgets (Sticky Notes, Revenue KPI, Agenda, Clock)
  const [desktopWidgets, setDesktopWidgets] = useState<DesktopWidget[]>(() => {
    try {
      // Clear out legacy sample demo notes from previous sessions if present
      const isCleaned = localStorage.getItem('socdof_widgets_cleaned_v2');
      if (!isCleaned) {
        localStorage.removeItem('socdof_desktop_widgets');
        localStorage.setItem('socdof_widgets_cleaned_v2', 'true');
        return [];
      }
      const saved = localStorage.getItem('socdof_desktop_widgets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((w: any) => w.id !== 'widget-notes-1' && w.id !== 'widget-revenue-1');
        }
      }
    } catch {}
    return [];
  });

  const [isWidgetsModalOpen, setIsWidgetsModalOpen] = useState(false);

  const saveDesktopWidgets = (widgets: DesktopWidget[]) => {
    setDesktopWidgets(widgets);
    try { localStorage.setItem('socdof_desktop_widgets', JSON.stringify(widgets)); } catch {}
  };

  const handleUpdateWidget = (id: string, updates: Partial<DesktopWidget>) => {
    const next = desktopWidgets.map(w => w.id === id ? { ...w, ...updates } : w);
    saveDesktopWidgets(next);
  };

  const handleRemoveWidget = (id: string) => {
    sounds.playClick();
    const next = desktopWidgets.filter(w => w.id !== id);
    saveDesktopWidgets(next);
  };

  const handleAddStickyNote = (options?: { color?: string; content?: string; title?: string }) => {
    sounds.playPop();
    const newNote: DesktopWidget = {
      id: `widget-note-${Date.now()}`,
      type: 'notes',
      kind: 'sticky_note',
      title: options?.title || 'Notiz',
      x: 700 + (desktopWidgets.length % 4) * 20,
      y: 60 + (desktopWidgets.length % 4) * 20,
      width: 260,
      height: 210,
      color: options?.color || 'yellow',
      content: options?.content || '',
      desktopId: activeDesktopId,
      isVisible: true,
      isCollapsed: false,
      createdAt: new Date().toISOString()
    };
    saveDesktopWidgets([...desktopWidgets, newNote]);
  };

  const handleAddWidget = (type: DesktopWidgetType, options?: Partial<DesktopWidget>) => {
    sounds.playPop();
    const newWidget: DesktopWidget = {
      id: `widget-${type}-${Date.now()}`,
      type,
      kind: options?.kind || 'phone_widget',
      size: options?.size || 'medium',
      title: options?.title,
      x: options?.x ?? (680 + (desktopWidgets.length % 4) * 25),
      y: options?.y ?? (50 + (desktopWidgets.length % 4) * 25),
      width: options?.width ?? (type === 'revenue_kpi' ? 290 : type === 'calendar_agenda' ? 280 : type === 'system_clock' ? 240 : 280),
      height: options?.height ?? (type === 'revenue_kpi' ? 170 : type === 'calendar_agenda' ? 180 : type === 'system_clock' ? 140 : 180),
      desktopId: options?.desktopId || activeDesktopId,
      color: options?.color,
      content: options?.content,
      isVisible: true,
      isCollapsed: false,
      createdAt: new Date().toISOString()
    };
    saveDesktopWidgets([...desktopWidgets, newWidget]);
  };

  const handleToggleWidgetVisibility = (id: string) => {
    const next = desktopWidgets.map(w => w.id === id ? { ...w, isVisible: !w.isVisible } : w);
    saveDesktopWidgets(next);
  };

  // Automatic GitHub Release Update Notification state
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdatePromptOpen, setIsUpdatePromptOpen] = useState(false);

  // Background update check on startup (respecting snooze and skipped versions)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const info = await checkForAppUpdates();
        if (info && info.hasUpdate) {
          if (!isVersionSkipped(info.latestVersion) && !isUpdateSnoozed()) {
            setUpdateInfo(info);
            setIsUpdatePromptOpen(true);
            sounds.playPop();
          }
        }
      } catch (err) {
        console.warn('Background update check skipped:', err);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // Detect whether running in native desktop electron or web browser preview
  const isDesktopApp = useMemo(() => isElectron(), []);
  const allowExitRef = useRef(false);

  const handleConfirmLeaveWeb = () => {
    allowExitRef.current = true;
    window.onbeforeunload = null;
    setIsWebPreviewModalOpen(false);
    setIsWebPreviewExitMode(false);
    window.location.href = GITHUB_RELEASES_URL;
  };

  // Windows 11 Calendar & Agenda Flyout State
  const [isCalendarFlyoutOpen, setIsCalendarFlyoutOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());

  const handleIconMouseEnter = (e: React.MouseEvent, title: string, subtext?: string) => {
    if (desktopContextMenu || desktopIconContextMenu || startMenuIconContextMenu || taskbarIconContextMenu) {
      return;
    }
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.bottom + 8;

    tooltipTimeoutRef.current = window.setTimeout(() => {
      if (desktopContextMenu || desktopIconContextMenu || startMenuIconContextMenu || taskbarIconContextMenu) {
        return;
      }
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
  const [dragOverTaskbarIdx, setDragOverTaskbarIdx] = useState<number | null>(null);

  const startMenuRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const calendarFlyoutRef = useRef<HTMLDivElement>(null);
  const clockTrayButtonRef = useRef<HTMLButtonElement>(null);

  // Global Outside Click Listener for Menus (Start Menu, Calendar Flyout, Context Menus)
  useEffect(() => {
    const handleGlobalPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;

      // 1. Close active context menus on ANY click outside a context menu
      if (hasAnyContextMenu) {
        if (!target?.closest?.('[data-context-menu]')) {
          closeAllContextMenus();
        }
      }

      // 2. Close Start Menu when clicking outside
      if (isStartMenuOpen) {
        if (
          startMenuRef.current && !startMenuRef.current.contains(target as Node) &&
          startButtonRef.current && !startButtonRef.current.contains(target as Node) &&
          !target?.closest?.('[data-context-menu]')
        ) {
          setIsStartMenuOpen(false);
          closeAllContextMenus();
        }
      }

      // 3. Close Calendar Flyout when clicking outside
      if (isCalendarFlyoutOpen) {
        if (
          calendarFlyoutRef.current && !calendarFlyoutRef.current.contains(target as Node) &&
          clockTrayButtonRef.current && !clockTrayButtonRef.current.contains(target as Node)
        ) {
          setIsCalendarFlyoutOpen(false);
        }
      }
    };

    // Use capture phase to ensure clicks anywhere (even inside stopPropagation containers) dismiss context menus
    document.addEventListener('pointerdown', handleGlobalPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPointerDown, true);
    };
  }, [isStartMenuOpen, isCalendarFlyoutOpen, hasAnyContextMenu]);

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K, F1, Alt+1..9, Esc, Ctrl+Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ctrl + K or Cmd + K: Spotlight Command Palette
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        sounds.playPop();
        closeAllContextMenus();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      // 2. F1: Help & Documentation Showcase Portal
      if (e.key === 'F1') {
        e.preventDefault();
        sounds.playClick();
        closeAllContextMenus();
        openWindow('docs');
        return;
      }

      // 3. Alt + 1..9: Launch or focus pinned taskbar apps
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1;
        if (index >= 0 && index < pinnedTaskbar.length) {
          e.preventDefault();
          closeAllContextMenus();
          const targetMod = pinnedTaskbar[index];
          openWindow(targetMod);
          return;
        }
      }

      // 4. Ctrl + Space: Toggle Start Menu
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        sounds.playClick();
        closeAllContextMenus();
        setIsStartMenuOpen(prev => !prev);
        return;
      }

      // 5. Ctrl + Alt + ArrowLeft / ArrowRight: Switch Virtual Desktop
      if (e.ctrlKey && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        sounds.playPop();
        const currentIdx = virtualDesktops.findIndex(d => d.id === activeDesktopId);
        if (currentIdx !== -1) {
          if (e.key === 'ArrowLeft') {
            const prevIdx = (currentIdx - 1 + virtualDesktops.length) % virtualDesktops.length;
            handleSelectDesktop(virtualDesktops[prevIdx].id);
          } else {
            const nextIdx = (currentIdx + 1) % virtualDesktops.length;
            handleSelectDesktop(virtualDesktops[nextIdx].id);
          }
        }
        return;
      }

      // 6. Ctrl + Shift + D: Add New Virtual Desktop
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        handleAddDesktop();
        return;
      }

      // 7. Ctrl + Tab or Alt + Tab (when focused in app): Task View / Desktop Overview
      if ((e.ctrlKey || e.altKey) && e.key === 'Tab') {
        e.preventDefault();
        sounds.playClick();
        closeAllContextMenus();
        setIsTaskViewOpen(prev => !prev);
        return;
      }

      // 8. Escape: Close open modals / context menus / flyouts / palette / task view
      if (e.key === 'Escape') {
        if (hasAnyContextMenu) {
          e.preventDefault();
          closeAllContextMenus();
          return;
        }
        if (isTaskViewOpen) {
          setIsTaskViewOpen(false);
        } else if (isWidgetsModalOpen) {
          setIsWidgetsModalOpen(false);
        } else if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
        } else if (isStartMenuOpen) {
          setIsStartMenuOpen(false);
        } else if (isPowerMenuOpen) {
          setIsPowerMenuOpen(false);
        } else if (isCalendarFlyoutOpen) {
          setIsCalendarFlyoutOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCommandPaletteOpen, isStartMenuOpen, isPowerMenuOpen, isCalendarFlyoutOpen, isTaskViewOpen, isWidgetsModalOpen, pinnedTaskbar, hasAnyContextMenu, virtualDesktops, activeDesktopId]);

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
    calendar: { title: t('module.calendar', currentLang, 'Kalender'), subtitle: t('desc.calendar', currentLang, 'Google Live Sync & Termine'), icon: Calendar, color: 'bg-blue-600' },
    widgets: { title: t('module.widgets', currentLang, 'Widgets'), subtitle: t('desc.widgets', currentLang, 'Desktop-Widgets & Notizen'), icon: WidgetsIcon, color: 'bg-violet-600' },
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
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasEvent: boolean;
      eventsCount: number;
      categories: string[];
    }> = [];

    const unifiedEvents = buildUnifiedCalendarEvents(invoices, company.currency);

    const checkEventsOnDate = (d: Date) => {
      const dStr = formatLocalDate(d);
      return unifiedEvents.filter(evt => isEventOnDate(evt, dStr));
    };

    // Prev month days
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dStr = formatLocalDate(d);
      const dayEvts = checkEventsOnDate(d);
      result.push({
        date: d,
        dateStr: dStr,
        dayNum: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: isSameDate(d, currentTime),
        isSelected: isSameDate(d, selectedCalendarDate),
        hasEvent: dayEvts.length > 0,
        eventsCount: dayEvts.length,
        categories: Array.from(new Set(dayEvts.map(e => e.category || (e.source === 'google' ? 'google' : 'general'))))
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dStr = formatLocalDate(d);
      const dayEvts = checkEventsOnDate(d);
      result.push({
        date: d,
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: true,
        isToday: isSameDate(d, currentTime),
        isSelected: isSameDate(d, selectedCalendarDate),
        hasEvent: dayEvts.length > 0,
        eventsCount: dayEvts.length,
        categories: Array.from(new Set(dayEvts.map(e => e.category || (e.source === 'google' ? 'google' : 'general'))))
      });
    }

    // Next month days to reach a fixed 6-row grid (exactly 42 cells) so the calendar window size never jumps
    const totalRequiredCells = 42;
    const remaining = totalRequiredCells - result.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dStr = formatLocalDate(d);
      const dayEvts = checkEventsOnDate(d);
      result.push({
        date: d,
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: isSameDate(d, currentTime),
        isSelected: isSameDate(d, selectedCalendarDate),
        hasEvent: dayEvts.length > 0,
        eventsCount: dayEvts.length,
        categories: Array.from(new Set(dayEvts.map(e => e.category || (e.source === 'google' ? 'google' : 'general'))))
      });
    }

    return result;
  }, [calendarViewDate, currentTime, selectedCalendarDate, invoices, company.currency]);

  const selectedDateUnifiedEvents = useMemo(() => {
    const dStr = formatLocalDate(selectedCalendarDate);
    const unified = buildUnifiedCalendarEvents(invoices, company.currency);
    return unified.filter(evt => isEventOnDate(evt, dStr));
  }, [invoices, selectedCalendarDate, company.currency]);

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

  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection>('home');

  const handleOpenSettings = (section: SettingsSection = 'general') => {
    setSettingsInitialSection(section);
    openWindow('settings', t('desktop.system_settings', currentLang, 'System-Einstellungen'));
  };

  const openWindow = (module: ActiveModule, customTitle?: string) => {
    closeAllContextMenus();
    sounds.playWindowOpen();
    setIsStartMenuOpen(false);
    setIsPowerMenuOpen(false);

    const existing = windows.find(w => w.module === module);
    const maxZ = Math.max(...windows.map(w => w.zIndex), 10) + 1;
    const meta = shortcutMeta[module] || { title: module, subtitle: '', icon: Boxes, color: 'bg-indigo-600' };
    const title = customTitle || meta.title;

    if (existing) {
      setWindows(prev => prev.map(w => w.id === existing.id ? { ...w, isMinimized: false, zIndex: maxZ, desktopId: activeDesktopId } : w));
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
        height: startH,
        desktopId: activeDesktopId
      };
      setWindows(prev => [...prev, newWin]);
      setActiveWindowId(newWin.id);
    }
  };

  const focusWindow = (id: string) => {
    const maxZ = Math.max(...windows.map(w => w.zIndex), 10) + 1;
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        return {
          ...w,
          zIndex: maxZ,
          isMinimized: false,
          desktopId: (w.desktopId && w.desktopId !== 'all' && w.desktopId !== activeDesktopId) ? activeDesktopId : w.desktopId
        };
      }
      return w;
    }));
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
    // Prevent drag when clicking or pressing down on buttons or interactive elements
    if ((e.target as HTMLElement)?.closest('button, a, input, select, textarea, [data-no-drag]')) {
      return;
    }
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
    if (!quitDesktopApp()) {
      setIsLockedStandby(true);
    }
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
        closeAllContextMenus();
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
        onDragOver={handleDesktopCanvasDragOver}
        onDragLeave={(e) => {
          if (e.relatedTarget === null || !desktopCanvasRef.current?.contains(e.relatedTarget as Node)) {
            setDragPreviewPos(null);
          }
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
        {/* Semi-transparent App Placement Ghost Preview */}
        {draggedDesktopItem && dragPreviewPos && (
          <div
            style={{
              position: 'absolute',
              left: `${dragPreviewPos.x}px`,
              top: `${dragPreviewPos.y}px`,
              zIndex: 35
            }}
            className="w-24 p-2 rounded-2xl pointer-events-none transition-all duration-75 flex flex-col items-center justify-center text-center animate-pulse"
          >
            <div className="relative w-12 h-12 rounded-2xl border-2 border-dashed border-indigo-500/80 dark:border-indigo-400 bg-indigo-500/20 dark:bg-indigo-400/25 backdrop-blur-xs flex items-center justify-center shadow-lg ring-4 ring-indigo-500/20">
              {draggedDesktopItem.type === 'folder' ? (
                <div className="w-8 h-8 rounded-xl bg-white/40 dark:bg-slate-700/50 flex items-center justify-center">
                  <span className="text-[12px] opacity-80">📁</span>
                </div>
              ) : shortcutMeta[draggedDesktopItem.id as ActiveModule] ? (
                (() => {
                  const m = shortcutMeta[draggedDesktopItem.id as ActiveModule];
                  const GhostIcon = m.icon;
                  return (
                    <div className={`w-9 h-9 rounded-xl ${m.color} text-white flex items-center justify-center opacity-65 shadow-inner`}>
                      <GhostIcon className="w-4.5 h-4.5" />
                    </div>
                  );
                })()
              ) : (
                <div className="w-9 h-9 rounded-xl bg-indigo-600/50 text-white flex items-center justify-center opacity-70">
                  <Zap className="w-4.5 h-4.5" />
                </div>
              )}
            </div>
            <span className="mt-1.5 px-2 py-0.5 rounded-lg bg-indigo-900/90 text-white text-[10px] font-bold truncate max-w-[85px] shadow-sm border border-indigo-400/30">
              {draggedDesktopItem.type === 'folder' 
                ? (desktopFolders.find(f => f.id === draggedDesktopItem.id)?.name || 'Ordner')
                : (shortcutMeta[draggedDesktopItem.id as ActiveModule]?.title || draggedDesktopItem.id)}
            </span>
          </div>
        )}

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

        {/* Desktop Widgets Layer (Sticky Notes, KPI Cards, Clock, Agenda) */}
        <DesktopWidgetsLayer
          widgets={desktopWidgets}
          onUpdateWidget={handleUpdateWidget}
          onRemoveWidget={handleRemoveWidget}
          onAddStickyNote={handleAddStickyNote}
          invoices={invoices}
          products={products}
          currency={company.currency || '€'}
          onOpenModule={(mod) => openWindow(mod)}
          activeDesktopId={activeDesktopId}
        />

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
          const isBeingDragged = draggedDesktopItem?.id === modId;
          const isDragOver = dragOverIconId === modId;

          return (
            <div
              key={modId}
              draggable
              onDragStart={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                const offsetY = e.clientY - rect.top;
                setDraggedDesktopItem({ id: modId, type: 'app', offsetX, offsetY });
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
                if (draggedDesktopItem && draggedDesktopItem.id !== modId && draggedDesktopItem.type === 'app') {
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
                const droppedModId = (e.dataTransfer.getData('text/plain') as ActiveModule) || (draggedDesktopItem?.id as ActiveModule);
                if (droppedModId && droppedModId !== modId && draggedDesktopItem?.type === 'app') {
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
              className={`rounded-2xl select-none transition-all duration-150 ${
                isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-indigo-400 ring-dashed filter grayscale' : 'hover:scale-102'
              } ${
                isDragOver ? 'scale-110 ring-4 ring-indigo-500 ring-offset-2 ring-offset-transparent bg-indigo-500/20 shadow-xl' : ''
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleIconMouseLeave();
                  closeAllContextMenus();
                  setDesktopIconContextMenu({
                    x: Math.min(e.clientX, window.innerWidth - 260),
                    y: Math.min(e.clientY, window.innerHeight - 240),
                    modId
                  });
                }}
                className={`group relative flex flex-col items-center justify-center w-24 p-2 rounded-xl text-center border cursor-pointer transition-all duration-150 ${
                  isDark 
                    ? 'bg-transparent border-transparent hover:bg-white/10 hover:border-white/20 active:bg-white/20 active:border-white/35' 
                    : 'bg-transparent border-transparent hover:bg-sky-500/10 hover:border-sky-500/30 active:bg-sky-500/20 active:border-sky-500/40'
                }`}
              >
                <div className="relative">
                  {modId === 'calendar' ? (
                    <div className="group-hover:scale-105 transition-transform duration-200">
                      <DynamicCalendarIcon size="lg" />
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-2xl ${meta.color} text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  )}
                  
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

        {/* Render Desktop Folders (Modern Frosted Glass iOS/Windows 11 Style Container) */}
        {desktopFolders.map((folder, fIndex) => {
          const pos = getDesktopPosition(folder.id, pinnedDesktop.length + fIndex);
          const isBeingDragged = draggedDesktopItem?.id === folder.id;
          const isDragOver = dragOverIconId === folder.id;

          return (
            <div
              key={folder.id}
              draggable
              onDragStart={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                const offsetY = e.clientY - rect.top;
                setDraggedDesktopItem({ id: folder.id, type: 'folder', offsetX, offsetY });
                e.dataTransfer.setData('text/plain', folder.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDraggedDesktopItem(null);
                setDragOverIconId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedDesktopItem && draggedDesktopItem.id !== folder.id && draggedDesktopItem.type === 'app') {
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
                const droppedModId = (e.dataTransfer.getData('text/plain') as ActiveModule) || (draggedDesktopItem?.id as ActiveModule);
                if (droppedModId && draggedDesktopItem?.type === 'app') {
                  handleAddAppToExistingFolder(folder.id, droppedModId);
                }
                setDragOverIconId(null);
              }}
              style={{
                position: 'absolute',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                zIndex: isBeingDragged ? 40 : 3
              }}
              className={`rounded-2xl select-none transition-all duration-150 ${
                isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-indigo-400 ring-dashed filter grayscale' : 'hover:scale-102'
              } ${
                isDragOver ? 'scale-110 ring-4 ring-indigo-500 ring-offset-2 ring-offset-transparent bg-indigo-500/20 shadow-xl' : ''
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
                className={`group relative flex flex-col items-center justify-center w-24 p-2 rounded-xl text-center border cursor-pointer transition-all duration-150 ${
                  isDark 
                    ? 'bg-transparent border-transparent hover:bg-white/10 hover:border-white/20 active:bg-white/20 active:border-white/35' 
                    : 'bg-transparent border-transparent hover:bg-sky-500/10 hover:border-sky-500/30 active:bg-sky-500/20 active:border-sky-500/40'
                }`}
              >
                {/* Mini Apps Preview Squircle (iOS/macOS Liquid Glass Style) */}
                <div className="relative w-12 h-12 rounded-2xl bg-white/80 dark:bg-slate-800/90 p-1.5 flex items-center justify-center border border-white/60 dark:border-white/20 shadow-md ring-1 ring-black/5 group-hover:scale-105 transition-transform duration-200">
                  {folder.modules.length === 1 ? (
                    // Single App: Centered large icon
                    (() => {
                      const mod = folder.modules[0];
                      const mMeta = shortcutMeta[mod];
                      if (!mMeta) return null;
                      const MIcon = mMeta.icon;
                      return (
                        <div className={`w-8 h-8 rounded-xl ${mMeta.color} text-white flex items-center justify-center shadow-xs`}>
                          <MIcon className="w-4 h-4" />
                        </div>
                      );
                    })()
                  ) : folder.modules.length === 2 ? (
                    // 2 Apps: Perfectly proportioned side-by-side squares (no empty blobs, no stretching)
                    <div className="flex items-center justify-center gap-1.5 w-full h-full">
                      {folder.modules.map((mod) => {
                        const mMeta = shortcutMeta[mod];
                        if (!mMeta) return null;
                        const MIcon = mMeta.icon;
                        return (
                          <div 
                            key={mod} 
                            className={`w-4.5 h-4.5 aspect-square rounded-lg ${mMeta.color} text-white flex items-center justify-center shadow-2xs shrink-0`}
                          >
                            <MIcon className="w-2.5 h-2.5" />
                          </div>
                        );
                      })}
                    </div>
                  ) : folder.modules.length <= 4 ? (
                    // 3 or 4 Apps: Balanced 2x2 grid of square icons
                    <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full place-items-center">
                      {folder.modules.map((mod) => {
                        const mMeta = shortcutMeta[mod];
                        if (!mMeta) return null;
                        const MIcon = mMeta.icon;
                        return (
                          <div 
                            key={mod} 
                            className={`w-4 h-4 aspect-square rounded-md ${mMeta.color} text-white flex items-center justify-center shadow-2xs`}
                          >
                            <MIcon className="w-2.5 h-2.5" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // 5+ Apps: 3 mini icons + '+N' counter badge
                    <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full place-items-center">
                      {folder.modules.slice(0, 3).map((mod) => {
                        const mMeta = shortcutMeta[mod];
                        if (!mMeta) return null;
                        const MIcon = mMeta.icon;
                        return (
                          <div 
                            key={mod} 
                            className={`w-4 h-4 aspect-square rounded-md ${mMeta.color} text-white flex items-center justify-center shadow-2xs`}
                          >
                            <MIcon className="w-2.5 h-2.5" />
                          </div>
                        );
                      })}
                      <div className="w-4 h-4 aspect-square rounded-md bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black shadow-2xs">
                        +{folder.modules.length - 3}
                      </div>
                    </div>
                  )}
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
      </div>

      {/* 4. Floating Windows Layer */}
      {windows.map((win) => {
        if (win.isMinimized) return null;
        if (win.desktopId && win.desktopId !== 'all' && win.desktopId !== activeDesktopId) return null;

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
              <div 
                className="flex items-center gap-1 -mr-1 cursor-default"
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                {/* Snap Layout Quick Actions (Links / Rechts teilen) */}
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); snapWindowTo(win.id, 'left'); }}
                  title="Fenster links andocken (50% Split-View)"
                  className="w-7 h-7 hidden sm:flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); snapWindowTo(win.id, 'right'); }}
                  title="Fenster rechts andocken (50% Split-View)"
                  className="w-7 h-7 hidden sm:flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <PanelRight className="w-3.5 h-3.5" />
                </button>

                <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:block" />

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => minimizeWindow(win.id, e)}
                  title="Minimieren"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => toggleMaximizeWindow(win.id, e)}
                  title={win.isMaximized ? 'Wiederherstellen' : 'Maximieren'}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  {win.isMaximized ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => closeWindow(win.id, e)}
                  title="Schließen"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-rose-600 active:bg-rose-700 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Window Content Body with sleek inner scroll */}
            <div className={`flex-1 min-h-0 ${
              ['support_services', 'pos', 'restaurant', 'ios_billing', 'docs', 'appstore'].includes(win.module)
                ? 'overflow-hidden flex flex-col p-0'
                : 'overflow-y-auto p-4 sm:p-6'
            } bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100`}>
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
                  onOpenSettings={() => handleOpenSettings('general')}
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
                  company={company}
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
                  onNavigateToInvoice={(invId) => openWindow('invoices', invId ? `Rechnung #${invId}` : undefined)}
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

              {win.module === 'calendar' && (
                <CalendarModule
                  invoices={invoices}
                  company={company}
                  onOpenInvoice={(invId) => openWindow('invoices', `Rechnung #${invId}`)}
                  onUpdateCompany={(patch) => onUpdateCompany({ ...company, ...patch })}
                />
              )}

              {win.module === 'docs' && (
                <DocumentationApp />
              )}

              {win.module === 'widgets' && (
                <WidgetsModule
                  widgets={desktopWidgets}
                  onAddWidget={handleAddWidget}
                  onUpdateWidget={handleUpdateWidget}
                  onRemoveWidget={handleRemoveWidget}
                  onAddStickyNote={handleAddStickyNote}
                  invoices={invoices}
                  products={products}
                  company={company}
                  onOpenModule={(mod) => openWindow(mod)}
                  virtualDesktops={virtualDesktops}
                  activeDesktopId={activeDesktopId}
                />
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
                  initialSection={settingsInitialSection}
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
          <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-200 dark:border-slate-800">
            <SocdofLogo size="md" className="shadow-md flex-shrink-0" />
            <div className="min-w-0">
              <h4 className="font-bold text-sm truncate">{company.name || 'SOCDOF'}</h4>
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
                    draggable
                    onDragStart={(e) => {
                      setDraggedDesktopItem({ id: modId, type: 'app', offsetX: 48, offsetY: 44 });
                      e.dataTransfer.setData('text/plain', modId);
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    onDragEnd={() => {
                      setDraggedDesktopItem(null);
                    }}
                    onClick={() => {
                      openWindow(modId, meta.title);
                      setIsStartMenuOpen(false);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleIconMouseLeave();
                      closeAllContextMenus();
                      setStartMenuIconContextMenu({
                        x: Math.min(e.clientX, window.innerWidth - 260),
                        y: Math.min(e.clientY, window.innerHeight - 220),
                        modId
                      });
                    }}
                    className="flex flex-col items-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition text-center group cursor-pointer"
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
              onClick={() => { 
                sounds.playClick(); 
                setIsStartMenuOpen(false); 
                setIsLanguageModalOpen(true); 
              }}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition border border-emerald-200 dark:border-emerald-800/40"
              title="Sprache ändern / Change Language"
            >
              <FlagIcon code={currentLang} size="sm" />
              <span className="uppercase font-bold tracking-wider">{currentLang}</span>
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
              onClick={() => setIsStartMenuOpen(false)}
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://discord.gg/QW85EaXTgB"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsStartMenuOpen(false)}
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-[#5865F2]/10 text-[#5865F2] dark:text-indigo-300 text-[11px] font-semibold hover:bg-[#5865F2]/20 transition border border-[#5865F2]/30"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Discord</span>
            </a>
          </div>

          {/* Bottom Footer Actions: Power Button & User Profile */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => {
                handleOpenSettings('general');
                setIsStartMenuOpen(false);
                closeAllContextMenus();
              }}
              title={t('company.user_profile', currentLang, 'Firmen- & Benutzerprofil')}
              className="flex items-center gap-2.5 min-w-0 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer group"
            >
              <div 
                className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform"
                style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
              >
                {company.name ? company.name.charAt(0).toUpperCase() : <User className="w-4 h-4 text-white" />}
              </div>
              <div className="min-w-0 flex flex-col">
                <span className="text-xs font-bold truncate max-w-[130px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {company.name || t('company.default_name', currentLang, 'Ihr Firmenname')}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {company.owner || t('company.local_profile', currentLang, 'Lokales Profil')}
                </span>
              </div>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={onToggleTheme}
                title="Design wechseln"
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
              </button>

              <button
                onClick={() => {
                  if (!isDesktopApp) {
                    setIsStartMenuOpen(false);
                    setIsWebPreviewExitMode(true);
                    setIsWebPreviewModalOpen(true);
                  } else if (company.disable_exit_prompt) {
                    handleShutdown();
                  } else {
                    setIsPowerMenuOpen(!isPowerMenuOpen);
                  }
                }}
                title={!isDesktopApp ? "Web-Vorschau verlassen & Vollversion herunterladen" : "Beenden & Energieoptionen"}
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
                  <h3 className="font-bold text-base">
                    {!isDesktopApp ? 'Web-Vorschau beenden?' : 'SOCDOF beenden?'}
                  </h3>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {!isDesktopApp ? 'Interaktive Online-Demo' : 'Desktop-Umgebung schließen'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsPowerMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isDesktopApp ? (
              <div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Hinweis zur Web-Vorschau:</span>
                </div>
                <p>
                  Dies ist nur die Web-Vorschau. Eingegebene Daten werden nicht dauerhaft gespeichert. Laden Sie sich die vollständige Windows Desktop-App (.exe) für 100% lokalen Betrieb herunter.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                Möchten Sie die SOCDOF Arbeitsumgebung jetzt beenden? Alle Rechnungen, Buchungen, Lagerbewegungen und Einstellungen bleiben lokal sicher in Ihrer Datenbank gespeichert.
              </p>
            )}

            <div className="space-y-2.5">
              {!isDesktopApp && (
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-left transition group shadow-md shadow-indigo-600/20"
                >
                  <Download className="w-5 h-5 flex-shrink-0 group-hover:-translate-y-0.5 transition-transform" />
                  <div className="flex-1">
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Vollversion herunterladen (.exe)</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </div>
                    <div className="text-[11px] text-indigo-100">Neueste Release auf GitHub öffnen</div>
                  </div>
                </a>
              )}

              <button
                onClick={!isDesktopApp ? handleConfirmLeaveWeb : handleShutdown}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 text-left transition group"
              >
                <Power className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-xs font-bold">
                    {!isDesktopApp ? 'Website wirklich verlassen' : 'SOCDOF jetzt beenden'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {!isDesktopApp ? 'Beendet die Demo und leitet zur Download-Seite weiter.' : 'Schließt alle offenen Arbeitsfenster und sperrt die Sitzung.'}
                  </div>
                </div>
              </button>

              <button
                onClick={handleRestart}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-left transition group"
              >
                <RotateCcw className="w-5 h-5 flex-shrink-0 group-hover:rotate-45 transition-transform" />
                <div>
                  <div className="text-xs font-bold">Arbeitsbereich neu laden</div>
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
            title="Start"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition cursor-pointer ${
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

          {/* Windows Search Bar / Spotlight Trigger - Authentic Windows 11 Fluent Search Box */}
          <button
            onClick={() => {
              sounds.playClick();
              setIsCommandPaletteOpen(true);
            }}
            title={t('nav.search_placeholder', currentLang, 'Apps, Kontakte, Rechnungen suchen... (Ctrl+K)')}
            className="hidden sm:flex items-center gap-2.5 h-9 px-3.5 rounded-xl bg-slate-200/70 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all text-xs border border-slate-300/60 dark:border-white/10 hover:border-indigo-400/50 dark:hover:border-indigo-400/50 shadow-2xs group cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="font-medium tracking-tight">{t('nav.search', currentLang, 'Suchen...')}</span>
          </button>

          {/* Authentic Windows 11 Task View Icon Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setIsTaskViewOpen(!isTaskViewOpen);
            }}
            title={t('taskview.title', currentLang, 'Task-Ansicht & Virtuelle Desktops (Ctrl+Tab)')}
            aria-label="Task View"
            className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer group ${
              isTaskViewOpen
                ? 'bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/40 shadow-xs'
                : 'hover:bg-slate-200/80 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
            }`}
          >
            {/* Windows 11 Overlapping Rectangles Icon */}
            <div className="relative w-4 h-4 flex items-center justify-center">
              {/* Back translucent rectangle */}
              <div className="absolute top-0 left-0 w-3 h-3 rounded-[3px] border-[1.5px] border-slate-500/70 dark:border-white/50 bg-slate-400/20 dark:bg-white/10 group-hover:border-slate-800 dark:group-hover:border-white transition-colors" />
              {/* Front solid rectangle */}
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-[3px] border-[1.5px] border-slate-800 dark:border-white bg-slate-200/90 dark:bg-slate-800 shadow-xs group-hover:scale-105 transition-all" />
            </div>
          </button>

          {/* Unified Windows 11 Taskbar App Items */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const rawData = e.dataTransfer.getData('text/plain');
              const droppedModId = (rawData || draggedDesktopItem?.id) as ActiveModule;
              if (droppedModId && shortcutMeta[droppedModId] && !pinnedTaskbar.includes(droppedModId)) {
                savePinnedTaskbar([...pinnedTaskbar, droppedModId]);
                sounds.playInstall();
              }
            }}
            className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-[60vw]"
          >
            {(() => {
              const taskbarModules = [...pinnedTaskbar];
              windows.forEach(w => {
                const belongsToCurrent = !w.desktopId || w.desktopId === 'all' || w.desktopId === activeDesktopId;
                if (belongsToCurrent && !taskbarModules.includes(w.module)) {
                  taskbarModules.push(w.module);
                }
              });

              return taskbarModules.map((modId, index) => {
                const meta = shortcutMeta[modId];
                if (!meta) return null;
                const Icon = meta.icon;
                const openWinCurrent = windows.find(w => w.module === modId && (!w.desktopId || w.desktopId === 'all' || w.desktopId === activeDesktopId));
                const openWinAny = windows.find(w => w.module === modId);
                const isOpen = Boolean(openWinCurrent);
                const isActive = Boolean(openWinCurrent && activeWindowId === openWinCurrent.id && !openWinCurrent.isMinimized);
                const isMinimized = Boolean(openWinCurrent && openWinCurrent.isMinimized);
                const isPinned = pinnedTaskbar.includes(modId);
                const badge = getBadgeForModule(modId);

                const handleTaskbarClick = (e: React.MouseEvent) => {
                  sounds.playClick();
                  if (openWinCurrent) {
                    if (isMinimized) {
                      focusWindow(openWinCurrent.id);
                    } else if (isActive) {
                      minimizeWindow(openWinCurrent.id, e);
                    } else {
                      focusWindow(openWinCurrent.id);
                    }
                  } else if (openWinAny) {
                    focusWindow(openWinAny.id);
                  } else {
                    openWindow(modId, meta.title);
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
                    onDragEnd={() => {
                      setDraggedTaskbarIdx(null);
                      setDragOverTaskbarIdx(null);
                    }}
                    onDragOver={(e) => {
                      if (isPinned) {
                        e.preventDefault();
                        setDragOverTaskbarIdx(index);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverTaskbarIdx === index) {
                        setDragOverTaskbarIdx(null);
                      }
                    }}
                    onDrop={(e) => {
                      if (isPinned) {
                        e.preventDefault();
                        handleTaskbarReorder(index);
                        setDragOverTaskbarIdx(null);
                      }
                    }}
                    className={`relative ${isPinned ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    {/* Visual Insertion Line / Strick for Taskbar Drag & Drop */}
                    {dragOverTaskbarIdx === index && draggedTaskbarIdx !== null && draggedTaskbarIdx !== index && (
                      <div className="absolute -left-1 top-1 bottom-1 w-1 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/50 z-30 animate-pulse pointer-events-none" />
                    )}

                    <button
                      onClick={handleTaskbarClick}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleIconMouseLeave();
                        closeAllContextMenus();
                        setTaskbarIconContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          modId
                        });
                      }}
                      title={`${meta.title}${isOpen ? (isActive ? ' (Aktiv)' : isMinimized ? ' (Minimiert)' : ' (Geöffnet)') : ''}`}
                      className={`group h-9 min-w-[38px] px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition relative active:scale-95 cursor-pointer ${
                        draggedTaskbarIdx === index ? 'opacity-30 scale-90 filter grayscale' : ''
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
                      {modId === 'calendar' ? (
                        <DynamicCalendarIcon size="sm" />
                      ) : (
                        <Icon 
                          className="w-4 h-4 flex-shrink-0" 
                          style={isActive ? { color: 'var(--accent, #4f46e5)' } : undefined}
                        />
                      )}
                      
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
          {/* Web Preview Indicator (strictly only on browser preview, not Electron) */}
          {!isDesktopApp && (
            <button
              onClick={() => { sounds.playPop(); setIsWebPreviewModalOpen(true); }}
              title="Web-Vorschau aktiv – Klick für Download der vollen Windows Desktop App (.exe)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15 hover:from-indigo-500/25 hover:to-pink-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-[11px] font-bold transition shadow-xs group"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
              </span>
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline font-extrabold tracking-tight">Web-Vorschau</span>
            </button>
          )}

          {/* Language Selector in Taskbar Tray */}
          <button
            onClick={() => { sounds.playClick(); setIsLanguageModalOpen(true); }}
            title="Sprache ändern / Change Language"
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 text-[11px] font-extrabold transition border border-slate-300/80 dark:border-slate-700"
          >
            <FlagIcon code={currentLang} size="sm" />
            <span className="uppercase tracking-wider">{currentLang}</span>
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
              {formatSystemTime(currentTime, company.time_show_seconds !== false, company.timezone)}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {formatSystemDate(currentTime, company.date_format || 'DD.MM.YYYY', company.timezone)}
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
                {formatSystemTime(currentTime, true, company.timezone)}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 capitalize">
                {currentTime.toLocaleDateString(currentLang === 'de' ? 'de-DE' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-US', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: company.timezone || undefined
                })}
              </div>
            </div>
            <button
              onClick={() => {
                const now = new Date();
                setCalendarViewDate(now);
                setSelectedCalendarDate(now);
                sounds.playClick();
              }}
              title={t('calendar.reset_today_title', currentLang, 'Auf Heute zurücksetzen')}
              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 transition"
            >
              {t('calendar.today_btn', currentLang, 'Heute')}
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="font-extrabold text-sm capitalize text-slate-800 dark:text-slate-200">
              {calendarViewDate.toLocaleDateString(currentLang === 'de' ? 'de-DE' : currentLang === 'fr' ? 'fr-FR' : currentLang === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  sounds.playClick();
                  setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
                title={t('calendar.prev_month', currentLang, 'Vorheriger Monat')}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
                title={t('calendar.next_month', currentLang, 'Nächster Monat')}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
            {(currentLang === 'de'
              ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
              : currentLang === 'fr'
              ? ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']
              : currentLang === 'es'
              ? ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
              : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
            ).map((wd, i) => (
              <span key={i}>{wd}</span>
            ))}
          </div>

          {/* Days Grid (Strictly 6 rows of 7 days = 42 cells, constant height) */}
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
                    <div className="absolute bottom-0.5 flex items-center justify-center gap-0.5">
                      {item.categories.includes('invoice') && <span className="w-1 h-1 rounded-full bg-indigo-500" />}
                      {item.categories.includes('google') && <span className="w-1 h-1 rounded-full bg-blue-500" />}
                      {item.categories.includes('deadline') && <span className="w-1 h-1 rounded-full bg-rose-500" />}
                      {item.categories.includes('customer') && <span className="w-1 h-1 rounded-full bg-emerald-500" />}
                      {!item.categories.some(c => ['invoice', 'google', 'deadline', 'customer'].includes(c)) && (
                        <span className="w-1 h-1 rounded-full bg-slate-400" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Agenda / Upcoming Due Invoices, Deadlines & Google Calendar Events (Constant fixed-height scroll container) */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>{t('calendar.upcoming_events', currentLang, 'Termine & Fälligkeiten')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    sounds.playClick();
                    setIsCalendarFlyoutOpen(false);
                    openWindow('calendar', t('module.calendar', currentLang, 'Kalender'));
                  }}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {t('module.calendar', currentLang, 'Kalender öffnen')}
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  onClick={() => {
                    sounds.playClick();
                    setIsCalendarFlyoutOpen(false);
                    openWindow('invoices', t('module.invoices', currentLang, 'Rechnungen'));
                  }}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {t('calendar.all_invoices', currentLang, 'Rechnungen')}
                </button>
              </div>
            </div>

            <div className="h-28 overflow-y-auto pr-0.5 space-y-1.5">
              {selectedDateUnifiedEvents.length > 0 ? (
                selectedDateUnifiedEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => {
                      setIsCalendarFlyoutOpen(false);
                      if (evt.invoiceId) {
                        openWindow('invoices', t('module.invoices', currentLang, 'Rechnungen'));
                      } else {
                        openWindow('calendar', t('module.calendar', currentLang, 'Kalender'));
                      }
                    }}
                    className={`p-2 rounded-xl cursor-pointer transition border flex items-center justify-between text-xs ${
                      evt.category === 'invoice'
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40 border-indigo-200/80 dark:border-indigo-800/60'
                        : evt.category === 'google'
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100/60 dark:hover:bg-blue-900/50 border-blue-200/80 dark:border-blue-800/60'
                        : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/50 border-slate-200/80 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="truncate mr-2 min-w-0">
                      <div className="font-bold truncate text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          evt.category === 'google' ? 'bg-blue-500' : evt.category === 'invoice' ? 'bg-indigo-500' : 'bg-emerald-500'
                        }`} />
                        <span className="truncate">{evt.title}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate pl-3 font-mono">
                        {evt.startTime ? `${evt.startTime} ${evt.endTime ? `- ${evt.endTime}` : ''}` : evt.description || evt.startDate}
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                      evt.category === 'google'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : evt.category === 'invoice'
                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-mono'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {evt.category === 'google' ? 'Google' : evt.category === 'invoice' ? 'Rechnung' : 'Termin'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center space-y-1">
                  <p className="text-[11px] text-slate-400">Keine Termine an diesem Tag.</p>
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setIsCalendarFlyoutOpen(false);
                      openWindow('calendar', t('module.calendar', currentLang, 'Kalender'));
                    }}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Termin im Kalender anlegen</span>
                  </button>
                </div>
              )}
            </div>
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
        currentLanguage={currentLang}
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

      {/* Web Preview Info & Download Modal (Only when in Web Preview) */}
      <WebPreviewModal
        isOpen={isWebPreviewModalOpen}
        isExitPrompt={isWebPreviewExitMode}
        onClose={() => {
          setIsWebPreviewModalOpen(false);
          setIsWebPreviewExitMode(false);
        }}
        onConfirmLeave={handleConfirmLeaveWeb}
      />

      {/* GitHub Release Update Notification Prompt & Download Progress */}
      <UpdatePromptModal
        isOpen={isUpdatePromptOpen}
        updateInfo={updateInfo}
        onClose={() => setIsUpdatePromptOpen(false)}
        onShutdownApp={handleShutdown}
      />

      {/* Windows 11 Task View & Virtual Desktops Management Modal */}
      <TaskViewModal
        isOpen={isTaskViewOpen}
        onClose={() => setIsTaskViewOpen(false)}
        virtualDesktops={virtualDesktops}
        activeDesktopId={activeDesktopId}
        onSelectDesktop={handleSelectDesktop}
        onAddDesktop={handleAddDesktop}
        onRemoveDesktop={handleRemoveDesktop}
        onRenameDesktop={handleRenameDesktop}
        windows={windows}
        onSelectWindow={(win) => {
          if (win.desktopId && win.desktopId !== 'all' && win.desktopId !== activeDesktopId) {
            handleSelectDesktop(win.desktopId);
          }
          focusWindow(win.id);
          setIsTaskViewOpen(false);
        }}
        onCloseWindow={(id) => {
          setWindows(prev => prev.filter(w => w.id !== id));
        }}
        onMoveWindowToDesktop={handleMoveWindowToDesktop}
      />

      {/* Desktop Widgets Customization & Catalog Modal */}
      <DesktopWidgetsModal
        isOpen={isWidgetsModalOpen}
        onClose={() => setIsWidgetsModalOpen(false)}
        widgets={desktopWidgets}
        onAddWidget={handleAddWidget}
        onRemoveWidget={handleRemoveWidget}
        onToggleVisibility={handleToggleWidgetVisibility}
        onOpenWidgetsApp={() => {
          setIsWidgetsModalOpen(false);
          openWindow('widgets', t('module.widgets', currentLang, 'Widgets & Notizen'));
        }}
      />

      {/* Global Windows-Style Context Menus Layer (Placed at root with highest z-index) */}
      {/* 1. Desktop Background Context Menu */}
      {desktopContextMenu && (
        <div
          data-context-menu="true"
          style={{ left: `${desktopContextMenu.x}px`, top: `${desktopContextMenu.y}px` }}
          className="fixed z-[99999] w-64 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-scale-up text-xs font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              openWindow('widgets', t('module.widgets', currentLang, 'Widgets'));
              closeAllContextMenus();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer font-semibold"
          >
            <WidgetsIcon className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <span>{t('module.widgets', currentLang, 'Widgets')}</span>
          </button>
          <button
            onClick={() => {
              handleAddStickyNote();
              closeAllContextMenus();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>{t('widgets.add_note', currentLang, '+ Neue Haftnotiz anheften')}</span>
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setIsTaskViewOpen(true);
              closeAllContextMenus();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            <Layers className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span>{t('taskview.title', currentLang, 'Virtuelle Desktops & Task-Ansicht')}</span>
          </button>
          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
          <button
            onClick={handleAutoArrangeDesktop}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            <Boxes className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
            <span>{t('desktop.auto_arrange', currentLang, 'Symbole links anordnen')}</span>
          </button>
          <button
            onClick={handleSnapDesktopToGrid}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            <Sliders className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
            <span>{t('desktop.snap_grid', currentLang, 'Am Raster ausrichten')}</span>
          </button>
          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
          <button
            onClick={() => {
              openWindow('appstore', 'App Store');
              closeAllContextMenus();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            <Package className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <span>{t('desktop.open_appstore', currentLang, 'App Store öffnen')}</span>
          </button>
          <button
            onClick={() => {
              openWindow('settings', 'Einstellungen');
              closeAllContextMenus();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span>{t('desktop.system_settings', currentLang, 'System-Einstellungen')}</span>
          </button>
        </div>
      )}

      {/* 2. Desktop App Icon Context Menu */}
      {desktopIconContextMenu && (() => {
        const meta = shortcutMeta[desktopIconContextMenu.modId];
        if (!meta) return null;
        const Icon = meta.icon;
        const isPinnedToTaskbar = pinnedTaskbar.includes(desktopIconContextMenu.modId);

        return (
          <div
            data-context-menu="true"
            style={{ left: `${desktopIconContextMenu.x}px`, top: `${desktopIconContextMenu.y}px` }}
            className="fixed z-[99999] w-60 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-scale-up text-xs font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
              <div className={`w-6 h-6 rounded-lg ${meta.color} text-white flex items-center justify-center flex-shrink-0 shadow-xs`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs truncate text-slate-800 dark:text-slate-200">{meta.title}</span>
            </div>

            <button
              onClick={() => {
                openWindow(desktopIconContextMenu.modId, meta.title);
                closeAllContextMenus();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition font-semibold cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
              <span>{t('desktop.open_app', currentLang, 'App öffnen')}</span>
            </button>

            <button
              onClick={() => {
                handleTogglePinTaskbar(desktopIconContextMenu.modId);
                closeAllContextMenus();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
            >
              {isPinnedToTaskbar ? (
                <>
                  <PinOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>{t('desktop.unpin_taskbar', currentLang, 'Von Taskleiste lösen')}</span>
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
                  <span>{t('desktop.pin_taskbar', currentLang, 'An Taskleiste anheften')}</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                savePinnedDesktop(pinnedDesktop.filter(m => m !== desktopIconContextMenu.modId));
                sounds.playDelete();
                closeAllContextMenus();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{t('desktop.remove_from_desktop', currentLang, 'Vom Desktop entfernen')}</span>
            </button>

            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

            <button
              onClick={() => {
                openWindow('settings', 'System-Einstellungen');
                closeAllContextMenus();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span>{t('desktop.system_settings', currentLang, 'System-Einstellungen')}</span>
            </button>
          </div>
        );
      })()}

      {/* 3. Start Menu App Icon Context Menu */}
      {startMenuIconContextMenu && (() => {
        const meta = shortcutMeta[startMenuIconContextMenu.modId];
        if (!meta) return null;
        const Icon = meta.icon;
        const isPinnedToDesktop = pinnedDesktop.includes(startMenuIconContextMenu.modId);
        const isPinnedToTaskbar = pinnedTaskbar.includes(startMenuIconContextMenu.modId);

        return (
          <div
            data-context-menu="true"
            style={{ left: `${startMenuIconContextMenu.x}px`, top: `${startMenuIconContextMenu.y}px` }}
            className="fixed z-[99999] w-60 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-scale-up text-xs font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
              <div className={`w-6 h-6 rounded-lg ${meta.color} text-white flex items-center justify-center flex-shrink-0 shadow-xs`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs truncate text-slate-800 dark:text-slate-200">{meta.title}</span>
            </div>

            <button
              onClick={() => {
                openWindow(startMenuIconContextMenu.modId, meta.title);
                setIsStartMenuOpen(false);
                closeAllContextMenus();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition font-semibold cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
              <span>{t('desktop.open_app', currentLang, 'App öffnen')}</span>
            </button>

            <button
              onClick={() => {
                if (isPinnedToDesktop) {
                  savePinnedDesktop(pinnedDesktop.filter(m => m !== startMenuIconContextMenu.modId));
                  sounds.playDelete();
                } else {
                  savePinnedDesktop([...pinnedDesktop, startMenuIconContextMenu.modId]);
                  sounds.playInstall();
                }
                closeAllContextMenus();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
            >
              {isPinnedToDesktop ? (
                <>
                  <Trash2 className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{t('desktop.remove_from_desktop', currentLang, 'Vom Desktop entfernen')}</span>
                </>
              ) : (
                <>
                  <Monitor className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
                  <span>{t('desktop.add_to_desktop', currentLang, 'Zum Desktop hinzufügen')}</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                handleTogglePinTaskbar(startMenuIconContextMenu.modId);
                closeAllContextMenus();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
            >
              {isPinnedToTaskbar ? (
                <>
                  <PinOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>{t('desktop.unpin_taskbar', currentLang, 'Von Taskleiste lösen')}</span>
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
                  <span>{t('desktop.pin_taskbar', currentLang, 'An Taskleiste anheften')}</span>
                </>
              )}
            </button>
          </div>
        );
      })()}

      {/* 4. Taskbar App Icon Context Menu (Directly anchored above the taskbar) */}
      {taskbarIconContextMenu && (() => {
        const meta = shortcutMeta[taskbarIconContextMenu.modId];
        if (!meta) return null;
        const Icon = meta.icon;
        const openWin = windows.find(w => w.module === taskbarIconContextMenu.modId);
        const isPinned = pinnedTaskbar.includes(taskbarIconContextMenu.modId);

        return (
          <div
            data-context-menu="true"
            style={{
              left: `${Math.max(8, Math.min(taskbarIconContextMenu.x - 30, window.innerWidth - 260))}px`,
              bottom: '54px'
            }}
            className="fixed z-[99999] w-60 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-scale-up text-xs font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
              <div className={`w-6 h-6 rounded-lg ${meta.color} text-white flex items-center justify-center flex-shrink-0 shadow-xs`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs truncate text-slate-800 dark:text-slate-200">{meta.title}</span>
            </div>

            {openWin && (
              <>
                {openWin.isMinimized ? (
                  <button
                    onClick={() => {
                      focusWindow(openWin.id);
                      closeAllContextMenus();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition font-semibold cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
                    <span>{t('taskbar.restore_window', currentLang, 'Wiederherstellen')}</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      minimizeWindow(openWin.id, e);
                      closeAllContextMenus();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
                  >
                    <Minus className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span>{t('taskbar.minimize_window', currentLang, 'Minimieren')}</span>
                  </button>
                )}

                <button
                  onClick={(e) => {
                    toggleMaximizeWindow(openWin.id, e);
                    closeAllContextMenus();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
                >
                  {openWin.isMaximized ? (
                    <>
                      <Minimize2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
                      <span>{t('taskbar.restore_window', currentLang, 'Wiederherstellen')}</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
                      <span>{t('taskbar.maximize_window', currentLang, 'Maximieren')}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={(e) => {
                    closeWindow(openWin.id, e);
                    closeAllContextMenus();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                >
                  <X className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{t('taskbar.close_window', currentLang, 'Fenster schließen')}</span>
                </button>

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              </>
            )}

            {!openWin && (
              <button
                onClick={() => {
                  openWindow(taskbarIconContextMenu.modId, meta.title);
                  closeAllContextMenus();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition font-semibold cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
                <span>{t('desktop.open_app', currentLang, 'App öffnen')}</span>
              </button>
            )}

            <button
              onClick={() => {
                handleTogglePinTaskbar(taskbarIconContextMenu.modId);
                closeAllContextMenus();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
            >
              {isPinned ? (
                <>
                  <PinOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>{t('desktop.unpin_taskbar', currentLang, 'Von Taskleiste lösen')}</span>
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent, #4f46e5)' }} />
                  <span>{t('desktop.pin_taskbar', currentLang, 'An Taskleiste anheften')}</span>
                </>
              )}
            </button>
          </div>
        );
      })()}

      {/* 5. Hover Tooltip for Desktop Icons & Folders (Strictly suppressed when context menu is active) */}
      {desktopTooltip && !hasAnyContextMenu && (
        <div
          style={{
            left: `${desktopTooltip.x}px`,
            top: `${desktopTooltip.y}px`,
            transform: 'translateX(-50%)'
          }}
          className="fixed z-[9990] pointer-events-none px-2.5 py-1 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold shadow-2xl border border-slate-700/80 backdrop-blur-xl animate-fade-in flex flex-col items-center max-w-xs text-center select-none"
        >
          <span>{desktopTooltip.text}</span>
          {desktopTooltip.subtext && (
            <span className="text-[10px] text-slate-300 font-normal mt-0.5">{desktopTooltip.subtext}</span>
          )}
        </div>
      )}

      {/* Global Spotlight / Command Palette Modal */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenModule={(mod) => openWindow(mod)}
        contacts={contacts}
        products={products}
        invoices={invoices}
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        isMuted={isMuted}
        onToggleSound={onToggleSound}
        onOpenLanguageModal={() => setIsLanguageModalOpen(true)}
        currency={company.currency || 'EUR'}
      />
    </div>
  );
};
