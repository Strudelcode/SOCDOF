/**
 * GitHub Release Update Checker for SOCDOF
 * Checks https://api.github.com/repos/Strudelcode/SOCDOF/releases/latest
 */

import { APP_VERSION } from './version';
import { GITHUB_RELEASES_URL } from './platform';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseUrl: string;
  publishedAt: string;
  body: string;
  downloadUrl?: string;
}

const STORAGE_KEY_SKIPPED_VERSION = 'socdof_skipped_update_version';
const STORAGE_KEY_SNOOZE_UNTIL = 'socdof_update_snooze_until';

/**
 * Checks if a specific version has been explicitly skipped by the user
 */
export function isVersionSkipped(version: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const skipped = localStorage.getItem(STORAGE_KEY_SKIPPED_VERSION);
    return skipped === version;
  } catch {
    return false;
  }
}

/**
 * Marks a version as permanently skipped
 */
export function setVersionSkipped(version: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SKIPPED_VERSION, version);
  } catch (err) {
    console.warn('Could not save skipped update version:', err);
  }
}

/**
 * Checks if update notifications are currently snoozed
 */
export function isUpdateSnoozed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const snoozeUntil = sessionStorage.getItem(STORAGE_KEY_SNOOZE_UNTIL);
    if (!snoozeUntil) return false;
    return Date.now() < parseInt(snoozeUntil, 10);
  } catch {
    return false;
  }
}

/**
 * Snoozes update notifications for a specified duration (default: 4 hours / current session)
 */
export function snoozeUpdateNotification(durationHours: number = 4) {
  if (typeof window === 'undefined') return;
  try {
    const until = Date.now() + durationHours * 3600 * 1000;
    sessionStorage.setItem(STORAGE_KEY_SNOOZE_UNTIL, until.toString());
  } catch (err) {
    console.warn('Could not set update snooze:', err);
  }
}

/**
 * Normalizes semver string for clean comparison (e.g. "v20.0.1" -> [20, 0, 1])
 */
function parseSemver(v: string): number[] {
  const clean = v.replace(/^v/i, '').trim();
  const parts = clean.split('.').map(p => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

/**
 * Compares two versions: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareSemver(v1: string, v2: string): number {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Queries GitHub API for the latest published official release of SOCDOF (strictly ignoring prereleases)
 */
export async function checkForAppUpdates(): Promise<UpdateInfo | null> {
  try {
    // Primary check: /releases/latest endpoint natively excludes drafts and prereleases
    let response = await fetch('https://api.github.com/repos/Strudelcode/SOCDOF/releases/latest', {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let data: any = null;

    if (response.ok) {
      data = await response.json();
      // Double check: strictly ignore if marked as prerelease or draft
      if (data.prerelease || data.draft) {
        data = null;
      }
    }

    // Fallback: If /latest returned 404 or a prerelease, inspect release list for the latest stable non-prerelease
    if (!data) {
      const listResp = await fetch('https://api.github.com/repos/Strudelcode/SOCDOF/releases?per_page=20', {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        if (Array.isArray(listData)) {
          // Find first stable release that is neither a prerelease nor a draft
          data = listData.find((r: any) => !r.prerelease && !r.draft) || null;
        }
      }
    }

    if (!data) {
      // No official stable releases published yet on repository
      return {
        hasUpdate: false,
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        releaseName: 'Aktuelle Version',
        releaseUrl: GITHUB_RELEASES_URL,
        publishedAt: new Date().toISOString(),
        body: 'Sie verwenden die aktuellste Version von SOCDOF (keine neuen Haupt-Releases verfügbar).'
      };
    }

    const tagName = data.tag_name || data.name || APP_VERSION;
    const cleanTag = tagName.replace(/^v/i, '').trim();
    const hasUpdate = compareSemver(cleanTag, APP_VERSION) > 0;

    // Find any .exe attachment asset if present
    const exeAsset = Array.isArray(data.assets) 
      ? data.assets.find((a: any) => a.name?.toLowerCase().endsWith('.exe'))
      : null;

    return {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion: cleanTag,
      releaseName: data.name || tagName,
      releaseUrl: data.html_url || GITHUB_RELEASES_URL,
      publishedAt: data.published_at || new Date().toISOString(),
      body: data.body || '',
      downloadUrl: exeAsset?.browser_download_url || data.html_url || GITHUB_RELEASES_URL
    };
  } catch (err) {
    console.warn('Update check warning (using offline fallback):', err);
    return null;
  }
}
