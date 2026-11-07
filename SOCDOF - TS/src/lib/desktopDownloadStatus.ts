/**
 * Desktop Download & Installation State Tracker
 * 
 * Determines whether the Windows Desktop App has been downloaded or installed,
 * and whether a newer update is available to display in the Start Menu and Web App.
 */

import { APP_VERSION } from './version';
import { isElectron } from './platform';
import { compareSemver } from './updateChecker';

const KEY_DOWNLOADED = 'socdof_desktop_downloaded';
const KEY_INSTALLED = 'socdof_exe_installed';
const KEY_VERSION = 'socdof_downloaded_version';
const KEY_DISMISSED = 'socdof_dismiss_exe_reminder';
const EVENT_NAME = 'socdof:desktop-download-state-changed';

/**
 * Returns whether the user is in Electron or has already downloaded/installed the desktop app.
 */
export function isDesktopInstalledOrDownloaded(): boolean {
  if (typeof window === 'undefined') return false;
  if (isElectron()) return true;

  try {
    return (
      localStorage.getItem(KEY_DOWNLOADED) === 'true' ||
      localStorage.getItem(KEY_INSTALLED) === 'true' ||
      localStorage.getItem(KEY_DISMISSED) === 'true' ||
      Boolean(localStorage.getItem(KEY_VERSION))
    );
  } catch {
    return false;
  }
}

/**
 * Gets the version that was downloaded or marked as installed.
 */
export function getDownloadedDesktopVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(KEY_VERSION);
    if (saved) return saved;
    return isDesktopInstalledOrDownloaded() ? APP_VERSION : null;
  } catch {
    return null;
  }
}

/**
 * Records that the user downloaded the Windows desktop installer for a specific version.
 */
export function recordDesktopDownloaded(version?: string) {
  if (typeof window === 'undefined') return;
  const targetVersion = version || APP_VERSION;
  try {
    localStorage.setItem(KEY_DOWNLOADED, 'true');
    localStorage.setItem(KEY_INSTALLED, 'true');
    localStorage.setItem(KEY_DISMISSED, 'true');
    localStorage.setItem(KEY_VERSION, targetVersion);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { version: targetVersion, installed: true } }));
  } catch (e) {
    console.warn('Could not record desktop download state:', e);
  }
}

/**
 * Manually marks the desktop app as installed or uninstalled (e.g. from modal toggle).
 */
export function markDesktopAsInstalled(installed: boolean = true) {
  if (typeof window === 'undefined') return;
  try {
    if (installed) {
      localStorage.setItem(KEY_DOWNLOADED, 'true');
      localStorage.setItem(KEY_INSTALLED, 'true');
      localStorage.setItem(KEY_DISMISSED, 'true');
      if (!localStorage.getItem(KEY_VERSION)) {
        localStorage.setItem(KEY_VERSION, APP_VERSION);
      }
    } else {
      localStorage.removeItem(KEY_DOWNLOADED);
      localStorage.removeItem(KEY_INSTALLED);
      localStorage.removeItem(KEY_DISMISSED);
      localStorage.removeItem(KEY_VERSION);
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { installed } }));
  } catch (e) {
    console.warn('Could not update desktop installed state:', e);
  }
}

export interface StartMenuBannerState {
  show: boolean;
  isUpdate: boolean;
  versionToDisplay: string;
}

/**
 * Evaluates if the Start Menu download banner should be shown.
 * - Never shows in Electron
 * - Never shows if user already downloaded/installed current or higher version
 * - Shows as "Update verfügbar" if a newer GitHub release is available
 * - Shows as initial download banner for first-time web visitors
 */
export function evaluateStartMenuDownloadBanner(latestAvailableVersion?: string): StartMenuBannerState {
  // 1. Inside native desktop app: never show download banner
  if (isElectron()) {
    return { show: false, isUpdate: false, versionToDisplay: '' };
  }

  const downloadedVersion = getDownloadedDesktopVersion();
  const isInstalled = isDesktopInstalledOrDownloaded();

  // 2. If the user already downloaded or has it installed:
  if (isInstalled) {
    // If a newer release is known, compare
    if (latestAvailableVersion && downloadedVersion) {
      const cmp = compareSemver(latestAvailableVersion, downloadedVersion);
      if (cmp > 0) {
        // Newer version exists! Show as Update banner
        return {
          show: true,
          isUpdate: true,
          versionToDisplay: latestAvailableVersion
        };
      }
    }
    // No newer version or current version is already downloaded: HIDE!
    return { show: false, isUpdate: false, versionToDisplay: '' };
  }

  // 3. User hasn't downloaded or marked it as installed yet: Show initial download banner
  return {
    show: true,
    isUpdate: false,
    versionToDisplay: latestAvailableVersion || APP_VERSION
  };
}

/**
 * Hook or listener helper for React components.
 */
export function onDesktopDownloadStateChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
  };
}
