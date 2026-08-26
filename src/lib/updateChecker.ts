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
 * Queries GitHub API for the latest published release of SOCDOF
 */
export async function checkForAppUpdates(): Promise<UpdateInfo | null> {
  try {
    const response = await fetch('https://api.github.com/repos/Strudelcode/SOCDOF/releases/latest', {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No releases published yet on repository
        return {
          hasUpdate: false,
          currentVersion: APP_VERSION,
          latestVersion: APP_VERSION,
          releaseName: 'Aktuelle Version',
          releaseUrl: GITHUB_RELEASES_URL,
          publishedAt: new Date().toISOString(),
          body: 'Sie verwenden die aktuellste Version von SOCDOF.'
        };
      }
      throw new Error(`GitHub API HTTP ${response.status}`);
    }

    const data = await response.json();
    const tagName = data.tag_name || data.name || APP_VERSION;
    const cleanTag = tagName.replace(/^v/i, '');
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
