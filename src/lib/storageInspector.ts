import { db } from './db';
import { formatFileSize } from './storageAssets';
import { BackupSnapshotMeta, getStoredBackupSnapshots } from './backupManager';
import { StorageAsset } from '../types';

export interface ModuleStorageItem {
  id: string;
  nameKey: string;
  defaultName: string;
  category: 'database' | 'snapshots' | 'files' | 'service' | 'settings' | 'cache';
  recordCount: number;
  sizeBytes: number;
  sizeFormatted: string;
  percentage: number;
  colorHex: string;
  badgeClass: string;
  icon: string;
  storageEngine: 'IndexedDB' | 'LocalStorage';
  description: string;
  canClean?: boolean;
}

export interface UserProfileStorageItem {
  id: string;
  name: string;
  role: string;
  sizeBytes: number;
  sizeFormatted: string;
  percentage: number;
  isCurrent: boolean;
  details: string;
}

export interface LargestStorageConsumer {
  id: string;
  title: string;
  moduleName: string;
  sizeBytes: number;
  sizeFormatted: string;
  type: string;
  date?: string;
  storageKey?: string;
}

export interface StorageSystemQuota {
  usageBytes: number;
  quotaBytes: number;
  usageFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
  availableBytes: number;
  availableFormatted: string;
}

export interface StorageInspectorData {
  totalSizeBytes: number;
  totalSizeFormatted: string;
  totalRecords: number;
  modules: ModuleStorageItem[];
  systemQuota?: StorageSystemQuota;
  userProfiles: UserProfileStorageItem[];
  largestItems: LargestStorageConsumer[];
  generatedAt: string;
}

/**
 * Calculates byte size of any serializable object or string
 */
function calculateByteSize(payload: unknown): number {
  try {
    if (payload === null || payload === undefined) return 0;
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return new Blob([raw]).size;
  } catch {
    return 0;
  }
}

/**
 * Comprehensive Storage Inspector scanning IndexedDB, LocalStorage, and Browser Quota
 */
export async function inspectCompleteStorage(activeOwnerName?: string): Promise<StorageInspectorData> {
  // 1. Scan all IndexedDB tables
  const [
    contacts,
    products,
    stockMoves,
    invoices,
    purchases,
    posOrders,
    chatterMessages,
    dbSettings
  ] = await Promise.all([
    db.contacts.toArray().catch(() => []),
    db.products.toArray().catch(() => []),
    db.stock_moves.toArray().catch(() => []),
    db.invoices.toArray().catch(() => []),
    db.purchase_orders.toArray().catch(() => []),
    db.pos_orders.toArray().catch(() => []),
    db.chatter_messages.toArray().catch(() => []),
    db.settings.toArray().catch(() => [])
  ]);

  const contactsBytes = calculateByteSize(contacts);
  const productsBytes = calculateByteSize(products);
  const stockMovesBytes = calculateByteSize(stockMoves);
  const invoicesBytes = calculateByteSize(invoices);
  const purchasesBytes = calculateByteSize(purchases);
  const posOrdersBytes = calculateByteSize(posOrders);
  const chatterBytes = calculateByteSize(chatterMessages);
  const dbSettingsBytes = calculateByteSize(dbSettings);

  // 2. Scan LocalStorage domains
  const largestItems: LargestStorageConsumer[] = [];

  // 2a. Snapshots & Backups
  let snapshotsMeta: BackupSnapshotMeta[] = [];
  let snapshotsBytes = 0;
  try {
    snapshotsMeta = getStoredBackupSnapshots();
    const metaRaw = localStorage.getItem('socdof_backup_snapshots_meta') || '';
    snapshotsBytes += calculateByteSize(metaRaw);

    for (const snap of snapshotsMeta) {
      const snapKey = `socdof_backup_data_${snap.id}`;
      const snapRaw = localStorage.getItem(snapKey);
      if (snapRaw) {
        const snapSize = calculateByteSize(snapRaw);
        snapshotsBytes += snapSize;
        largestItems.push({
          id: snap.id,
          title: `Snapshot (${snap.isAuto ? 'Auto' : 'Manuell'}) - ${new Date(snap.timestamp).toLocaleString()}`,
          moduleName: 'storage.module_snapshots',
          sizeBytes: snapSize,
          sizeFormatted: formatFileSize(snapSize),
          type: 'Backup Snapshot',
          date: snap.timestamp,
          storageKey: snapKey
        });
      }
    }
  } catch (err) {
    console.warn('StorageInspector snapshots scan error:', err);
  }

  // 2b. Storage Assets (Desktop file manager)
  let storageAssets: StorageAsset[] = [];
  let storageAssetsBytes = 0;
  try {
    const rawAssets = localStorage.getItem('socdof_storage_assets') || '';
    storageAssetsBytes += calculateByteSize(rawAssets);
    storageAssets = JSON.parse(rawAssets || '[]');
    for (const asset of storageAssets) {
      const aSize = asset.size || calculateByteSize(asset.dataUrl || '');
      largestItems.push({
        id: asset.id,
        title: asset.name,
        moduleName: 'storage.module_files',
        sizeBytes: aSize,
        sizeFormatted: formatFileSize(aSize),
        type: `Asset (${asset.category})`,
        date: asset.createdAt
      });
    }
  } catch (err) {
    console.warn('StorageInspector assets scan error:', err);
  }

  // 2c. Support & Service Tickets
  let supportTicketsCount = 0;
  let supportBytes = 0;
  try {
    const rawTickets = localStorage.getItem('socdof_support_services_tickets_v2') || '';
    const rawTeams = localStorage.getItem('socdof_support_teams_list_v2') || '';
    const rawStaff = localStorage.getItem('socdof_support_staff_list_v2') || '';
    const rawSet = localStorage.getItem('socdof_support_settings_v3') || '';
    const tickets = JSON.parse(rawTickets || '[]');
    supportTicketsCount = Array.isArray(tickets) ? tickets.length : 0;
    supportBytes = calculateByteSize(rawTickets) + calculateByteSize(rawTeams) + calculateByteSize(rawStaff) + calculateByteSize(rawSet);

    // Collect individual large tickets if any
    if (Array.isArray(tickets)) {
      for (const t of tickets.slice(0, 5)) {
        const tSize = calculateByteSize(t);
        if (tSize > 1024 * 5) {
          largestItems.push({
            id: String(t.id),
            title: `Ticket #${t.ticket_number || t.id}: ${t.title || 'Support Ticket'}`,
            moduleName: 'storage.module_support',
            sizeBytes: tSize,
            sizeFormatted: formatFileSize(tSize),
            type: 'Service Ticket',
            date: t.created_at
          });
        }
      }
    }
  } catch (err) {
    console.warn('StorageInspector support scan error:', err);
  }

  // 2d. Gastro POS & Receipts
  let posGastroBytes = 0;
  let posGastroCount = 0;
  try {
    const rawDishes = localStorage.getItem('ios_billing_dishes') || '';
    const rawReceipts = localStorage.getItem('ios_billing_receipts') || '';
    const rawCategories = localStorage.getItem('ios_billing_categories') || '';
    const receipts = JSON.parse(rawReceipts || '[]');
    posGastroCount = Array.isArray(receipts) ? receipts.length : 0;
    posGastroBytes = calculateByteSize(rawDishes) + calculateByteSize(rawReceipts) + calculateByteSize(rawCategories);
  } catch (err) {
    console.warn('StorageInspector gastro scan error:', err);
  }

  // 2e. Calendar & Appointments
  let calendarBytes = 0;
  let calendarCount = 0;
  try {
    const rawCal = localStorage.getItem('socdof_custom_calendar_events') || '';
    const events = JSON.parse(rawCal || '[]');
    calendarCount = Array.isArray(events) ? events.length : 0;
    calendarBytes = calculateByteSize(rawCal);
  } catch (err) {
    console.warn('StorageInspector calendar scan error:', err);
  }

  // 2f. Custom Language Packs
  let langPacksBytes = 0;
  let langPacksCount = 0;
  try {
    const rawPacks = localStorage.getItem('socdof_custom_lang_packs') || '';
    const packs = JSON.parse(rawPacks || '[]');
    langPacksCount = Array.isArray(packs) ? packs.length : 0;
    langPacksBytes = calculateByteSize(rawPacks);
  } catch (err) {
    console.warn('StorageInspector lang packs scan error:', err);
  }

  // 2g. Desktop Customization & Wallpapers
  let customizationBytes = 0;
  try {
    const rawWallpapers = localStorage.getItem('socdof_desktop_wallpapers') || '';
    const rawWidgets = localStorage.getItem('socdof_desktop_widgets') || '';
    customizationBytes = calculateByteSize(rawWallpapers) + calculateByteSize(rawWidgets);

    if (rawWallpapers && rawWallpapers.length > 1024 * 10) {
      largestItems.push({
        id: 'wallpapers',
        title: 'Benutzerdefinierte Desktop-Hintergründe',
        moduleName: 'storage.module_customization',
        sizeBytes: calculateByteSize(rawWallpapers),
        sizeFormatted: formatFileSize(calculateByteSize(rawWallpapers)),
        type: 'Medien & Wallpaper'
      });
    }
  } catch (err) {
    console.warn('StorageInspector customization scan error:', err);
  }

  // 2h. Temporary Caches & State Flags
  let cacheBytes = 0;
  let cacheCount = 0;
  try {
    const tempKeys = [
      'socdof_calc_history',
      'socdof_dismiss_exe_reminder',
      'socdof_exe_installed',
      'socdof_support_chatter_visible',
      'socdof_support_form_modules_ratio',
      'socdof_support_chatter_width',
      'socdof_calc_mode',
      'socdof_calc_angle',
      'socdof_calc_precision',
      'socdof_calc_sound'
    ];
    for (const k of tempKeys) {
      const val = localStorage.getItem(k);
      if (val !== null) {
        cacheBytes += calculateByteSize(val);
        cacheCount++;
      }
    }
  } catch (err) {
    console.warn('StorageInspector cache scan error:', err);
  }

  // Total App Size Calculation
  const totalSizeBytes = 
    contactsBytes +
    productsBytes +
    stockMovesBytes +
    invoicesBytes +
    purchasesBytes +
    posOrdersBytes +
    chatterBytes +
    dbSettingsBytes +
    snapshotsBytes +
    storageAssetsBytes +
    supportBytes +
    posGastroBytes +
    calendarBytes +
    langPacksBytes +
    customizationBytes +
    cacheBytes;

  const totalRecords = 
    contacts.length +
    products.length +
    stockMoves.length +
    invoices.length +
    purchases.length +
    posOrders.length +
    chatterMessages.length +
    snapshotsMeta.length +
    storageAssets.length +
    supportTicketsCount +
    posGastroCount +
    calendarCount;

  // Build granular modules list
  const rawModules: Omit<ModuleStorageItem, 'percentage'>[] = [
    {
      id: 'invoices',
      nameKey: 'storage.module_invoices',
      defaultName: 'Rechnungen & E-Rechnungen (SdI / XML)',
      category: 'database',
      recordCount: invoices.length,
      sizeBytes: invoicesBytes,
      sizeFormatted: formatFileSize(invoicesBytes),
      colorHex: '#4f46e5', // indigo
      badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      icon: 'FileText',
      storageEngine: 'IndexedDB',
      description: 'Verkaufsrechnungen, Rechnungsentwürfe, Zahlungsprotokolle und E-Rechnungsdateien.'
    },
    {
      id: 'products',
      nameKey: 'storage.module_products',
      defaultName: 'Produkte, Barcodes & Inventar',
      category: 'database',
      recordCount: products.length,
      sizeBytes: productsBytes,
      sizeFormatted: formatFileSize(productsBytes),
      colorHex: '#f59e0b', // amber
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      icon: 'Package',
      storageEngine: 'IndexedDB',
      description: 'Artikelkatalog, Barcodes, Preise, Mindestbestände und Beschreibungen.'
    },
    {
      id: 'contacts',
      nameKey: 'storage.module_contacts',
      defaultName: 'Kontakte & Kundenadressbuch',
      category: 'database',
      recordCount: contacts.length,
      sizeBytes: contactsBytes,
      sizeFormatted: formatFileSize(contactsBytes),
      colorHex: '#0ea5e9', // sky/blue
      badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      icon: 'Users',
      storageEngine: 'IndexedDB',
      description: 'Kunden, Lieferanten, Postanschriften, Steuernummern und E-Rechnungsadressen.'
    },
    {
      id: 'snapshots',
      nameKey: 'storage.module_snapshots',
      defaultName: 'Wiederherstellungspunkte & Snapshots',
      category: 'snapshots',
      recordCount: snapshotsMeta.length,
      sizeBytes: snapshotsBytes,
      sizeFormatted: formatFileSize(snapshotsBytes),
      colorHex: '#8b5cf6', // purple
      badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      icon: 'Save',
      storageEngine: 'LocalStorage',
      description: 'Automatische Zeitplan-Backups und manuelle Wiederherstellungspunkte.',
      canClean: true
    },
    {
      id: 'files',
      nameKey: 'storage.module_files',
      defaultName: 'Dokumente & Dateispeicher (Assets)',
      category: 'files',
      recordCount: storageAssets.length,
      sizeBytes: storageAssetsBytes,
      sizeFormatted: formatFileSize(storageAssetsBytes),
      colorHex: '#ec4899', // pink/rose
      badgeClass: 'bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800',
      icon: 'FolderOpen',
      storageEngine: 'LocalStorage',
      description: 'Hochgeladene Belege, PDF-Dateien, Bilder und Desktop-Dokumentenanhänge.'
    },
    {
      id: 'support',
      nameKey: 'storage.module_support',
      defaultName: 'Support-Tickets & Kundendienst',
      category: 'service',
      recordCount: supportTicketsCount,
      sizeBytes: supportBytes,
      sizeFormatted: formatFileSize(supportBytes),
      colorHex: '#06b6d4', // cyan
      badgeClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
      icon: 'HelpCircle',
      storageEngine: 'LocalStorage',
      description: 'Kundenanfragen, Zeiterfassung, Technikerprotokolle und Notizenverlauf.'
    },
    {
      id: 'pos_gastro',
      nameKey: 'storage.module_pos',
      defaultName: 'Kasse, Gastro-Bons & POS',
      category: 'database',
      recordCount: posOrders.length + posGastroCount,
      sizeBytes: posOrdersBytes + posGastroBytes,
      sizeFormatted: formatFileSize(posOrdersBytes + posGastroBytes),
      colorHex: '#10b981', // emerald
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      icon: 'Coins',
      storageEngine: 'IndexedDB',
      description: 'Kassenbelege, TSE-Auditprotokolle, Gastro-Speisekarten und Kassenabschlüsse.'
    },
    {
      id: 'stock',
      nameKey: 'storage.module_stock',
      defaultName: 'Lagerbuchungen & Lieferantenbestellungen',
      category: 'database',
      recordCount: stockMoves.length + purchases.length,
      sizeBytes: stockMovesBytes + purchasesBytes,
      sizeFormatted: formatFileSize(stockMovesBytes + purchasesBytes),
      colorHex: '#64748b', // slate
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      icon: 'Layers',
      storageEngine: 'IndexedDB',
      description: 'Warenbewegungen, Einlagerungsprotokolle und Lieferantenaufträge.'
    },
    {
      id: 'calendar',
      nameKey: 'storage.module_calendar',
      defaultName: 'Termine & Kalender-Ereignisse',
      category: 'service',
      recordCount: calendarCount,
      sizeBytes: calendarBytes,
      sizeFormatted: formatFileSize(calendarBytes),
      colorHex: '#3b82f6', // blue
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      icon: 'Calendar',
      storageEngine: 'LocalStorage',
      description: 'Termine, Fälligkeiten, Wartungsfenster und importierte iCal-Feeds.'
    },
    {
      id: 'languages',
      nameKey: 'storage.module_languages',
      defaultName: 'Sprachpakete & Übersetzungskataloge',
      category: 'settings',
      recordCount: langPacksCount,
      sizeBytes: langPacksBytes,
      sizeFormatted: formatFileSize(langPacksBytes),
      colorHex: '#14b8a6', // teal
      badgeClass: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
      icon: 'Globe',
      storageEngine: 'LocalStorage',
      description: 'Benutzerdefinierte Desktop-Übersetzungen und Community-Sprachpakete.'
    },
    {
      id: 'customization',
      nameKey: 'storage.module_customization',
      defaultName: 'Desktop-Personalisierung & Widgets',
      category: 'settings',
      recordCount: 1,
      sizeBytes: customizationBytes,
      sizeFormatted: formatFileSize(customizationBytes),
      colorHex: '#f97316', // orange
      badgeClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      icon: 'Palette',
      storageEngine: 'LocalStorage',
      description: 'Hintergrundbilder, Desktop-Widgets, Notizzettel und Akzentfarben.'
    },
    {
      id: 'caches',
      nameKey: 'storage.module_caches',
      defaultName: 'Temporäre UI-Caches & Statusflags',
      category: 'cache',
      recordCount: cacheCount,
      sizeBytes: cacheBytes,
      sizeFormatted: formatFileSize(cacheBytes),
      colorHex: '#94a3b8', // light slate
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      icon: 'Zap',
      storageEngine: 'LocalStorage',
      description: 'Rechner-Historie, Fensteranordnungen, UI-Zustände und Benachrichtigungsflags.',
      canClean: true
    }
  ];

  // Calculate percentages based on non-zero total
  const safeTotal = totalSizeBytes > 0 ? totalSizeBytes : 1;
  const modules: ModuleStorageItem[] = rawModules
    .map(m => ({
      ...m,
      percentage: Number(((m.sizeBytes / safeTotal) * 100).toFixed(1))
    }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes);

  // 3. Browser Storage Quota Assessment (via StorageManager API)
  let systemQuota: StorageSystemQuota | undefined;
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const est = await navigator.storage.estimate();
      if (est.quota && est.quota > 0) {
        const usage = est.usage || totalSizeBytes;
        const quota = est.quota;
        const percentUsed = Number(((usage / quota) * 100).toFixed(2));
        const available = Math.max(0, quota - usage);

        systemQuota = {
          usageBytes: usage,
          quotaBytes: quota,
          usageFormatted: formatFileSize(usage),
          quotaFormatted: formatFileSize(quota),
          percentUsed,
          availableBytes: available,
          availableFormatted: formatFileSize(available)
        };
      }
    } catch (err) {
      console.warn('StorageManager estimate error:', err);
    }
  }

  // 4. Multi-User Storage Breakdown
  const primaryUserName = activeOwnerName || 'Administrator (Hauptkonto)';
  const userProfiles: UserProfileStorageItem[] = [
    {
      id: 'primary',
      name: primaryUserName,
      role: 'System Administrator (Vollzugriff)',
      sizeBytes: totalSizeBytes,
      sizeFormatted: formatFileSize(totalSizeBytes),
      percentage: 100,
      isCurrent: true,
      details: 'Vollständiger ERP-Datenbestand, Kunden, Rechnungen, Firmeneinstellungen und Backups.'
    }
  ];

  // Sort largest consumers
  largestItems.sort((a, b) => b.sizeBytes - a.sizeBytes);

  return {
    totalSizeBytes,
    totalSizeFormatted: formatFileSize(totalSizeBytes),
    totalRecords,
    modules,
    systemQuota,
    userProfiles,
    largestItems: largestItems.slice(0, 8),
    generatedAt: new Date().toISOString()
  };
}

/**
 * 1-Click Optimization: Prunes older backup snapshots, keeping only the latest N
 */
export async function pruneOldSnapshots(keepLatestCount: number = 5): Promise<{ removedCount: number; freedBytes: number }> {
  try {
    const list = getStoredBackupSnapshots();
    if (list.length <= keepLatestCount) {
      return { removedCount: 0, freedBytes: 0 };
    }

    // Sort descending by date (newest first)
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const toKeep = list.slice(0, keepLatestCount);
    const toDelete = list.slice(keepLatestCount);

    let freedBytes = 0;
    for (const snap of toDelete) {
      const snapKey = `socdof_backup_data_${snap.id}`;
      const raw = localStorage.getItem(snapKey);
      if (raw) {
        freedBytes += calculateByteSize(raw);
        localStorage.removeItem(snapKey);
      }
    }

    localStorage.setItem('socdof_backup_snapshots_meta', JSON.stringify(toKeep));
    return { removedCount: toDelete.length, freedBytes };
  } catch (err) {
    console.error('Error pruning old snapshots:', err);
    return { removedCount: 0, freedBytes: 0 };
  }
}

/**
 * 1-Click Optimization: Clears non-essential temporary caches, calculation history and flags
 */
export async function clearTemporaryCaches(): Promise<{ freedBytes: number; itemsCleared: string[] }> {
  const itemsCleared: string[] = [];
  let freedBytes = 0;

  const tempKeys = [
    'socdof_calc_history',
    'socdof_dismiss_exe_reminder',
    'socdof_support_chatter_visible',
    'socdof_support_form_modules_ratio',
    'socdof_support_chatter_width'
  ];

  for (const key of tempKeys) {
    const val = localStorage.getItem(key);
    if (val !== null) {
      freedBytes += calculateByteSize(val);
      localStorage.removeItem(key);
      itemsCleared.push(key);
    }
  }

  return { freedBytes, itemsCleared };
}
