import { StorageAsset, StorageAssetCategory } from '../types';

const STORAGE_KEY = 'socdof_storage_assets';

/**
 * Determine asset category from MIME type and filename extension
 */
export function determineAssetCategory(mimeType: string, filename: string): StorageAssetCategory {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mimeType.includes('spreadsheet') || 
    mimeType.includes('excel') || 
    mimeType === 'text/csv' || 
    ['xlsx', 'xls', 'csv', 'ods'].includes(ext)
  ) {
    return 'spreadsheet';
  }
  if (
    mimeType.includes('word') || 
    mimeType.includes('document') || 
    mimeType.includes('text/') || 
    ['doc', 'docx', 'txt', 'rtf', 'odt', 'md'].includes(ext)
  ) {
    return 'document';
  }
  if (
    mimeType.includes('zip') || 
    mimeType.includes('compressed') || 
    mimeType.includes('tar') || 
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) {
    return 'archive';
  }
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return 'audio';
  }
  if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
    return 'video';
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'sh', 'bat', 'xml', 'sql'].includes(ext)) {
    return 'code';
  }
  return 'other';
}

/**
 * Format bytes into human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Load all stored assets from local storage
 */
export function getStorageAssets(): StorageAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StorageAsset[];
  } catch (err) {
    console.error('Failed to load storage assets:', err);
    return [];
  }
}

/**
 * Save assets list to local storage
 */
export function saveStorageAssets(assets: StorageAsset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    // Dispatch custom event for reactive sync across views
    window.dispatchEvent(new CustomEvent('socdof-storage-assets-updated', { detail: assets }));
  } catch (err) {
    console.error('Failed to save storage assets:', err);
  }
}

/**
 * Convert a browser File object to a Base64 data URL
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Import a file from a local storage location and persist it
 */
export async function uploadFileFromStorage(
  file: File,
  folderId?: string,
  storageLocationName?: string
): Promise<StorageAsset> {
  let dataUrl = '';
  // Convert to dataUrl for offline preview and download (up to 15MB)
  if (file.size <= 15 * 1024 * 1024) {
    try {
      dataUrl = await readFileAsDataUrl(file);
    } catch {
      dataUrl = '';
    }
  }

  const category = determineAssetCategory(file.type, file.name);
  const newAsset: StorageAsset = {
    id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    category,
    dataUrl,
    storageLocationName: storageLocationName || 'Lokaler Speicher / Hochgeladene Datei',
    folderId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const existing = getStorageAssets();
  const next = [newAsset, ...existing];
  saveStorageAssets(next);
  return newAsset;
}

/**
 * Get assets belonging to a specific DesktopFolder
 */
export function getAssetsForFolder(folderId: string): StorageAsset[] {
  return getStorageAssets().filter(a => a.folderId === folderId);
}

/**
 * Link or unlink an asset to a specific DesktopFolder
 */
export function linkAssetToFolder(assetId: string, folderId?: string): void {
  const assets = getStorageAssets();
  const next = assets.map(a => (a.id === assetId ? { ...a, folderId, updatedAt: new Date().toISOString() } : a));
  saveStorageAssets(next);
}

/**
 * Delete an asset from storage
 */
export function deleteStorageAsset(assetId: string): void {
  const assets = getStorageAssets();
  const next = assets.filter(a => a.id !== assetId);
  saveStorageAssets(next);
}

/**
 * Trigger local download of a stored asset
 */
export function downloadStorageAsset(asset: StorageAsset): void {
  if (!asset.dataUrl) {
    // If no dataUrl, generate text representation or alert
    const blob = new Blob([`SOCDOF File Asset: ${asset.name}\nSize: ${formatFileSize(asset.size)}\nUploaded: ${asset.createdAt}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = asset.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const a = document.createElement('a');
  a.href = asset.dataUrl;
  a.download = asset.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
