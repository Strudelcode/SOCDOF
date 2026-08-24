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
  resetDatabaseToDemo
} from './lib/db';
import { sounds } from './lib/sound';
import { StudioDrawer } from './components/StudioDrawer';
import { DesktopWindowWorkspace } from './components/DesktopWindowWorkspace';
import { LanguageSelectionModal } from './components/LanguageSelectionModal';
import { applyAccentColor } from './lib/accent';
import { getLanguage, setLanguage } from './lib/i18n';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  // Language Selection Modal on Startup
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('socdof_language_initialized') !== 'true';
    } catch {
      return true;
    }
  });

  // Data states
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMoves, setStockMoves] = useState<StockMove[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [posOrders, setPosOrders] = useState<POSOrder[]>([]);
  const [company, setCompany] = useState<CompanyProfile>(defaultCompanyProfile);

  // Studio Drawer State
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);

  // Dark Mode initialization
  useEffect(() => {
    try {
      // Clean up legacy web view mode preference
      localStorage.removeItem('odoo_view_mode');

      const savedTheme = localStorage.getItem('odoo_theme_dark');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const enableDark = savedTheme !== null ? savedTheme === 'true' : prefersDark;
      setIsDark(enableDark);
      if (enableDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore
    }

    setIsMuted(sounds.isMuted());
  }, []);

  const handleToggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    try {
      localStorage.setItem('odoo_theme_dark', String(next));
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore
    }
  };

  const handleToggleSound = () => {
    const next = sounds.toggleMute();
    setIsMuted(next);
  };

  // Load all records from IndexedDB
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
        if (comp.accent_color) {
          applyAccentColor(comp.accent_color);
        }
        if (comp.language) {
          setLanguage(comp.language);
        }
      } else {
        applyAccentColor('indigo');
        setLanguage('en');
      }
    } catch (err) {
      console.error('Database load error:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (company?.accent_color) {
      applyAccentColor(company.accent_color);
    }
  }, [company?.accent_color]);

  // Clean Mode Toggle Handler for Studio Drawer
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

  return (
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
        onUpdateCompany={(c) => setCompany(c)}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        onOpenStudio={() => setIsStudioOpen(true)}
      />

      {/* Studio Drawer in Windows OS Workspace */}
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

      {/* Startup / Global Language Selection Modal */}
      <LanguageSelectionModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        currentLanguage={getLanguage()}
        onSelectLanguage={(lang) => {
          setLanguage(lang);
          setCompany(prev => ({ ...prev, language: lang }));
        }}
      />
    </div>
  );
}
