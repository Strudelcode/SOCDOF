import { db, exportDatabaseToJson, importDatabaseFromJson } from './db';
import { CompanyProfile } from '../types';
import { sounds } from './sound';

export interface BackupSnapshotMeta {
  id: string;
  timestamp: string;
  sizeBytes: number;
  totalRecords: number;
  isAuto: boolean;
  folderPath: string;
  summary: {
    contacts: number;
    products: number;
    invoices: number;
    purchases: number;
    posOrders: number;
  };
}

export interface BackupSnapshot extends BackupSnapshotMeta {
  dataJson: string;
}

const STORAGE_KEY_SNAPSHOTS_META = 'socdof_backup_snapshots_meta';
const STORAGE_KEY_LAST_AUTO_BACKUP = 'socdof_last_auto_backup_ts';

/**
 * Retrieves the list of stored local backup snapshots (metadata only to keep memory fast)
 */
export function getStoredBackupSnapshots(): BackupSnapshotMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SNAPSHOTS_META);
    if (!raw) return [];
    return JSON.parse(raw) as BackupSnapshotMeta[];
  } catch (err) {
    console.warn('Could not read backup snapshots metadata:', err);
    return [];
  }
}

/**
 * Saves the list of snapshot metadata
 */
function saveStoredBackupSnapshotsMeta(metas: BackupSnapshotMeta[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SNAPSHOTS_META, JSON.stringify(metas));
  } catch (err) {
    console.warn('Could not save backup snapshots metadata:', err);
  }
}

/**
 * Creates a new full snapshot of the IndexedDB database
 */
export async function createDatabaseBackup(
  isAuto: boolean,
  company: CompanyProfile,
  downloadDirectly: boolean = false
): Promise<BackupSnapshotMeta> {
  const jsonStr = await exportDatabaseToJson({
    pretty: true,
    owner: company.backup_owner || company.name || 'Administrator',
    folder: company.backup_folder_path || 'C:\\ERP-Daten\\SOCDOF_Backups'
  });

  const parsed = JSON.parse(jsonStr);
  const sizeBytes = new Blob([jsonStr]).size;
  const nowIso = new Date().toISOString();
  const id = `backup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const summary = {
    contacts: parsed.contacts?.length || 0,
    products: parsed.products?.length || 0,
    invoices: parsed.invoices?.length || 0,
    purchases: parsed.purchase_orders?.length || 0,
    posOrders: parsed.pos_orders?.length || 0
  };

  const totalRecords = Object.values(summary).reduce((acc, v) => acc + v, 0);

  const meta: BackupSnapshotMeta = {
    id,
    timestamp: nowIso,
    sizeBytes,
    totalRecords,
    isAuto,
    folderPath: company.backup_folder_path || 'C:\\ERP-Daten\\SOCDOF_Backups',
    summary
  };

  // Store snapshot payload in localStorage with key prefix
  try {
    localStorage.setItem(`socdof_backup_data_${id}`, jsonStr);

    // Update metadata index
    const existing = getStoredBackupSnapshots();
    const maxKeep = company.backup_max_keep_count || 10;
    const updated = [meta, ...existing];

    // Prune older backups exceeding max count
    if (updated.length > maxKeep) {
      const removed = updated.splice(maxKeep);
      for (const rem of removed) {
        localStorage.removeItem(`socdof_backup_data_${rem.id}`);
      }
    }

    saveStoredBackupSnapshotsMeta(updated);
    localStorage.setItem(STORAGE_KEY_LAST_AUTO_BACKUP, Date.now().toString());
  } catch (err) {
    console.warn('LocalStorage full or error storing snapshot payload:', err);
  }

  // If requested, download file directly to user's disk
  if (downloadDirectly) {
    downloadBackupFile(jsonStr, meta.timestamp, company);
  }

  return meta;
}

/**
 * Downloads a backup JSON file to the user's Downloads / target folder
 */
export function downloadBackupFile(
  jsonContent: string,
  timestamp: string,
  company: CompanyProfile
) {
  const dateFormatted = timestamp.split('T')[0];
  const timeFormatted = timestamp.split('T')[1].replace(/:/g, '-').slice(0, 5);
  const cleanName = (company.name || 'SOCDOF').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanName}_Backup_${dateFormatted}_${timeFormatted}.socdof.json`;

  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 400);
}

/**
 * Downloads a specific snapshot by ID
 */
export function downloadSnapshotById(id: string, company: CompanyProfile) {
  try {
    const raw = localStorage.getItem(`socdof_backup_data_${id}`);
    if (!raw) {
      throw new Error('Backup-Daten nicht gefunden.');
    }
    const meta = getStoredBackupSnapshots().find(m => m.id === id);
    sounds.playSuccess();
    downloadBackupFile(raw, meta?.timestamp || new Date().toISOString(), company);
  } catch (err) {
    console.error('Error downloading snapshot:', err);
  }
}

/**
 * Restores a stored snapshot by ID
 */
export async function restoreSnapshotById(id: string): Promise<boolean> {
  const raw = localStorage.getItem(`socdof_backup_data_${id}`);
  if (!raw) {
    throw new Error('Backup-Snapshot nicht im lokalen Speicher gefunden.');
  }

  sounds.playSuccess();
  return await importDatabaseFromJson(raw);
}

/**
 * Deletes a stored snapshot by ID
 */
export function deleteSnapshotById(id: string): BackupSnapshotMeta[] {
  try {
    localStorage.removeItem(`socdof_backup_data_${id}`);
    const existing = getStoredBackupSnapshots();
    const updated = existing.filter(m => m.id !== id);
    saveStoredBackupSnapshotsMeta(updated);
    sounds.playPop();
    return updated;
  } catch (err) {
    console.warn('Could not delete snapshot:', err);
    return getStoredBackupSnapshots();
  }
}

/**
 * Automatically checks whether an automatic backup is due based on CompanyProfile settings
 */
export async function checkAndRunAutoBackup(
  company: CompanyProfile,
  onSuccess?: (meta: BackupSnapshotMeta) => void
): Promise<BackupSnapshotMeta | null> {
  // If auto-backup is disabled, do nothing
  if (company.auto_backup_enabled === false) {
    return null;
  }

  const intervalMinutes = company.backup_interval_minutes || 120; // default 2 hours
  const intervalMs = intervalMinutes * 60 * 1000;

  const lastBackupStr = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LAST_AUTO_BACKUP) : null;
  const lastBackupTs = lastBackupStr ? parseInt(lastBackupStr, 10) : 0;
  const now = Date.now();

  if (now - lastBackupTs >= intervalMs) {
    try {
      const meta = await createDatabaseBackup(true, company, false);
      if (onSuccess) {
        onSuccess(meta);
      }
      return meta;
    } catch (err) {
      console.warn('Auto backup execution error:', err);
    }
  }

  return null;
}
