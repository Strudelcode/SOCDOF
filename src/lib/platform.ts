/**
 * Platform Detection & Web Preview Utilities for SOCDOF
 */

export const GITHUB_RELEASES_URL = 'https://github.com/Strudelcode/SOCDOF/releases';
export const GITHUB_REPO_URL = 'https://github.com/Strudelcode/SOCDOF';

export interface ElectronAPI {
  isElectron: boolean;
  getPlatformInfo: () => Promise<{ isElectron: boolean; platform: string; version: string }>;
  quitApp: () => Promise<void>;
  downloadAndInstallUpdate: (payload: { downloadUrl: string; version: string }) => Promise<{ success: boolean; error?: string }>;
  onUpdateDownloadProgress: (callback: (data: { percent: number; downloadedBytes?: number; totalBytes?: number; isFinished?: boolean }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * Detects whether the app is running in an Electron desktop shell or inside a web browser
 */
export function isElectron(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.electronAPI?.isElectron) {
    return true;
  }
  const userAgent = (navigator?.userAgent || '').toLowerCase();
  return userAgent.includes('electron') || !!(window as any).electron;
}

/**
 * Quits native desktop app if running in Electron, or returns false if in browser
 */
export function quitDesktopApp(): boolean {
  if (typeof window !== 'undefined' && window.electronAPI?.quitApp) {
    window.electronAPI.quitApp();
    return true;
  }
  return false;
}

/**
 * Trigger background download and automated restart installation in Electron
 */
export async function downloadAndInstallDesktopUpdate(payload: { downloadUrl: string; version: string }): Promise<{ success: boolean; error?: string }> {
  if (typeof window !== 'undefined' && window.electronAPI?.downloadAndInstallUpdate) {
    return await window.electronAPI.downloadAndInstallUpdate(payload);
  }
  return { success: false, error: 'Not running in desktop app' };
}

/**
 * Initializes Title and Favicon dynamically to ensure full browser compatibility 
 * across GitHub Pages (/SOCDOF/), custom subpaths, and desktop wrappers.
 */
export function initPlatformEnvironment() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const isDesktop = isElectron();

  // 1. Set Document Title
  document.title = isDesktop ? 'SOCDOF' : 'SOCDOF - Preview';

  // 2. Ensure Favicon is properly attached
  try {
    const svgIconContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%"><defs><clipPath id="outer-rounded"><rect x="0" y="0" width="256" height="256" rx="36" ry="36" /></clipPath></defs><g clip-path="url(#outer-rounded)"><rect x="0" y="0" width="128" height="128" fill="#0078D7" /><rect x="128" y="0" width="128" height="128" fill="#10B981" /><rect x="0" y="128" width="128" height="128" fill="#F59E0B" /><rect x="128" y="128" width="128" height="128" fill="#EF4444" /><rect x="14" y="14" width="228" height="228" rx="26" ry="26" fill="#262626" /></g><text x="128" y="180" text-anchor="middle" font-family="'Plus Jakarta Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="900" font-size="168" fill="#FFFFFF" letter-spacing="-4">S</text></svg>`;
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgIconContent)}`;

    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = dataUri;

    // Also update apple-touch-icon
    let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = dataUri;
  } catch (err) {
    console.warn('Favicon initialization warning:', err);
  }
}
