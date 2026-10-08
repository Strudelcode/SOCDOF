import React, { useState, useMemo } from 'react';
import { 
  CreditCard, 
  Search, 
  Plus, 
  Printer, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Trash2, 
  Edit2, 
  FileText, 
  Download, 
  Sparkles, 
  Building2,
  Users,
  Send,
  BookUser,
  FileSpreadsheet,
  LayoutGrid,
  List,
  RefreshCw,
  CheckCheck,
  Zap,
  ExternalLink,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import { BillingItem, Client, Session } from './types';
import { CompanyProfile } from '../../types';
import { useLanguage, t } from '../../lib/i18n';
import { db } from '../../lib/db';
import { formatCurrencyDE, formatIntegerDE } from '../../lib/formatters';
import { TherapyInvoicePrintModal } from './TherapyInvoicePrintModal';
import { TherapyTaxAdvisorLedgerModal } from './TherapyTaxAdvisorLedgerModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { TherapyClientFilterModal } from './TherapyClientFilterModal';
import { 
  syncAllPracticeBilling, 
  syncBillingItemToDb, 
  isAutoSyncEnabled, 
  setAutoSyncEnabled 
} from './therapyInvoiceSync';

interface TherapyBillingProps {
  billing: BillingItem[];
  clients: Client[];
  sessions: Session[];
  company?: CompanyProfile;
  currency: string;
  onSaveBilling: (item: BillingItem) => void;
  onSaveBatchBilling?: (items: BillingItem[]) => void;
  onDeleteBilling: (id: string) => void;
  onOpenCustomerPicker: () => void;
  onShowToast: (msg: string) => void;
  onOpenInvoices?: () => void;
}

export const TherapyBilling: React.FC<TherapyBillingProps> = ({
  billing,
  clients,
  sessions,
  company,
  currency,
  onSaveBilling,
  onSaveBatchBilling,
  onDeleteBilling,
  onOpenCustomerPicker,
  onShowToast,
  onOpenInvoices
}) => {
  const lang = useLanguage();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'paid'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    try {
      const saved = localStorage.getItem('socdof_therapy_billing_view');
      return (saved === 'cards' || saved === 'table') ? saved : 'table';
    } catch {
      return 'table';
    }
  });

  const handleSetViewMode = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    try {
      localStorage.setItem('socdof_therapy_billing_view', mode);
    } catch {}
  };
  
  // Modal & Selection states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BillingItem | null>(null);
  const [printPreviewItem, setPrintPreviewItem] = useState<BillingItem | null>(null);
  const [isTaxAdvisorLedgerOpen, setIsTaxAdvisorLedgerOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<BillingItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isAutoSyncOn, setIsAutoSyncOn] = useState<boolean>(isAutoSyncEnabled);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClientFilterModalOpen, setIsClientFilterModalOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

  const activeClient = useMemo(() => clients.find(c => c.id === clientFilter), [clients, clientFilter]);

  // Sync metrics & summary
  const syncStats = useMemo(() => {
    const synced = billing.filter(b => b.syncedToInvoices || Boolean(b.invoiceNumber && b.invoiceNumber.trim().length > 0));
    return {
      syncedCount: synced.length,
      pendingCount: Math.max(0, billing.length - synced.length),
      allSynced: billing.length > 0 && synced.length === billing.length
    };
  }, [billing]);

  const handleToggleAutoSync = () => {
    const nextVal = !isAutoSyncOn;
    setIsAutoSyncOn(nextVal);
    setAutoSyncEnabled(nextVal);
    if (nextVal) {
      handleSyncAll();
    } else {
      onShowToast(t('therapy.sync_status_inactive', lang, 'Auto-Sync pausiert'));
    }
  };

  const handleSyncAll = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncAllPracticeBilling(billing, clients);
      if (onSaveBatchBilling) {
        onSaveBatchBilling(res.updatedBilling);
      } else {
        res.updatedBilling.forEach(b => onSaveBilling(b));
      }
      onShowToast(
        lang === 'de'
          ? `Mit Rechnungs-App synchronisiert: ${res.syncedCount} Rechnungen (${res.newCount} neu, ${res.statusUpdatedCount} bezahlt)`
          : `Synced with Invoices app: ${res.syncedCount} invoices (${res.newCount} new, ${res.statusUpdatedCount} paid)`
      );
    } catch (err) {
      console.error('Error in handleSyncAll:', err);
      onShowToast(lang === 'de' ? 'Fehler beim Synchronisieren' : 'Sync error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSingleSync = async (item: BillingItem) => {
    try {
      const client = getClient(item.clientId);
      const res = await syncBillingItemToDb(item, client);
      onSaveBilling(res.updatedItem);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('socdof:invoices-changed'));
        window.dispatchEvent(new CustomEvent('socdof:contacts-changed'));
      }
      onShowToast(
        lang === 'de'
          ? `Rechnung ${res.updatedItem.invoiceNumber} erfolgreich synchronisiert!`
          : `Invoice ${res.updatedItem.invoiceNumber} successfully synced!`
      );
    } catch (err) {
      console.error('Error syncing single item:', err);
      onShowToast(lang === 'de' ? 'Fehler beim Synchronisieren' : 'Sync error');
    }
  };

  // Filtered billing entries
  const filteredBilling = useMemo(() => {
    return billing.filter(item => {
      const client = clients.find(c => c.id === item.clientId);
      const clientName = client ? client.name.toLowerCase() : '';
      const q = search.toLowerCase().trim();

      const matchesSearch = !q || 
        (item.service && item.service.toLowerCase().includes(q)) ||
        (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q)) ||
        clientName.includes(q);

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'paid' && item.status === 'paid') ||
        (statusFilter === 'open' && item.status !== 'paid');

      const matchesClient = clientFilter === 'all' || item.clientId === clientFilter;

      return matchesSearch && matchesStatus && matchesClient;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [billing, clients, search, statusFilter, clientFilter]);

  // Selection handlers
  const isAllSelected = useMemo(() => {
    return filteredBilling.length > 0 && filteredBilling.every(b => selectedIds.has(b.id));
  }, [filteredBilling, selectedIds]);

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBilling.map(b => b.id)));
    }
  };

  const handleBatchMarkPaid = () => {
    const itemsToUpdate = billing.filter(b => selectedIds.has(b.id));
    const updated = itemsToUpdate.map(item => ({ ...item, status: 'paid' as const }));
    if (onSaveBatchBilling) {
      onSaveBatchBilling(updated);
    } else {
      updated.forEach(item => onSaveBilling(item));
    }
    onShowToast(
      lang === 'de'
        ? `${itemsToUpdate.length} Rechnungen als bezahlt markiert!`
        : `${itemsToUpdate.length} invoices marked as paid!`
    );
    setSelectedIds(new Set());
  };

  const handleBatchMarkOpen = () => {
    const itemsToUpdate = billing.filter(b => selectedIds.has(b.id));
    const updated = itemsToUpdate.map(item => ({ ...item, status: 'ready' as const }));
    if (onSaveBatchBilling) {
      onSaveBatchBilling(updated);
    } else {
      updated.forEach(item => onSaveBilling(item));
    }
    onShowToast(
      lang === 'de'
        ? `${itemsToUpdate.length} Rechnungen als offen markiert!`
        : `${itemsToUpdate.length} invoices marked as open!`
    );
    setSelectedIds(new Set());
  };

  // Helper to ensure client has a corresponding contact in db.contacts
  const resolveContactInfo = async (client?: Client) => {
    if (!client) {
      return { contactId: 0, contactName: 'Klient', contactEmail: '', contactAddress: '' };
    }
    const cId = client.contactId ? Number(client.contactId) : 0;
    if (cId > 0) {
      try {
        const existing = await db.contacts.get(cId);
        if (existing) {
          const addr = [existing.street, existing.zip, existing.city].filter(Boolean).join(', ');
          return {
            contactId: cId,
            contactName: existing.name || client.name,
            contactEmail: existing.email || client.email || '',
            contactAddress: addr || (client.address ? `${client.address}, ${client.zip || ''} ${client.city || ''}`.trim() : '')
          };
        }
      } catch {}
    }

    try {
      const allContacts = await db.contacts.toArray();
      const byName = allContacts.find(c => c.name && client.name && c.name.trim().toLowerCase() === client.name.trim().toLowerCase());
      if (byName && byName.id) {
        const addr = [byName.street, byName.zip, byName.city].filter(Boolean).join(', ');
        return {
          contactId: byName.id,
          contactName: byName.name,
          contactEmail: byName.email || client.email || '',
          contactAddress: addr || (client.address ? `${client.address}, ${client.zip || ''} ${client.city || ''}`.trim() : '')
        };
      }

      // Create new contact in CRM
      const newId = await db.contacts.add({
        name: client.name || 'Klient',
        email: client.email || '',
        phone: client.phone || '',
        company: '',
        street: client.address || '',
        zip: client.zip || '',
        city: client.city || '',
        type: 'customer',
        createdAt: new Date().toISOString()
      });

      return {
        contactId: Number(newId),
        contactName: client.name || 'Klient',
        contactEmail: client.email || '',
        contactAddress: client.address ? `${client.address}, ${client.zip || ''} ${client.city || ''}`.trim() : ''
      };
    } catch (e) {
      console.error('Error resolving contact info for invoice:', e);
      return {
        contactId: 0,
        contactName: client.name || 'Klient',
        contactEmail: client.email || '',
        contactAddress: client.address ? `${client.address}, ${client.zip || ''} ${client.city || ''}`.trim() : ''
      };
    }
  };

  const handleBatchTransferToInvoices = async () => {
    const itemsToTransfer = billing.filter(b => selectedIds.has(b.id));
    if (itemsToTransfer.length === 0) return;

    let count = 0;
    const updatedBillingItems: BillingItem[] = [];

    for (const item of itemsToTransfer) {
      try {
        const client = getClient(item.clientId);
        const contactInfo = await resolveContactInfo(client);
        const amount = Number(item.amount) || 0;
        const taxRate = item.taxRate || 0;
        const taxAmount = (amount * taxRate) / 100;
        const total = amount + taxAmount;
        const invoiceNumber = item.invoiceNumber || `PRAXIS-${Date.now().toString().slice(-6)}-${count + 1}`;

        const invRecord = {
          contact_id: contactInfo.contactId,
          contact_name: contactInfo.contactName,
          contact_email: contactInfo.contactEmail,
          contact_address: contactInfo.contactAddress,
          number: invoiceNumber,
          type: 'out_invoice' as const,
          status: item.status === 'paid' ? 'paid' as const : 'posted' as const,
          date: item.date || new Date().toISOString().slice(0, 10),
          due_date: item.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          subtotal: amount,
          tax_total: taxAmount,
          total: total,
          paid_at: item.status === 'paid' ? (item.date || new Date().toISOString().slice(0, 10)) : undefined,
          payment_method: item.paymentMethod === 'bank' ? 'transfer' as const : item.paymentMethod === 'cash' ? 'cash' as const : undefined,
          payment_terms: 'Zahlbar innerhalb von 14 Tagen nach Rechnungsstellung ohne Abzug.',
          items: [
            {
              id: `item_${Date.now()}_${count}`,
              product_id: 0,
              product_name: item.service || 'Therapieleistung / Beratung',
              sku: 'THERAPY-01',
              qty: 1,
              unit_price: amount,
              tax_rate: taxRate,
              discount: 0,
              subtotal: amount
            }
          ],
          notes: item.notes || 'Erstellt aus Praxis-Modul (Heilbehandlung / Psychotherapie)'
        };

        const existingInv = await db.invoices.where('number').equals(invoiceNumber).first();
        if (existingInv && existingInv.id) {
          await db.invoices.update(existingInv.id, invRecord);
        } else {
          await db.invoices.add(invRecord);
        }

        updatedBillingItems.push({
          ...item,
          invoiceNumber,
          status: item.status === 'paid' ? 'paid' : 'invoiced'
        });
        count++;
      } catch (err) {
        console.error('Batch transfer error:', err);
      }
    }

    if (onSaveBatchBilling) {
      onSaveBatchBilling(updatedBillingItems);
    } else {
      updatedBillingItems.forEach(item => onSaveBilling(item));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socdof:invoices-changed'));
      window.dispatchEvent(new CustomEvent('socdof:contacts-changed'));
    }

    onShowToast(
      lang === 'de'
        ? `${count} Rechnungen erfolgreich in die Rechnungs-App übertragen!`
        : `${count} invoices successfully transferred to Invoices app!`
    );
    setSelectedIds(new Set());
    if (onOpenInvoices) {
      onOpenInvoices();
    }
  };

  const handleBatchDelete = () => {
    const idsToDelete = Array.from(selectedIds);
    idsToDelete.forEach(id => onDeleteBilling(id));
    onShowToast(
      lang === 'de'
        ? `${idsToDelete.length} Rechnungen gelöscht.`
        : `${idsToDelete.length} invoices deleted.`
    );
    setSelectedIds(new Set());
    setIsBatchDeleteModalOpen(false);
  };

  // Statistics
  const totalAmount = useMemo(() => {
    return billing.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [billing]);

  const totalPaid = useMemo(() => {
    return billing.filter(b => b.status === 'paid').reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [billing]);

  const totalOpen = useMemo(() => {
    return billing.filter(b => b.status !== 'paid').reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [billing]);

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  // Transfer single billing item to SOCDOF Invoices Database (db.invoices)
  const handleTransferToInvoicesApp = async (item: BillingItem) => {
    try {
      const client = getClient(item.clientId);
      const contactInfo = await resolveContactInfo(client);
      const amount = Number(item.amount) || 0;
      const taxRate = item.taxRate || 0;
      const taxAmount = (amount * taxRate) / 100;
      const total = amount + taxAmount;
      const invoiceNumber = item.invoiceNumber || `PRAXIS-${Date.now().toString().slice(-6)}`;

      const invRecord = {
        contact_id: contactInfo.contactId,
        contact_name: contactInfo.contactName,
        contact_email: contactInfo.contactEmail,
        contact_address: contactInfo.contactAddress,
        number: invoiceNumber,
        type: 'out_invoice' as const,
        status: item.status === 'paid' ? 'paid' as const : 'posted' as const,
        date: item.date || new Date().toISOString().slice(0, 10),
        due_date: item.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        subtotal: amount,
        tax_total: taxAmount,
        total: total,
        paid_at: item.status === 'paid' ? (item.date || new Date().toISOString().slice(0, 10)) : undefined,
        payment_method: item.paymentMethod === 'bank' ? 'transfer' as const : item.paymentMethod === 'cash' ? 'cash' as const : undefined,
        payment_terms: 'Zahlbar innerhalb von 14 Tagen nach Rechnungsstellung ohne Abzug.',
        items: [
          {
            id: `item_${Date.now()}`,
            product_id: 0,
            product_name: item.service || 'Therapieleistung / Beratung',
            sku: 'THERAPY-01',
            qty: 1,
            unit_price: amount,
            tax_rate: taxRate,
            discount: 0,
            subtotal: amount
          }
        ],
        notes: item.notes || 'Erstellt aus Praxis-Modul (Heilbehandlung / Psychotherapie)'
      };

      const existingInv = await db.invoices.where('number').equals(invoiceNumber).first();
      if (existingInv && existingInv.id) {
        await db.invoices.update(existingInv.id, invRecord);
      } else {
        await db.invoices.add(invRecord);
      }

      // Update local item status to invoiced if not already
      onSaveBilling({
        ...item,
        invoiceNumber,
        status: item.status === 'paid' ? 'paid' : 'invoiced'
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('socdof:invoices-changed'));
        window.dispatchEvent(new CustomEvent('socdof:contacts-changed'));
      }

      onShowToast(
        lang === 'de' 
          ? `Rechnung ${invoiceNumber} in Rechnungs-App übertragen und geöffnet!` 
          : `Invoice ${invoiceNumber} transferred & opened in Invoices module!`
      );

      // Open the Invoices app window
      if (onOpenInvoices) {
        onOpenInvoices();
      }
    } catch (err) {
      console.error('Failed to create invoice in DB:', err);
      onShowToast(lang === 'de' ? 'Fehler beim Übertragen der Rechnung' : 'Error transferring invoice');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Financial Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
            {lang === 'de' ? 'Offene Forderungen' : 'Pending Receivables'}
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCurrencyDE(totalOpen, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {formatIntegerDE(billing.filter(b => b.status !== 'paid').length)} {lang === 'de' ? 'offene Rechnungen' : 'open invoices'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
            {lang === 'de' ? 'Bereits bezahlt' : 'Total Paid'}
          </div>
          <div 
            style={{ color: 'var(--accent-companion, #0d9488)' }}
            className="text-2xl font-bold"
          >
            {formatCurrencyDE(totalPaid, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {formatIntegerDE(billing.filter(b => b.status === 'paid').length)} {lang === 'de' ? 'beglichene Rechnungen' : 'paid invoices'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
            {lang === 'de' ? 'Gesamtes Abrechnungsvolumen' : 'Total Billed Volume'}
          </div>
          <div 
            style={{ color: 'var(--accent, #4f46e5)' }}
            className="text-2xl font-bold text-slate-900 dark:text-white"
          >
            {formatCurrencyDE(totalAmount, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {formatIntegerDE(billing.length)} {lang === 'de' ? 'Abrechnungspositionen gesamt' : 'total billing items'}
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search input */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'de' ? 'Rechnung, Klient, Leistung suchen...' : 'Search invoices, client, service...'}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lang === 'de' ? 'Alle' : 'All'}
            </button>
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'open' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lang === 'de' ? 'Offen' : 'Open'}
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                statusFilter === 'paid' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lang === 'de' ? 'Bezahlt' : 'Paid'}
            </button>
          </div>

          {/* Client Filter Popout Trigger */}
          {clientFilter === 'all' ? (
            <button
              type="button"
              onClick={() => setIsClientFilterModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title={lang === 'de' ? 'Klienten suchen & filtern' : 'Search & filter clients'}
            >
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{lang === 'de' ? 'Alle Klienten' : 'All Clients'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 font-bold text-slate-600 dark:text-slate-300">
                {clients.length}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <button
                type="button"
                onClick={() => setIsClientFilterModalOpen(true)}
                className="hover:underline cursor-pointer max-w-[130px] sm:max-w-[170px] truncate font-bold text-left"
                title={activeClient?.name}
              >
                {activeClient?.name || (lang === 'de' ? 'Klient' : 'Client')}
              </button>
              <button
                type="button"
                onClick={() => setClientFilter('all')}
                className="p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-900 rounded-md text-blue-500 hover:text-rose-600 transition cursor-pointer ml-0.5"
                title={lang === 'de' ? 'Filter aufheben' : 'Clear filter'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Action buttons & View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode dropdown: "Ansicht" */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-200/80 dark:border-slate-700"
              title={lang === 'de' ? 'Ansicht auswählen' : 'Select view'}
            >
              {viewMode === 'table' ? (
                <List className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ) : (
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              )}
              <span className="text-slate-400 font-normal">
                {lang === 'de' ? 'Ansicht:' : lang === 'fr' ? 'Vue :' : lang === 'es' ? 'Vista:' : 'View:'}
              </span>
              <span className="font-bold">
                {viewMode === 'table' 
                  ? (lang === 'de' ? 'Tabelle' : lang === 'fr' ? 'Tableau' : lang === 'es' ? 'Tabla' : 'Table') 
                  : (lang === 'de' ? 'Kästchen' : lang === 'fr' ? 'Cartes' : lang === 'es' ? 'Tarjetas' : 'Cards')}
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isViewMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isViewMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsViewMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 animate-scale-up">
                  <button
                    type="button"
                    onClick={() => { handleSetViewMode('table'); setIsViewMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                      viewMode === 'table' 
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold' 
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <List className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>{t('therapy.tableView', lang, 'Tabellen-Ansicht')}</span>
                    </div>
                    {viewMode === 'table' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleSetViewMode('cards'); setIsViewMenuOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                      viewMode === 'cards' 
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold' 
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{t('therapy.cardView', lang, 'Kästchen-Ansicht')}</span>
                    </div>
                    {viewMode === 'cards' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setIsTaxAdvisorLedgerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1B365D] hover:bg-[#152a48] text-white font-bold text-xs rounded-xl shadow-md transition"
            title={lang === 'de' ? 'Kassenbuch & Excel-Export öffnen' : 'Open Cash Ledger & Excel Export'}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'de' ? 'Kassenbuch (Excel)' : 'Cash Ledger (Excel)'}</span>
          </button>

          <button
            onClick={() => {
              setEditingItem({
                id: `bill_${Date.now()}`,
                clientId: clients[0]?.id || '',
                date: new Date().toISOString().slice(0, 10),
                service: 'Psychotherapeutische Einzelsitzung (60 Min)',
                amount: clients[0]?.hourlyRate || 90,
                taxRate: 0,
                status: 'ready',
                invoiceNumber: `PRAXIS-${Date.now().toString().slice(-6)}`,
                dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
                notes: 'Heilbehandlung gem. § 4 Nr. 14 UStG steuerfrei'
              });
              setIsNewModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'de' ? '+ Neue Abrechnung' : '+ New Invoicing Entry'}</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Bar (Visible when items are selected) */}
      {selectedIds.size > 0 && (
        <div 
          style={{ background: 'linear-gradient(135deg, var(--accent, #4f46e5) 0%, var(--accent-hover, #4338ca) 100%)' }}
          className="text-white p-3.5 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top duration-200"
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-400 bg-white cursor-pointer"
              title={isAllSelected ? (lang === 'de' ? 'Auswahl aufheben' : 'Deselect all') : (lang === 'de' ? 'Alle auswählen' : 'Select all')}
            />
            <span className="font-bold text-xs sm:text-sm">
              {selectedIds.size} {lang === 'de' ? 'Rechnungen ausgewählt' : 'invoices selected'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1-Click Mark as Paid (no bank/cash prompt required!) */}
            <button
              type="button"
              onClick={handleBatchMarkPaid}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              title={lang === 'de' ? 'Ausgewählte Rechnungen als bezahlt markieren' : 'Mark selected invoices as paid'}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{lang === 'de' ? 'Als bezahlt markieren' : 'Mark as Paid'}</span>
            </button>

            {/* 1-Click Mark as Open */}
            <button
              type="button"
              onClick={handleBatchMarkOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              title={lang === 'de' ? 'Ausgewählte Rechnungen als offen markieren' : 'Mark selected invoices as open'}
            >
              <Clock className="w-4 h-4" />
              <span>{lang === 'de' ? 'Als offen markieren' : 'Mark as Open'}</span>
            </button>

            {/* Bulk Transfer to Invoices App */}
            <button
              type="button"
              onClick={handleBatchTransferToInvoices}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition border border-white/30 backdrop-blur-xs cursor-pointer"
              title={lang === 'de' ? 'Ausgewählte in Rechnungs-App übertragen' : 'Transfer selected to Invoices'}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'In Rechnungs-App' : 'To Invoices App'}</span>
            </button>

            {/* Batch Delete */}
            <button
              type="button"
              onClick={() => setIsBatchDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/80 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
              title={lang === 'de' ? 'Ausgewählte löschen' : 'Delete selected'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Löschen' : 'Delete'}</span>
            </button>

            {/* Deselect */}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 bg-black/20 hover:bg-black/30 text-white/90 text-xs rounded-xl transition cursor-pointer"
            >
              {lang === 'de' ? 'Abwählen' : 'Clear'}
            </button>
          </div>
        </div>
      )}

      {/* Main Professional Invoicing Table / Cards */}
      {filteredBilling.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {lang === 'de' ? 'Keine Abrechnungen gefunden' : 'No invoices found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {lang === 'de' 
              ? 'Erstellen Sie Ihre erste Honorarabrechnung oder generieren Sie eine aus dokumentierten Sitzungen.' 
              : 'Create your first invoice draft or convert documented sessions into invoices.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Kästchen- / Karten-Ansicht (Boxes View) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBilling.map(item => {
            const client = getClient(item.clientId);
            const isPaid = item.status === 'paid';
            const isSelected = selectedIds.has(item.id);

            return (
              <div 
                key={item.id} 
                className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm transition flex flex-col justify-between group ${
                  isSelected 
                    ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20' 
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleSelect(item.id, e as any)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title={isSelected ? (lang === 'de' ? 'Abwählen' : 'Deselect') : (lang === 'de' ? 'Auswählen' : 'Select')}
                      />
                      <span className="font-bold text-xs text-slate-900 dark:text-white font-mono">
                        {item.invoiceNumber || `PRAXIS-${item.id.slice(-6).toUpperCase()}`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSaveBilling({
                          ...item,
                          status: isPaid ? 'ready' : 'paid'
                        });
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full transition cursor-pointer ${
                        isPaid 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                      title={isPaid ? (lang === 'de' ? 'Als offen markieren' : 'Mark open') : (lang === 'de' ? 'Als bezahlt markieren' : 'Mark paid')}
                    >
                      {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      <span>{isPaid ? (lang === 'de' ? 'Bezahlt' : 'Paid') : (lang === 'de' ? 'Offen' : 'Pending')}</span>
                    </button>
                  </div>

                  <div className="mb-2">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {client ? client.name : 'Unbekannter Klient'}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{item.date}</span>
                      {item.dueDate && <span>• Fällig: {item.dueDate}</span>}
                    </div>
                  </div>

                  {/* Sync status chip in Card View */}
                  <div className="flex items-center justify-between mb-2">
                    {item.syncedToInvoices || (item.invoiceNumber && item.invoiceNumber.startsWith('PRAXIS-')) ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                        <CheckCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{t('therapy.sync_status_synced', lang, 'Mit Rechnungs-App synchronisiert')}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSingleSync(item)}
                        className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 hover:text-blue-700 font-semibold bg-amber-50 dark:bg-amber-950/40 hover:bg-blue-50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 transition cursor-pointer"
                        title={t('therapy.sync_now', lang, 'Jetzt mit Rechnungs-App synchronisieren')}
                      >
                        <RefreshCw className="w-2.5 h-2.5 text-amber-600" />
                        <span>{t('therapy.sync_status_pending', lang, 'Nicht synchronisiert (Klicken zum Abgleichen)')}</span>
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl mb-3 line-clamp-2">
                    {item.service || 'Therapieleistung'}
                  </div>

                  {/* Prominent Amount / Fee box with direct edit pencil */}
                  <div className="flex items-center justify-between p-2.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100/60 dark:border-blue-900/40 rounded-xl mb-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {lang === 'de' ? 'Honorar / Betrag:' : 'Amount / Fee:'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {formatCurrencyDE(Number(item.amount) || 0, currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item);
                          setIsNewModalOpen(true);
                        }}
                        className="p-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
                        title={t('therapy.editFee', lang, 'Honorar / Betrag bearbeiten')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPrintPreviewItem(item)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title={lang === 'de' ? 'Drucken / PDF' : 'Print / PDF'}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTransferToInvoicesApp(item)}
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition cursor-pointer"
                      title={lang === 'de' ? 'In Rechnungs-App übertragen' : 'Transfer to Invoices'}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(item);
                        setIsNewModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer"
                      title={t('therapy.editBilling', lang, 'Rechnung bearbeiten')}
                    >
                      <Edit2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span>{lang === 'de' ? 'Bearbeiten' : 'Edit'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmItem(item)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition cursor-pointer"
                      title={lang === 'de' ? 'Löschen' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Tabellen-Ansicht (Table View) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="w-10 py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title={isAllSelected ? (lang === 'de' ? 'Auswahl aufheben' : 'Deselect all') : (lang === 'de' ? 'Alle auswählen' : 'Select all')}
                    />
                  </th>
                  <th className="py-3 px-4">{lang === 'de' ? 'Rechnungs-Nr.' : 'Invoice #'}</th>
                  <th className="py-3 px-4">{lang === 'de' ? 'Klient' : 'Client'}</th>
                  <th className="py-3 px-4">{lang === 'de' ? 'Datum' : 'Date'}</th>
                  <th className="py-3 px-4">{lang === 'de' ? 'Leistung / Beschreibung' : 'Service Description'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'de' ? 'Betrag' : 'Amount'}</th>
                  <th className="py-3 px-4 text-center">{lang === 'de' ? 'Status' : 'Status'}</th>
                  <th className="py-3 px-4 text-center">{lang === 'de' ? 'Rechnungs-Sync' : 'Invoices Sync'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'de' ? 'Aktionen' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredBilling.map(item => {
                  const client = getClient(item.clientId);
                  const isPaid = item.status === 'paid';
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition ${
                        isSelected 
                          ? 'bg-blue-50/60 dark:bg-blue-900/20' 
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className="w-10 py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelect(item.id, e as any)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Invoice Number */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {item.invoiceNumber || `PRAXIS-${item.id.slice(-6).toUpperCase()}`}
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {client ? client.name : 'Unbekannter Klient'}
                        </div>
                        {client?.contactId && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                            CRM Verknüpft
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.date}
                      </td>

                      {/* Service */}
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {item.service || 'Therapieleistung'}
                      </td>

                      {/* Amount with pencil icon */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span>{formatCurrencyDE(Number(item.amount) || 0, currency)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsNewModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer"
                            title={t('therapy.editFee', lang, 'Honorar / Betrag bearbeiten')}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            onSaveBilling({
                              ...item,
                              status: isPaid ? 'ready' : 'paid'
                            });
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full transition cursor-pointer ${
                            isPaid 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200' 
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200'
                          }`}
                          title={isPaid ? (lang === 'de' ? 'Klicken um als offen zu markieren' : 'Click to mark open') : (lang === 'de' ? 'Klicken um als bezahlt zu markieren' : 'Click to mark paid')}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              {lang === 'de' ? 'Bezahlt' : 'Paid'}
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              {lang === 'de' ? 'Offen' : 'Pending'}
                            </>
                          )}
                        </button>
                      </td>

                      {/* Invoices Sync Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {item.syncedToInvoices || (item.invoiceNumber && item.invoiceNumber.startsWith('PRAXIS-')) ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800"
                            title={t('therapy.syncedWithInvoices', lang, 'Mit Rechnungs-App synchronisiert')}
                          >
                            <CheckCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>{lang === 'de' ? 'Synchronisiert' : 'Synced'}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSingleSync(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-blue-950/40 border border-amber-200 dark:border-amber-800 transition cursor-pointer"
                            title={t('therapy.sync_now', lang, 'Jetzt mit Rechnungs-App synchronisieren')}
                          >
                            <RefreshCw className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>{lang === 'de' ? 'Sync ausstehend' : 'Sync pending'}</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print / PDF preview */}
                          <button
                            onClick={() => setPrintPreviewItem(item)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            title={lang === 'de' ? 'Rechnung drucken / PDF-Vorschau' : 'Print / Preview'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Transfer to official Invoices App */}
                          <button
                            onClick={() => handleTransferToInvoicesApp(item)}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition cursor-pointer"
                            title={lang === 'de' ? 'In Rechnungs-App übertragen' : 'Transfer to Invoices Module'}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Paid Status */}
                          <button
                            onClick={() => {
                              onSaveBilling({
                                ...item,
                                status: isPaid ? 'ready' : 'paid'
                              });
                            }}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              isPaid 
                                ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' 
                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                            title={isPaid ? (lang === 'de' ? 'Als offen markieren' : 'Mark as open') : (lang === 'de' ? 'Als bezahlt markieren' : 'Mark as paid')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsNewModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title={lang === 'de' ? 'Bearbeiten' : 'Edit'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteConfirmItem(item)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
                            title={lang === 'de' ? 'Löschen' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New / Edit Billing Modal */}
      {isNewModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span>{lang === 'de' ? 'Abrechnung / Rechnung erfassen' : 'Create / Edit Invoice'}</span>
            </h3>

            <form onSubmit={e => {
              e.preventDefault();
              onSaveBilling(editingItem);
              setIsNewModalOpen(false);
              setEditingItem(null);
              onShowToast(lang === 'de' ? 'Abrechnung gespeichert' : 'Billing saved');
            }} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Klient' : 'Client'} *
                </label>
                <div className="flex gap-2">
                  <select
                    value={editingItem.clientId}
                    onChange={e => {
                      const selectedC = clients.find(c => c.id === e.target.value);
                      setEditingItem({
                        ...editingItem,
                        clientId: e.target.value,
                        amount: selectedC?.hourlyRate || editingItem.amount
                      });
                    }}
                    required
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setIsNewModalOpen(false);
                      onOpenCustomerPicker();
                    }}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                    title={lang === 'de' ? 'Aus Kundenbuch wählen' : 'Pick from Contacts'}
                  >
                    <BookUser className="w-4 h-4 text-blue-600" />
                    <span>{lang === 'de' ? 'Kundenbuch' : 'CRM'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Rechnungsnummer' : 'Invoice Number'}
                  </label>
                  <input
                    type="text"
                    value={editingItem.invoiceNumber || ''}
                    onChange={e => setEditingItem({ ...editingItem, invoiceNumber: e.target.value })}
                    placeholder="PRAXIS-2026-001"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Leistungsdatum' : 'Service Date'} *
                  </label>
                  <input
                    type="date"
                    value={editingItem.date}
                    onChange={e => setEditingItem({ ...editingItem, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              {/* Service Preset selection */}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Leistungsbezeichnung / Vorlage' : 'Service Description / Template'}
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: 'Sitzung 60 Min', fee: 90, name: 'Psychotherapeutische Einzelsitzung (60 Min)' },
                    { label: 'Sitzung 50 Min', fee: 80, name: 'Psychotherapie / Beratung (50 Min)' },
                    { label: 'Erstgespräch 90m', fee: 130, name: 'Erstanamnese & Beratungsgespräch (90 Min)' },
                    { label: 'Kurzberatung 30m', fee: 45, name: 'Telefonische Kurzberatung / Intervention (30 Min)' },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setEditingItem({
                        ...editingItem,
                        service: preset.name,
                        amount: preset.fee
                      })}
                      className="px-2.5 py-1 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 transition"
                    >
                      {preset.label} ({preset.fee} {currency})
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={editingItem.service}
                  onChange={e => setEditingItem({ ...editingItem, service: e.target.value })}
                  required
                  placeholder="z.B. Psychotherapie nach Heilpraktikergesetz"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Honorarbetrag (€)' : 'Fee Amount'} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.amount}
                    onChange={e => setEditingItem({ ...editingItem, amount: Number(e.target.value) || 0 })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Status' : 'Status'}
                  </label>
                  <select
                    value={editingItem.status}
                    onChange={e => setEditingItem({ ...editingItem, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="ready">{lang === 'de' ? 'Offen / Bereit' : 'Open / Ready'}</option>
                    <option value="paid">{lang === 'de' ? 'Bezahlt' : 'Paid'}</option>
                    <option value="draft">{lang === 'de' ? 'Entwurf' : 'Draft'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Zusatznotizen / Steuerhinweis' : 'Notes / Tax Exempt Note'}
                </label>
                <textarea
                  rows={2}
                  value={editingItem.notes || ''}
                  onChange={e => setEditingItem({ ...editingItem, notes: e.target.value })}
                  placeholder="z.B. Umsatzsteuerfrei gem. § 4 Nr. 14 UStG"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-sm"
                >
                  {lang === 'de' ? 'Abrechnung speichern' : 'Save Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print / PDF Modal */}
      {printPreviewItem && (
        <TherapyInvoicePrintModal
          billing={printPreviewItem}
          client={getClient(printPreviewItem.clientId)}
          company={company}
          currency={currency}
          onClose={() => setPrintPreviewItem(null)}
        />
      )}

      {/* Tax Advisor & Accountant Cash Ledger Modal */}
      {isTaxAdvisorLedgerOpen && (
        <TherapyTaxAdvisorLedgerModal
          isOpen={isTaxAdvisorLedgerOpen}
          onClose={() => setIsTaxAdvisorLedgerOpen(false)}
          practiceData={{
            clients,
            billing,
            sessions,
            trips: [],
            appointments: []
          }}
          company={company}
          currency={currency}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteConfirmItem)}
        title={lang === 'de' ? 'Abrechnungsposition löschen?' : 'Delete Billing Item?'}
        itemName={deleteConfirmItem ? (deleteConfirmItem.invoiceNumber || deleteConfirmItem.service) : ''}
        description={lang === 'de' ? 'Möchten Sie diese Honorarabrechnung wirklich unwiderruflich löschen?' : 'Are you sure you want to delete this billing entry?'}
        onConfirm={() => {
          if (deleteConfirmItem) {
            onDeleteBilling(deleteConfirmItem.id);
            setDeleteConfirmItem(null);
          }
        }}
        onClose={() => setDeleteConfirmItem(null)}
      />

      {/* Batch Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={isBatchDeleteModalOpen}
        title={lang === 'de' ? 'Ausgewählte Rechnungen löschen?' : 'Delete Selected Invoices?'}
        itemName={`${selectedIds.size} ${lang === 'de' ? 'Rechnungen' : 'Invoices'}`}
        description={lang === 'de' 
          ? `Möchten Sie die ${selectedIds.size} ausgewählten Honorarabrechnungen wirklich unwiderruflich löschen?` 
          : `Are you sure you want to permanently delete the ${selectedIds.size} selected invoices?`}
        onConfirm={handleBatchDelete}
        onClose={() => setIsBatchDeleteModalOpen(false)}
      />

      {/* Client Filter Modal Popout */}
      <TherapyClientFilterModal
        isOpen={isClientFilterModalOpen}
        onClose={() => setIsClientFilterModalOpen(false)}
        clients={clients}
        selectedClientId={clientFilter}
        onSelectClient={setClientFilter}
        billing={billing}
      />
    </div>
  );
};
