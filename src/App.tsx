import React, { useState, useEffect, useCallback } from 'react';
import { 
  Contact, 
  Product, 
  StockMove, 
  Invoice, 
  CompanyProfile,
  PurchaseOrder,
  POSOrder
} from './types';
import { 
  db, 
  seedInitialDataIfNeeded, 
  defaultCompanyProfile, 
  clearDatabaseToEmpty, 
  resetDatabaseToDemo,
  exportDatabaseToJson
} from './lib/db';
import { sounds } from './lib/sound';
import { StudioDrawer } from './components/StudioDrawer';
import { DesktopWindowWorkspace } from './components/DesktopWindowWorkspace';
import { AccountScopedWorkspace } from './components/AccountScopedWorkspace';
import { LanguageSelectionModal } from './components/LanguageSelectionModal';
import { BackupSetupModal } from './components/BackupSetupModal';
import { AuthGate } from './components/AuthGate';
import { applyAccentColor } from './lib/accent';
import { getLanguage, setLanguage, LanguageCode } from './lib/i18n';
import { checkAndRunAutoBackup } from './lib/backupManager';
import { getSession, getUserById, updateUserPreferences } from './lib/auth';
import { applyNightLight } from './lib/displayManager';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('socdof_language_initialized') !== 'true';
    } catch {
      return true;
    }
  });

  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('socdof_backup_setup_initialized') !== 'true';
    } catch {
      return true;
    }
  });

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMoves, setStockMoves] = useState<StockMove[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [posOrders, setPosOrders] = useState<POSOrder[]>([]);
  const [company, setCompany] = useState<CompanyProfile>(defaultCompanyProfile);
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);

  const applyThemeMode = useCallback((mode: CompanyProfile['theme_mode']) => {
    try {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const enableDark = mode === 'dark' || (mode !== 'light' && media.matches);
      setIsDark(enableDark);
      document.documentElement.classList.toggle('dark', enableDark);
      document.documentElement.style.colorScheme = enableDark ? 'dark' : 'light';
      if (mode === 'system') {
        localStorage.removeItem('odoo_theme_dark');
      } else {
        localStorage.setItem('odoo_theme_dark', String(enableDark));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem('odoo_view_mode');
      const savedMode = company?.theme_mode;
      const legacyTheme = localStorage.getItem('odoo_theme_dark');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const mode: CompanyProfile['theme_mode'] = savedMode || (legacyTheme !== null ? (legacyTheme === 'true' ? 'dark' : 'light') : 'system');
      applyThemeMode(mode);
    } catch {
      // ignore
    }
    setIsMuted(sounds.isMuted());
  }, [company?.theme_mode, applyThemeMode]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemTheme = () => {
      if ((company?.theme_mode || 'system') === 'system') {
        const enableDark = media.matches;
        setIsDark(enableDark);
        document.documentElement.classList.toggle('dark', enableDark);
        document.documentElement.style.colorScheme = enableDark ? 'dark' : 'light';
      }
    };
    media.addEventListener?.('change', handleSystemTheme);
    return () => media.removeEventListener?.('change', handleSystemTheme);
  }, [company?.theme_mode]);

  // Windows 11 Night Light (Nachtmodus) Synchronization
  useEffect(() => {
    if (company?.night_light_enabled) {
      applyNightLight(true, company.night_light_temperature || 3400);
    } else {
      applyNightLight(false);
    }
  }, [company?.night_light_enabled, company?.night_light_temperature]);

  const handleSetThemeMode = (mode: CompanyProfile['theme_mode']) => {
    const nextMode = mode || 'system';
    setCompany(prev => ({ ...prev, theme_mode: nextMode }));
    applyThemeMode(nextMode);
    void db.settings.put({ key: 'company_profile', value: { ...company, theme_mode: nextMode } });
    try {
      const session = getSession();
      if (session && !session.locked) {
        const user = getUserById(session.userId);
        if (user) {
          const media = window.matchMedia('(prefers-color-scheme: dark)');
          const enableDark = nextMode === 'dark' || (nextMode !== 'light' && media.matches);
          const userTheme = enableDark ? 'dark' : 'light';
          if (user.preferences.theme !== userTheme) {
            updateUserPreferences(user.id, { ...user.preferences, theme: userTheme });
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const handleToggleTheme = () => {
    const next = !isDark;
    handleSetThemeMode(next ? 'dark' : 'light');
  };

  const handleToggleSound = () => {
    const next = sounds.toggleMute();
    setIsMuted(next);
  };

  const refreshData = useCallback(async () => {
    try {
      const hasCleanedV3 = localStorage.getItem('odoo_cleaned_v3');
      const explicitDemo = localStorage.getItem('odoo_clean_mode') === 'false';
      if (!hasCleanedV3 && !explicitDemo) {
        localStorage.setItem('odoo_cleaned_v3', 'true');
        localStorage.setItem('odoo_clean_mode', 'true');
        await clearDatabaseToEmpty();
      } else {
        await seedInitialDataIfNeeded(explicitDemo);
      }

      const [cList, pList, smList, invList, poList, posList, settingRecord] = await Promise.all([
        db.contacts.toArray(),
        db.products.toArray(),
        db.stock_moves.toArray(),
        db.invoices.toArray(),
        db.purchase_orders.toArray(),
        db.pos_orders.toArray(),
        db.settings.get('company_profile')
      ]);

      setContacts(cList);
      setProducts(pList);
      setStockMoves(smList);
      setInvoices(invList);
      setPurchases(poList);
      setPosOrders(posList);

      if (settingRecord?.value) {
        const comp = settingRecord.value as CompanyProfile;
        setCompany(comp);
        if (comp.accent_color) applyAccentColor(comp.accent_color);

        const explicitSavedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('socdof_language') : null;
        if (explicitSavedLang && (explicitSavedLang === 'de' || explicitSavedLang === 'en' || explicitSavedLang === 'fr' || explicitSavedLang === 'es')) {
          setLanguage(explicitSavedLang as LanguageCode);
          if (comp.language !== explicitSavedLang) {
            comp.language = explicitSavedLang as LanguageCode;
            await db.settings.put({ key: 'company_profile', value: comp });
          }
        } else if (comp.language) {
          setLanguage(comp.language);
        } else {
          const current = getLanguage();
          setLanguage(current);
          comp.language = current;
          await db.settings.put({ key: 'company_profile', value: comp });
        }
        if (comp.font_scale) document.documentElement.style.fontSize = `${comp.font_scale}%`;
      } else {
        applyAccentColor('indigo');
        const current = getLanguage();
        setLanguage(current);
        document.documentElement.style.fontSize = '100%';
      }
    } catch (err) {
      console.error('Database load error:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (company?.accent_color) applyAccentColor(company.accent_color);
    if (company?.font_scale) document.documentElement.style.fontSize = `${company.font_scale}%`;
  }, [company?.accent_color, company?.font_scale]);

  useEffect(() => {
    checkAndRunAutoBackup(company);
    const intervalId = window.setInterval(() => checkAndRunAutoBackup(company), 60 * 1000);
    return () => clearInterval(intervalId);
  }, [company]);

  // In Electron, the updater asks the renderer to create a last-second
  // data snapshot before the installer replaces application files.
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onPrepareForUpdate || !api.reportUpdateBackupReady) return;

    const unsubscribe = api.onPrepareForUpdate(async ({ requestId }) => {
      try {
        const jsonStr = await exportDatabaseToJson({
          pretty: true,
          owner: company.backup_owner || company.name || 'Administrator',
          folder: company.backup_folder_path || ''
        });

        const localStorageState: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('socdof.') || key.startsWith('socdof_') || key.startsWith('odoo_')) {
            const value = localStorage.getItem(key);
            if (value !== null) localStorageState[key] = value;
          }
        }

        const platformInfo = await api.getPlatformInfo();
        const snapshot = JSON.stringify({
          format: 'SOCDOF_PRE_UPDATE_BACKUP',
          createdAt: new Date().toISOString(),
          appVersion: platformInfo.version,
          database: JSON.parse(jsonStr),
          localStorage: localStorageState
        }, null, 2);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = (company.name || 'SOCDOF').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = safeName + '_PreUpdate_' + timestamp + '.socdof.json';

        let saveResult = await api.saveBackupFileToDisk?.({
          folderPath: company.backup_folder_path,
          fileName,
          content: snapshot
        });

        if (!saveResult?.success && api.getBackupFolderPath) {
          const folders = await api.getBackupFolderPath();
          saveResult = await api.saveBackupFileToDisk?.({
            folderPath: folders.backupDir,
            fileName,
            content: snapshot
          });
        }

        if (!saveResult?.success) {
          throw new Error(saveResult?.error || 'Pre-update backup could not be written.');
        }

        api.reportUpdateBackupReady(requestId, {
          success: true,
          backupPath: saveResult.fullPath
        });
      } catch (error) {
        api.reportUpdateBackupReady(requestId, {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    return unsubscribe;
  }, [company]);

  const handleToggleCleanMode = async (enableClean: boolean) => {
    try {
      if (enableClean) {
        localStorage.setItem('odoo_clean_mode', 'true');
        await clearDatabaseToEmpty();
        sounds.playSuccess();
        await refreshData();
      } else {
        localStorage.setItem('odoo_clean_mode', 'false');
        await resetDatabaseToDemo();
        sounds.playSuccess();
        await refreshData();
      }
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleUpdateCompany = async (updated: CompanyProfile) => {
    setCompany(updated);
    try {
      await db.settings.put({ key: 'company_profile', value: updated });
      if (updated.language) setLanguage(updated.language);
      if (updated.accent_color) applyAccentColor(updated.accent_color);
      if (updated.font_scale) document.documentElement.style.fontSize = `${updated.font_scale}%`;
      if (updated.theme_mode) {
        applyThemeMode(updated.theme_mode);
        const session = getSession();
        if (session && !session.locked) {
          const user = getUserById(session.userId);
          if (user) {
            const media = window.matchMedia('(prefers-color-scheme: dark)');
            const enableDark = updated.theme_mode === 'dark' || (updated.theme_mode !== 'light' && media.matches);
            const userTheme = enableDark ? 'dark' : 'light';
            if (user.preferences.theme !== userTheme) {
              updateUserPreferences(user.id, { ...user.preferences, theme: userTheme });
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to persist company profile:', err);
    }
  };

  return (
    <AuthGate company={company}>
      <AccountScopedWorkspace>
        <div className="w-screen h-screen overflow-hidden font-sans">
          <DesktopWindowWorkspace
            contacts={contacts}
            products={products}
            stockMoves={stockMoves}
            invoices={invoices}
            purchases={purchases}
            posOrders={posOrders}
            company={company}
            onRefreshData={refreshData}
            onUpdateCompany={handleUpdateCompany}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
            onSetThemeMode={handleSetThemeMode}
            isMuted={isMuted}
            onToggleSound={handleToggleSound}
            onOpenStudio={() => setIsStudioOpen(true)}
          />

          <StudioDrawer
            isOpen={isStudioOpen}
            onClose={() => setIsStudioOpen(false)}
            company={company}
            onSaveCompany={(updated) => setCompany(updated)}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
            isMuted={isMuted}
            onToggleSound={handleToggleSound}
            onClearDatabase={() => handleToggleCleanMode(true)}
            onLoadDemoData={() => handleToggleCleanMode(false)}
            recordCounts={{
              contacts: contacts.length,
              products: products.length,
              invoices: invoices.length,
              purchases: purchases.length,
              posOrders: posOrders.length,
              stockMoves: stockMoves.length
            }}
          />

          <LanguageSelectionModal
            isOpen={isLanguageModalOpen}
            onClose={() => setIsLanguageModalOpen(false)}
            currentLanguage={getLanguage()}
            onSelectLanguage={(lang) => {
              setLanguage(lang);
              handleUpdateCompany({ ...company, language: lang });
            }}
          />

          <BackupSetupModal
            isOpen={isBackupModalOpen && !isLanguageModalOpen}
            onClose={() => setIsBackupModalOpen(false)}
            company={company}
            onUpdateCompany={handleUpdateCompany}
          />
        </div>
      </AccountScopedWorkspace>
    </AuthGate>
  );
}
