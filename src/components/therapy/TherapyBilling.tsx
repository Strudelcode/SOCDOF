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
  FileSpreadsheet
} from 'lucide-react';
import { BillingItem, Client, Session } from './types';
import { CompanyProfile } from '../../types';
import { useLanguage } from '../../lib/i18n';
import { db } from '../../lib/db';
import { formatCurrencyDE, formatIntegerDE } from '../../lib/formatters';
import { TherapyInvoicePrintModal } from './TherapyInvoicePrintModal';
import { TherapyTaxAdvisorLedgerModal } from './TherapyTaxAdvisorLedgerModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TherapyBillingProps {
  billing: BillingItem[];
  clients: Client[];
  sessions: Session[];
  company?: CompanyProfile;
  currency: string;
  onSaveBilling: (item: BillingItem) => void;
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
  onDeleteBilling,
  onOpenCustomerPicker,
  onShowToast,
  onOpenInvoices
}) => {
  const lang = useLanguage();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'paid'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  
  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BillingItem | null>(null);
  const [printPreviewItem, setPrintPreviewItem] = useState<BillingItem | null>(null);
  const [isTaxAdvisorLedgerOpen, setIsTaxAdvisorLedgerOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<BillingItem | null>(null);

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

  // Transfer billing item to SOCDOF Invoices Database (db.invoices)
  const handleTransferToInvoicesApp = async (item: BillingItem) => {
    try {
      const client = getClient(item.clientId);
      const amount = Number(item.amount) || 0;
      const taxRate = item.taxRate || 0;
      const taxAmount = (amount * taxRate) / 100;
      const total = amount + taxAmount;

      const invoiceNumber = item.invoiceNumber || `PRAXIS-${Date.now().toString().slice(-6)}`;

      await db.invoices.add({
        contact_id: client?.contactId ? Number(client.contactId) : 0,
        contact_name: client?.name || 'Klient',
        contact_email: client?.email,
        number: invoiceNumber,
        type: 'out_invoice',
        status: item.status === 'paid' ? 'paid' : 'posted',
        date: item.date || new Date().toISOString().slice(0, 10),
        due_date: item.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        subtotal: amount,
        tax_total: taxAmount,
        total: total,
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
      });

      // Update local item status to invoiced if not already
      onSaveBilling({
        ...item,
        invoiceNumber,
        status: item.status === 'paid' ? 'paid' : 'invoiced'
      });

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
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
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
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
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

          {/* Client Filter Dropdown */}
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">{lang === 'de' ? 'Alle Klienten' : 'All Clients'}</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Main Professional Invoicing Table */}
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
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">{lang === 'de' ? 'Rechnungs-Nr.' : 'Invoice #'}</th>
                  <th className="py-3 px-4">{lang === 'de' ? 'Klient' : 'Client'}</th>
                  <th className="py-3 px-4">{lang === 'de' ? 'Datum' : 'Date'}</th>
                  <th className="py-3 px-4">{lang === 'de' ? 'Leistung / Beschreibung' : 'Service Description'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'de' ? 'Betrag' : 'Amount'}</th>
                  <th className="py-3 px-4 text-center">{lang === 'de' ? 'Status' : 'Status'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'de' ? 'Aktionen' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredBilling.map(item => {
                  const client = getClient(item.clientId);
                  const isPaid = item.status === 'paid';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
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

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrencyDE(Number(item.amount) || 0, currency)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full ${
                          isPaid 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
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
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print / PDF preview */}
                          <button
                            onClick={() => setPrintPreviewItem(item)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            title={lang === 'de' ? 'Rechnung drucken / PDF-Vorschau' : 'Print / Preview'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Transfer to official Invoices App */}
                          <button
                            onClick={() => handleTransferToInvoicesApp(item)}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
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
                            className={`p-1.5 rounded-lg transition ${
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
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
    </div>
  );
};
