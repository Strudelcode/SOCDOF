import React, { useState, useEffect, useCallback } from 'react';
import { 
  ActiveModule, 
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
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './components/Dashboard';
import { ContactsModule } from './components/ContactsModule';
import { ProductsModule } from './components/ProductsModule';
import { StockMovesModule } from './components/StockMovesModule';
import { InvoicesModule } from './components/InvoicesModule';
import { POSModule } from './components/POSModule';
import { PurchasesModule } from './components/PurchasesModule';
import { SettingsModule } from './components/SettingsModule';
import { AccountingModule } from './components/AccountingModule';
import { RestaurantModule } from './components/RestaurantModule';
import { IOSBillingModule } from './components/IOSBillingModule';
import { AppStoreModule } from './components/AppStoreModule';
import { DocumentationApp } from './components/DocumentationApp';
import { AppLauncher } from './components/AppLauncher';
import { StudioDrawer } from './components/StudioDrawer';
import { CommandPalette } from './components/CommandPalette';
import { DesktopWindowWorkspace } from './components/DesktopWindowWorkspace';

export default function App() {
  // App view mode: 'windows_os' (Windows desktop with draggable windows) or 'web' (classic Odoo web full screen)
  const [viewMode, setViewMode] = useState<'windows_os' | 'web'>('windows_os');
  
  // Default startup view: launcher (or restored from session)
  const [activeModule, setActiveModule] = useState<ActiveModule>('launcher');
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCleanMode, setIsCleanMode] = useState<boolean>(true);

  // Data states
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMoves, setStockMoves] = useState<StockMove[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [posOrders, setPosOrders] = useState<POSOrder[]>([]);
  const [company, setCompany] = useState<CompanyProfile>(defaultCompanyProfile);

  // Modals / Drawers State
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isInvoiceCreateOpen, setIsInvoiceCreateOpen] = useState<boolean>(false);
  const [invoicePreselectedContactId, setInvoicePreselectedContactId] = useState<number | undefined>();
  const [isStockTransferOpen, setIsStockTransferOpen] = useState<boolean>(false);
  const [stockPreselectedProductId, setStockPreselectedProductId] = useState<number | undefined>();

  // Dark Mode & View Mode initialization
  useEffect(() => {
    try {
      const savedView = localStorage.getItem('odoo_view_mode');
      if (savedView === 'web' || savedView === 'windows_os') {
        setViewMode(savedView);
      }

      const savedTheme = localStorage.getItem('odoo_theme_dark');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const enableDark = savedTheme !== null ? savedTheme === 'true' : prefersDark;
      setIsDark(enableDark);
      if (enableDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      const cleanFlag = localStorage.getItem('odoo_clean_mode');
      setIsCleanMode(cleanFlag !== 'false');
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

  const handleSetViewMode = (mode: 'windows_os' | 'web') => {
    sounds.playClick();
    setViewMode(mode);
    try {
      localStorage.setItem('odoo_view_mode', mode);
    } catch {
      // ignore
    }
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
        setCompany(settingRecord.value as CompanyProfile);
      }
    } catch (err) {
      console.error('Database load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Clean Mode Toggle Handler
  const handleToggleCleanMode = async (enableClean: boolean) => {
    try {
      if (enableClean) {
        localStorage.setItem('odoo_clean_mode', 'true');
        setIsCleanMode(true);
        await clearDatabaseToEmpty();
        sounds.playSuccess();
        await refreshData();
      } else {
        localStorage.setItem('odoo_clean_mode', 'false');
        setIsCleanMode(false);
        await resetDatabaseToDemo();
        sounds.playSuccess();
        await refreshData();
      }
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  // Derived counts for badges
  const lowStockCount = products.filter(p => (p.qty_available || 0) < (p.min_qty ?? 5)).length;
  const openInvoicesCount = invoices.filter(i => i.status === 'posted').length;
  const totalRecordsCount = contacts.length + products.length + invoices.length + purchases.length + posOrders.length + stockMoves.length;

  const handleQuickAction = (action: 'new_invoice' | 'new_contact' | 'new_product' | 'new_stock_move' | 'new_purchase') => {
    if (action === 'new_invoice') {
      setActiveModule('invoices');
      setInvoicePreselectedContactId(undefined);
      setIsInvoiceCreateOpen(true);
    } else if (action === 'new_contact') {
      setActiveModule('contacts');
    } else if (action === 'new_product') {
      setActiveModule('products');
    } else if (action === 'new_purchase') {
      setActiveModule('purchases');
    } else if (action === 'new_stock_move') {
      setActiveModule('stock');
      setStockPreselectedProductId(undefined);
      setIsStockTransferOpen(true);
    }
  };

  const handleCreateInvoiceForContact = (contact: Contact) => {
    setActiveModule('invoices');
    setInvoicePreselectedContactId(contact.id);
    setIsInvoiceCreateOpen(true);
  };

  const handleOpenStockTransferForProduct = (productId?: number) => {
    setActiveModule('stock');
    setStockPreselectedProductId(productId);
    setIsStockTransferOpen(true);
  };

  // 1. WINDOWS OPERATING SYSTEM DESKTOP VIEW
  if (viewMode === 'windows_os') {
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
          onSwitchToWebMode={() => handleSetViewMode('web')}
          onOpenStudio={() => setIsStudioOpen(true)}
        />

        {/* Studio Drawer in Windows OS Mode */}
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
      </div>
    );
  }

  // 2. CLASSIC ODOO WEB FULLSCREEN VIEW
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased overflow-hidden font-sans transition-colors duration-300">
      {/* Sleek Odoo-style Sidebar (Hidden on launcher) */}
      {activeModule !== 'launcher' && (
        <Sidebar
          activeModule={activeModule}
          onSelectModule={(mod) => {
            setActiveModule(mod);
            setSearchQuery('');
          }}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          isMuted={isMuted}
          onToggleSound={handleToggleSound}
          lowStockCount={lowStockCount}
          openInvoicesCount={openInvoicesCount}
          isCleanMode={isCleanMode}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Sticky Top Header (Hidden on launcher) */}
        {activeModule !== 'launcher' && (
          <TopBar
            activeModule={activeModule}
            onSelectModule={setActiveModule}
            onQuickAction={handleQuickAction}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isCleanMode={isCleanMode}
            onToggleCleanMode={handleToggleCleanMode}
            company={company}
            onOpenStudio={() => setIsStudioOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
            isMuted={isMuted}
            onToggleSound={handleToggleSound}
            totalRecordsCount={totalRecordsCount}
          />
        )}

        {/* Top bar Switch to Windows Mode Helper */}
        <div className="no-print bg-indigo-900/90 text-indigo-100 px-4 py-1.5 text-xs flex items-center justify-between border-b border-indigo-700/50">
          <span className="flex items-center gap-1.5 font-medium">
            💡 <strong>Windows OS Modus:</strong> Sie können jederzeit zur Desktop-Fensteransicht mit Desktop-Icons und ziehbaren Fenstern wechseln.
          </span>
          <button
            onClick={() => handleSetViewMode('windows_os')}
            className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md shadow-xs transition"
          >
            Windows Desktop öffnen
          </button>
        </div>

        {/* Dynamic Module Body */}
        <main className={`flex-1 ${activeModule === 'launcher' ? 'p-0' : 'p-6 md:p-8'} max-w-7xl w-full mx-auto`}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Lade lokale Odoo ERP Datenbank...</p>
            </div>
          ) : (
            <>
              {activeModule === 'launcher' && (
                <AppLauncher
                  onSelectModule={(mod) => {
                    setActiveModule(mod);
                  }}
                  contactCount={contacts.length}
                  productCount={products.length}
                  invoiceCount={invoices.length}
                  stockMoveCount={stockMoves.length}
                  lowStockCount={lowStockCount}
                  isCleanMode={isCleanMode}
                  onToggleCleanMode={handleToggleCleanMode}
                  companyName={company.name}
                />
              )}

              {activeModule === 'dashboard' && (
                <Dashboard
                  invoices={invoices}
                  products={products}
                  stockMoves={stockMoves}
                  contacts={contacts}
                  purchases={purchases}
                  posOrders={posOrders}
                  onNavigate={setActiveModule}
                  onOpenNewInvoice={() => {
                    setActiveModule('invoices');
                    setIsInvoiceCreateOpen(true);
                  }}
                  onOpenNewContact={() => setActiveModule('contacts')}
                  onOpenStockTransfer={(pId) => handleOpenStockTransferForProduct(pId)}
                  currency={company.currency}
                />
              )}

              {activeModule === 'contacts' && (
                <ContactsModule
                  contacts={contacts}
                  invoices={invoices}
                  onRefresh={refreshData}
                  onCreateInvoiceForContact={handleCreateInvoiceForContact}
                  currency={company.currency}
                />
              )}

              {activeModule === 'products' && (
                <ProductsModule
                  products={products}
                  onRefresh={refreshData}
                  onOpenStockTransfer={(pId) => handleOpenStockTransferForProduct(pId)}
                  currency={company.currency}
                />
              )}

              {activeModule === 'stock' && (
                <StockMovesModule
                  stockMoves={stockMoves}
                  products={products}
                  onRefresh={refreshData}
                  isTransferModalOpen={isStockTransferOpen}
                  preselectedProductId={stockPreselectedProductId}
                  onCloseTransferModal={() => setIsStockTransferOpen(false)}
                  onOpenTransferModal={(pId) => {
                    setStockPreselectedProductId(pId);
                    setIsStockTransferOpen(true);
                  }}
                />
              )}

              {activeModule === 'invoices' && (
                <InvoicesModule
                  invoices={invoices}
                  contacts={contacts}
                  products={products}
                  company={company}
                  onRefresh={refreshData}
                  isCreateOpen={isInvoiceCreateOpen}
                  preselectedContactId={invoicePreselectedContactId}
                  onCloseCreate={() => {
                    setIsInvoiceCreateOpen(false);
                    setInvoicePreselectedContactId(undefined);
                  }}
                  onOpenCreate={(contactId) => {
                    setInvoicePreselectedContactId(contactId);
                    setIsInvoiceCreateOpen(true);
                  }}
                />
              )}

              {activeModule === 'accounting' && (
                <AccountingModule
                  invoices={invoices}
                  purchases={purchases}
                  posOrders={posOrders}
                  company={company}
                />
              )}

              {activeModule === 'docs' && (
                <DocumentationApp />
              )}

              {activeModule === 'pos' && (
                <POSModule
                  products={products}
                  contacts={contacts}
                  companyProfile={company}
                  onRefreshData={refreshData}
                />
              )}

              {activeModule === 'restaurant' && (
                <RestaurantModule
                  companyProfile={company}
                  onRefreshData={refreshData}
                />
              )}

              {activeModule === 'ios_billing' && (
                <IOSBillingModule
                  companyProfile={company}
                />
              )}

              {activeModule === 'purchases' && (
                <PurchasesModule
                  purchases={purchases}
                  contacts={contacts}
                  products={products}
                  companyProfile={company}
                  onRefreshData={refreshData}
                />
              )}

              {activeModule === 'settings' && (
                <SettingsModule
                  company={company}
                  onUpdateCompany={setCompany}
                  onFullReset={refreshData}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Odoo Studio Customizer Drawer */}
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

      {/* Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectModule={(mod) => {
          setActiveModule(mod);
          setIsCommandPaletteOpen(false);
        }}
        onQuickAction={handleQuickAction}
        onOpenStudio={() => setIsStudioOpen(true)}
        onToggleTheme={handleToggleTheme}
        isDark={isDark}
        contacts={contacts}
        products={products}
        invoices={invoices}
      />
    </div>
  );
}
