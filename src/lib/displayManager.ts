import { DisplayMonitorInfo } from '../types';

const VIRTUAL_DISPLAYS_STORAGE_KEY = 'socdof_virtual_displays';
const WINDOW_POSITIONS_STORAGE_KEY = 'socdof_saved_window_positions';
const NIGHT_LIGHT_STYLE_ID = 'socdof-night-light-filter';

// Helper to determine initial detected monitors
export async function detectConnectedMonitors(): Promise<DisplayMonitorInfo[]> {
  // 1. Electron integration check
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getDisplays) {
    try {
      const res = await (window as any).electronAPI.getDisplays();
      if (res && res.success && Array.isArray(res.displays) && res.displays.length > 0) {
        return res.displays.map((d: any, idx: number) => ({
          id: d.id || idx + 1,
          index: idx + 1,
          label: d.label || `Display ${idx + 1}`,
          isPrimary: Boolean(d.isPrimary),
          width: d.bounds?.width || 1920,
          height: d.bounds?.height || 1080,
          availWidth: d.workArea?.width || d.bounds?.width || 1920,
          availHeight: d.workArea?.height || d.bounds?.height || 1080,
          scale: Math.round((d.scaleFactor || 1) * 100),
          orientation: (d.bounds?.width >= d.bounds?.height ? 'landscape' : 'portrait') as any,
          isVirtual: false
        }));
      }
    } catch (e) {
      console.warn('[DisplayManager] Electron getDisplays failed, falling back to browser detection', e);
    }
  }

  // 2. Browser Window Management API (Chrome 100+)
  if (typeof window !== 'undefined' && 'getScreenDetails' in window) {
    try {
      const screenDetails = await (window as any).getScreenDetails();
      if (screenDetails && screenDetails.screens && screenDetails.screens.length > 0) {
        return screenDetails.screens.map((s: any, idx: number) => ({
          id: idx + 1,
          index: idx + 1,
          label: s.label || `Display ${idx + 1}`,
          isPrimary: s === screenDetails.currentScreen || idx === 0,
          width: s.width || window.screen.width || 1920,
          height: s.height || window.screen.height || 1080,
          availWidth: s.availWidth || window.screen.availWidth || 1920,
          availHeight: s.availHeight || window.screen.availHeight || 1080,
          scale: Math.round((s.devicePixelRatio || window.devicePixelRatio || 1) * 100),
          orientation: (s.width >= s.height ? 'landscape' : 'portrait') as any,
          isVirtual: false
        }));
      }
    } catch {
      // User may decline screen permission or API unavailable
    }
  }

  // 3. Native standard window.screen fallback
  const screenW = typeof window !== 'undefined' ? window.screen.width || 1920 : 1920;
  const screenH = typeof window !== 'undefined' ? window.screen.height || 1080 : 1080;
  const availW = typeof window !== 'undefined' ? window.screen.availWidth || screenW : screenW;
  const availH = typeof window !== 'undefined' ? window.screen.availHeight || screenH : screenH;
  const scale = typeof window !== 'undefined' ? Math.round((window.devicePixelRatio || 1) * 100) : 100;

  const primaryDisplay: DisplayMonitorInfo = {
    id: 1,
    index: 1,
    label: 'Display 1 (Hauptanzeige)',
    isPrimary: true,
    width: screenW,
    height: screenH,
    availWidth: availW,
    availHeight: availH,
    scale: scale,
    orientation: screenW >= screenH ? 'landscape' : 'portrait',
    isVirtual: false
  };

  // 4. Load any stored virtual displays configured by user
  const virtualDisplays = getStoredVirtualDisplays();
  return [primaryDisplay, ...virtualDisplays];
}

export function getStoredVirtualDisplays(): DisplayMonitorInfo[] {
  try {
    const raw = localStorage.getItem(VIRTUAL_DISPLAYS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveStoredVirtualDisplays(displays: DisplayMonitorInfo[]): void {
  try {
    localStorage.setItem(VIRTUAL_DISPLAYS_STORAGE_KEY, JSON.stringify(displays));
  } catch {}
}

export function addVirtualDisplay(existing: DisplayMonitorInfo[]): DisplayMonitorInfo[] {
  const nextIndex = existing.length + 1;
  const newDisplay: DisplayMonitorInfo = {
    id: Date.now(),
    index: nextIndex,
    label: `Display ${nextIndex} (Erweitert)`,
    isPrimary: false,
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    scale: 100,
    orientation: 'landscape',
    isVirtual: true
  };
  const updated = [...existing, newDisplay];
  const virtualsOnly = updated.filter(d => d.isVirtual);
  saveStoredVirtualDisplays(virtualsOnly);
  return updated;
}

export function removeVirtualDisplay(existing: DisplayMonitorInfo[], id: number): DisplayMonitorInfo[] {
  const updated = existing.filter(d => d.id !== id);
  // Re-index remaining
  const reindexed = updated.map((d, i) => ({
    ...d,
    index: i + 1,
    label: d.isPrimary ? `Display 1 (Hauptanzeige)` : `Display ${i + 1} (Erweitert)`
  }));
  const virtualsOnly = reindexed.filter(d => d.isVirtual);
  saveStoredVirtualDisplays(virtualsOnly);
  return reindexed;
}

// Windows-style Identify Badge Overlay
let identifyTimeout: any = null;

export function triggerDisplayIdentification(displays: DisplayMonitorInfo[], onStateChange?: (identifying: boolean) => void): void {
  if (onStateChange) onStateChange(true);

  if (identifyTimeout) {
    clearTimeout(identifyTimeout);
  }

  identifyTimeout = setTimeout(() => {
    if (onStateChange) onStateChange(false);
  }, 3500);
}

// Windows 11 Night Light (Nachtmodus) Color Temperature Application
export function applyNightLight(enabled: boolean, temperatureKelvin: number = 3400): void {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById(NIGHT_LIGHT_STYLE_ID) as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = NIGHT_LIGHT_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  if (!enabled) {
    styleEl.innerHTML = '';
    return;
  }

  // Calculate amber / warm hue strength based on Kelvin (1000K to 6500K)
  // 6500K = Daylight (0% warm), 1000K = Deep Amber (100% warm)
  const norm = Math.max(0, Math.min(1, (6500 - temperatureKelvin) / 5500));
  const sepiaPercent = Math.round(norm * 45); // 0% to 45%
  const brightnessPercent = Math.round(100 - norm * 12); // 100% to 88%
  const hueRotateDeg = Math.round(-norm * 15); // 0 to -15deg

  styleEl.innerHTML = `
    html {
      filter: sepia(${sepiaPercent}%) brightness(${brightnessPercent}%) hue-rotate(${hueRotateDeg}deg) !important;
      transition: filter 0.4s ease-in-out;
    }
  `;
}

// Window Positioning Memory
export interface SavedWindowPlacement {
  monitorId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

export function getSavedWindowPositions(): Record<string, SavedWindowPlacement> {
  try {
    const raw = localStorage.getItem(WINDOW_POSITIONS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

export function saveWindowPosition(moduleId: string, placement: SavedWindowPlacement): void {
  try {
    const current = getSavedWindowPositions();
    current[moduleId] = placement;
    localStorage.setItem(WINDOW_POSITIONS_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

export function getSavedWindowPosition(moduleId: string): SavedWindowPlacement | null {
  const current = getSavedWindowPositions();
  return current[moduleId] || null;
}
