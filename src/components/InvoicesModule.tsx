import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  Receipt, 
  Plus, 
  Search, 
  Printer, 
  Mail, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Send, 
  Trash2, 
  Edit2, 
  X, 
  DollarSign, 
  Sparkles,
  ArrowRight,
  User,
  Calendar,
  CreditCard,
  Check,
  FileCode,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { Invoice, InvoiceItem, InvoiceStatus, Contact, Product, CompanyProfile } from '../types';
import { db, executeStockMove, getNextInvoiceNumber } from '../lib/db';
import { sounds } from '../lib/sound';
import { InvoicePrintModal } from './InvoicePrintModal';
import { FakeSmtpModal } from './FakeSmtpModal';
import { PaymentModal } from './PaymentModal';
import { t, formatSystemDate } from '../lib/i18n';
import { downloadFatturaPaXml } from '../lib/fatturaPaGenerator';
import { parseFatturaPaXml, convertFatturaPaToInvoice, ParsedFatturaPa } from '../lib/fatturaPaParser';

interface InvoicesModuleProps {
  invoices: Invoice[];
  contacts: Contact[];
  products: Product[];
  company: CompanyProfile;
  onRefresh: () => void;
  isCreateOpen: boolean;
  preselectedContactId?: number;
  onCloseCreate: () => void;
  onOpenCreate: (contactId?: number) => void;
}

export const InvoicesModule: React.FC<InvoicesModuleProps> = ({
  invoices,
  contacts,
  products,
  company,
  onRefresh,
  isCreateOpen,
  preselectedContactId,
  onCloseCreate,
  onOpenCreate
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [mailInvoice, setMailInvoice] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  // FatturaPA XML Importer State
  const [parsedFattura, setParsedFattura] = useState<ParsedFatturaPa | null>(null);
  const [importDirection, setImportDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [xmlError, setXmlError] = useState<string | null>(null);
  const [isProcessingXml, setIsProcessingXml] = useState(false);

  // New / Edit Invoice Form State
  const [editingInvoice, setEditingInvoice] = useState<Partial<Invoice> | null>(null);

  const handleXmlFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessingXml(true);
      setXmlError(null);
      sounds.playClick();
      const text = await file.text();
      const parsed = parseFatturaPaXml(text);
      setParsedFattura(parsed);
      sounds.playPop();
    } catch (err: any) {
      console.error(err);
      setXmlError(err?.message || 'Ungültiges FatturaPA / SdI XML Format.');
      sounds.playError();
    } finally {
      setIsProcessingXml(false);
      e.target.value = '';
    }
  };

  const handleConfirmFatturaImport = async () => {
    if (!parsedFattura) return;
    try {
      const { invoice, contact } = convertFatturaPaToInvoice(parsedFattura, importDirection);

      // Check if contact already exists or create new
      let contactId: number | undefined;
      const existingContact = contacts.find(c => 
        (contact.taxId && c.taxId && c.taxId.trim() === contact.taxId.trim()) ||
        (c.name.toLowerCase() === (contact.name || '').toLowerCase())
      );

      if (existingContact) {
        contactId = existingContact.id;
      } else if (contact.name) {
        const newContact: Contact = {
          name: contact.name,
          company: contact.company || contact.name,
          taxId: contact.taxId,
          street: contact.street,
          zip: contact.zip,
          city: contact.city,
          country: contact.country || 'IT',
          email: contact.email || '',
          phone: '',
          type: importDirection === 'incoming' ? 'vendor' : 'customer',
          notes: `Automatisch erstellt via FatturaPA XML Import (${parsedFattura.invoiceNumber})`,
          createdAt: new Date().toISOString()
        };
        contactId = await db.contacts.add(newContact);
      }

      // Add Invoice to DB
      const invoiceToSave: Invoice = {
        number: invoice.number || `PA-${Date.now().toString().slice(-6)}`,
        date: invoice.date || new Date().toISOString().slice(0, 10),
        due_date: invoice.due_date || new Date().toISOString().slice(0, 10),
        type: importDirection === 'incoming' ? 'in_invoice' : 'out_invoice',
        contact_id: contactId || 1,
        contact_name: contact.name || 'Unbekannter Partner',
        contact_company: contact.company || contact.name,
        subtotal: invoice.subtotal || 0,
        tax_total: invoice.tax_total || 0,
        total: invoice.total || 0,
        status: 'posted',
        payment_terms: invoice.payment_terms,
        items: invoice.items || [],
        notes: invoice.notes
      };

      await db.invoices.add(invoiceToSave);
      sounds.playImport();
      setParsedFattura(null);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      sounds.playError();
      alert(`Fehler beim Speichern der Rechnung: ${err?.message || err}`);
    }
  };

  // Trigger new invoice initialization if isCreateOpen is triggered
  React.useEffect(() => {
    if (isCreateOpen && !editingInvoice) {
      initNewInvoice(preselectedContactId);
    }
  }, [isCreateOpen, preselectedContactId]);

  const initNewInvoice = async (contactId?: number) => {
    const nextNumber = await getNextInvoiceNumber();
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const defaultContact = contactId 
      ? contacts.find(c => c.id === contactId) 
      : contacts.find(c => c.type === 'customer' || c.type === 'both') || contacts[0];

    const defaultProduct = products[0];

    const initialItem: InvoiceItem = defaultProduct ? {
      id: `item_${Date.now()}`,
      product_id: defaultProduct.id || 1,
      product_name: defaultProduct.name,
      sku: defaultProduct.sku,
      qty: 1,
      unit_price: defaultProduct.sale_price || 0,
      tax_rate: company.default_tax_rate || 19,
      discount: 0,
      subtotal: defaultProduct.sale_price || 0
    } : {
      id: `item_${Date.now()}`,
      product_id: 1,
      product_name: 'Standard-Artikel',
      sku: 'PRD-001',
      qty: 1,
      unit_price: 100,
      tax_rate: 19,
      discount: 0,
      subtotal: 100
    };

    setEditingInvoice({
      number: nextNumber,
      contact_id: defaultContact?.id || 1,
      contact_name: defaultContact?.name || '',
      contact_email: defaultContact?.email || '',
      contact_company: defaultContact?.company || '',
      contact_address: defaultContact?.street ? `${defaultContact.street}, ${defaultContact.zip} ${defaultContact.city}` : '',
      date: today,
      due_date: dueDate,
      subject: company.letterhead_default_subject || 'Rechnung für Lieferungen und Leistungen',
      status: 'draft',
      type: 'out_invoice',
      items: [initialItem],
      subtotal: initialItem.subtotal,
      tax_total: (initialItem.subtotal * (company.default_tax_rate || 19)) / 100,
      total: initialItem.subtotal + (initialItem.subtotal * (company.default_tax_rate || 19)) / 100,
      notes: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
      payment_terms: '14 Tage netto',
      stock_moved: false
    });
  };

  // Recalculate totals whenever items change
  const updateInvoiceItems = (items: InvoiceItem[]) => {
    let subtotal = 0;
    let taxTotal = 0;

    const recalculatedItems = items.map(item => {
      const itemSubtotal = (item.qty * item.unit_price) * (1 - (item.discount || 0) / 100);
      const itemTax = (itemSubtotal * item.tax_rate) / 100;
      subtotal += itemSubtotal;
      taxTotal += itemTax;
      return {
        ...item,
        subtotal: itemSubtotal
      };
    });

    const total = subtotal + taxTotal;

    setEditingInvoice(prev => prev ? ({
      ...prev,
      items: recalculatedItems,
      subtotal,
      tax_total: taxTotal,
      total
    }) : null);
  };

  const handleContactChange = (contactId: number) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    setEditingInvoice(prev => prev ? ({
      ...prev,
      contact_id: contact.id || 1,
      contact_name: contact.name,
      contact_email: contact.email,
      contact_company: contact.company || '',
      contact_address: contact.street ? `${contact.street}, ${contact.zip} ${contact.city}` : ''
    }) : null);
  };

  const handleAddItem = () => {
    sounds.playClick();
    const prod = products[0];
    const newItem: InvoiceItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      product_id: prod?.id || 1,
      product_name: prod?.name || 'Neuer Artikel',
      sku: prod?.sku || 'SKU-001',
      qty: 1,
      unit_price: prod?.sale_price || 50,
      tax_rate: company.default_tax_rate || 19,
      discount: 0,
      subtotal: prod?.sale_price || 50
    };

    const currentItems = editingInvoice?.items || [];
    updateInvoiceItems([...currentItems, newItem]);
  };

  const handleRemoveItem = (itemId: string) => {
    sounds.playClick();
    const currentItems = editingInvoice?.items || [];
    if (currentItems.length <= 1) return;
    updateInvoiceItems(currentItems.filter(i => i.id !== itemId));
  };

  const handleItemProductChange = (itemId: string, productId: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const currentItems = editingInvoice?.items || [];
    const updated = currentItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          product_id: prod.id || 1,
          product_name: prod.name,
          sku: prod.sku,
          unit_price: prod.sale_price || 0
        };
      }
      return item;
    });

    updateInvoiceItems(updated);
  };

  const handleItemFieldChange = (itemId: string, field: 'qty' | 'unit_price' | 'discount' | 'tax_rate', val: number) => {
    const currentItems = editingInvoice?.items || [];
    const updated = currentItems.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          [field]: Math.max(0, val)
        };
      }
      return item;
    });
    updateInvoiceItems(updated);
  };

  const handleSaveDraft = async () => {
    if (!editingInvoice) return;
    try {
      if (editingInvoice.id) {
        await db.invoices.update(editingInvoice.id, editingInvoice);
      } else {
        await db.invoices.add(editingInvoice as Invoice);
      }
      sounds.playSuccess();
      setEditingInvoice(null);
      onCloseCreate();
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handlePostInvoice = async (invoiceToPost?: Invoice) => {
    const target = invoiceToPost || (editingInvoice as Invoice);
    if (!target) return;

    try {
      // 1. Move stock from Physical/Warehouse to Virtual/Customers if not already moved
      if (!target.stock_moved && target.items?.length) {
        for (const item of target.items) {
          // Check if it's a physical product (not digital license or service with 999 qty)
          const prod = products.find(p => p.id === item.product_id);
          if (prod && prod.category !== 'Software & Lizenzen' && prod.category !== 'Dienstleistung') {
            await executeStockMove({
              product_id: item.product_id,
              qty: item.qty,
              source_location: 'Physical/Warehouse',
              dest_location: 'Virtual/Customers',
              reference: `Auslieferung zu Rechnung ${target.number}`,
              date: new Date().toISOString(),
              notes: `Automatische Ausbuchung für ${target.contact_name}`
            });
          }
        }
      }

      // 2. Update status to posted
      const updatedData: Partial<Invoice> = {
        ...target,
        status: 'posted',
        stock_moved: true
      };

      if (target.id) {
        await db.invoices.update(target.id, updatedData);
      } else {
        await db.invoices.add(updatedData as Invoice);
      }

      sounds.playSuccess();
      setEditingInvoice(null);
      onCloseCreate();
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleMarkAsPaid = async (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await db.invoices.update(inv.id!, {
        status: 'paid',
        paid_at: new Date().toISOString()
      });

      // Play Kaching Sound + Confetti!
      sounds.playKaching();
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 }
        });
      } catch {
        // ignore
      }

      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleDeleteInvoice = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(t('invoice.delete_confirm', undefined, 'Rechnung wirklich löschen?'))) return;
    try {
      await db.invoices.delete(id);
      sounds.playSuccess();
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${company.currency}`;
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      inv.number.toLowerCase().includes(q) ||
      (inv.contact_name && inv.contact_name.toLowerCase().includes(q)) ||
      (inv.contact_company && inv.contact_company.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
          <button
            onClick={() => {
              sounds.playClick();
              setFilterStatus('all');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('invoice.filter_all', undefined, 'Alle')} ({invoices.length})
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setFilterStatus('draft');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterStatus === 'draft'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('invoice.filter_draft', undefined, 'Entwurf')} ({invoices.filter(i => i.status === 'draft').length})
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setFilterStatus('posted');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterStatus === 'posted'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('invoice.filter_posted', undefined, 'Offen')} ({invoices.filter(i => i.status === 'posted').length})
          </button>
          <button
            onClick={() => {
              sounds.playClick();
              setFilterStatus('paid');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterStatus === 'paid'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t('invoice.filter_paid', undefined, 'Bezahlt')} ({invoices.filter(i => i.status === 'paid').length})
          </button>
        </div>

        {/* Live Search & Create Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('invoice.search_placeholder', undefined, 'Rechnung oder Kunde suchen...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition cursor-pointer active:scale-95">
            <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">XML / FatturaPA importieren</span>
            <span className="sm:hidden">XML Import</span>
            <input
              type="file"
              accept=".xml,.p7m"
              onChange={handleXmlFileInput}
              disabled={isProcessingXml}
              className="hidden"
            />
          </label>

          <button
            onClick={() => {
              sounds.playClick();
              onOpenCreate();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('invoice.new_invoice', undefined, 'Neue Rechnung')}</span>
          </button>
        </div>
      </div>

      {xmlError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{xmlError}</span>
          </div>
          <button onClick={() => setXmlError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Invoices List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('invoice.journal', undefined, 'Rechnungsjournal')} ({filteredInvoices.length} {t('invoice.entries', undefined, 'Einträge')})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="p-4">{t('invoice.th_number', undefined, 'Rechnungs-Nr.')}</th>
                <th className="p-4">{t('invoice.th_contact', undefined, 'Kunde / Empfänger')}</th>
                <th className="p-4">{t('invoice.th_date', undefined, 'Datum')}</th>
                <th className="p-4">{t('invoice.th_due_date', undefined, 'Fälligkeit')}</th>
                <th className="p-4 text-center">{t('invoice.th_status', undefined, 'Status')}</th>
                <th className="p-4 text-right">{t('invoice.th_total', undefined, 'Gesamtbetrag (Brutto)')}</th>
                <th className="p-4 text-right">{t('invoice.th_actions', undefined, 'Aktionen')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    {t('invoice.empty_list', undefined, 'Keine Rechnungen in diesem Filter vorhanden.')}
                  </td>
                </tr>
              ) : (
                [...filteredInvoices].reverse().map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4 font-mono-num font-bold text-slate-900 dark:text-white">
                      {inv.number}
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {inv.contact_company || inv.contact_name}
                      </div>
                      {inv.contact_company && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.contact_name}
                        </div>
                      )}
                    </td>

                    <td className="p-4 font-mono-num text-slate-600 dark:text-slate-400">
                      {formatSystemDate(inv.date)}
                    </td>

                    <td className="p-4 font-mono-num text-slate-600 dark:text-slate-400">
                      {formatSystemDate(inv.due_date)}
                    </td>

                    <td className="p-4 text-center">
                      {inv.status === 'paid' && (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{t('invoice.filter_paid', undefined, 'Bezahlt')}</span>
                          </span>
                          {inv.payment_method && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              {inv.payment_method === 'card' ? `💳 ${t('invoice.payment_card', undefined, 'Kartenzahlung')}` : inv.payment_method === 'cash' ? `💵 ${t('invoice.payment_cash', undefined, 'Barzahlung')}` : `🏦 ${t('invoice.payment_sepa', undefined, 'SEPA')}`}
                            </span>
                          )}
                        </div>
                      )}
                      {inv.status === 'posted' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          {t('invoice.filter_posted', undefined, 'Offen')}
                        </span>
                      )}
                      {inv.status === 'draft' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {t('invoice.filter_draft', undefined, 'Entwurf')}
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right font-mono-num font-bold text-slate-900 dark:text-white">
                      {formatCurrency(inv.total)}
                      <div className="text-[10px] text-slate-400 font-normal">
                        inkl. {formatCurrency(inv.tax_total)} MwSt.
                      </div>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Print PDF */}
                        <button
                          onClick={() => {
                            sounds.playClick();
                            setPrintInvoice(inv);
                          }}
                          title={t('invoice.btn_print_tooltip', undefined, 'PDF Druckansicht (DIN-A4)')}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* FatturaPA 1.2.x XML Export for Italian E-Invoicing / SdI */}
                        <button
                          onClick={() => {
                            const customer = contacts.find(c => c.id === inv.contact_id);
                            downloadFatturaPaXml(inv, company, customer);
                          }}
                          title="FatturaPA XML exportieren (Italienisches E-Invoicing / SdI)"
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </button>

                        {/* Send via Fake SMTP */}
                        <button
                          onClick={() => {
                            sounds.playClick();
                            setMailInvoice(inv);
                          }}
                          title={t('invoice.btn_mail_tooltip', undefined, 'Per E-Mail versenden (Fake-SMTP)')}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Mail className="w-4 h-4" />
                        </button>

                        {/* Post if Draft */}
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handlePostInvoice(inv)}
                            title={t('invoice.btn_post_tooltip', undefined, 'Rechnung buchen / freigeben (Post)')}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-[11px] transition shadow-xs"
                          >
                            {t('invoice.btn_post', undefined, 'Buchen')}
                          </button>
                        )}

                        {/* Pay with Card / Terminal if Posted */}
                        {inv.status === 'posted' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sounds.playClick();
                              setPayingInvoice(inv);
                            }}
                            title={t('invoice.btn_pay_tooltip', undefined, 'Kartenzahlung / Barzahlung abrechnen')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{t('invoice.btn_pay', undefined, 'Zahlen')}</span>
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          onClick={() => {
                            sounds.playClick();
                            setEditingInvoice(inv);
                          }}
                          title={t('action.edit', undefined, 'Bearbeiten')}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={(e) => inv.id && handleDeleteInvoice(inv.id, e)}
                          title={t('action.delete', undefined, 'Löschen')}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Screen / Large Modal for Invoice Creation & Line Item Editor */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {editingInvoice.id 
                    ? `${t('invoice.edit_invoice', undefined, 'Rechnung bearbeiten')} (${editingInvoice.number})` 
                    : `${t('invoice.new_outgoing', undefined, 'Neue Ausgangsrechnung erstellen')} (${editingInvoice.number})`}
                </h3>
              </div>

              <button
                onClick={() => {
                  setEditingInvoice(null);
                  onCloseCreate();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Customer & Date Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('invoice.modal_customer_select', undefined, 'Kunde / Empfänger auswählen *')}
                  </label>
                  <select
                    value={editingInvoice.contact_id}
                    onChange={(e) => handleContactChange(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                  >
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('invoice.modal_date', undefined, 'Rechnungsdatum *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={editingInvoice.date || ''}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('invoice.modal_due_date', undefined, 'Fälligkeitsdatum *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={editingInvoice.due_date || ''}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, due_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Subject (Betreff) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('invoice.modal_subject', undefined, 'Betreffzeile (Subject) für Beleg & Briefpapier')}
                </label>
                <input
                  type="text"
                  placeholder={t('invoice.modal_subject_placeholder', undefined, 'z. B. Rechnung für Beratungsleistungen und Software-Entwicklung')}
                  value={editingInvoice.subject || ''}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, subject: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Dynamic Line Items Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('invoice.modal_items_title', undefined, 'Rechnungspositionen')}
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('invoice.modal_add_item', undefined, 'Position hinzufügen')}</span>
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-3">{t('invoice.modal_col_product', undefined, 'Produkt')}</th>
                        <th className="p-3 w-20 text-center">{t('invoice.modal_col_qty', undefined, 'Menge')}</th>
                        <th className="p-3 w-28 text-right">{t('invoice.modal_col_unit_price', undefined, 'Einzelpreis')} ({company.currency})</th>
                        <th className="p-3 w-20 text-center">{t('invoice.modal_col_discount', undefined, 'Rabatt (%)')}</th>
                        <th className="p-3 w-20 text-center">{t('invoice.modal_col_tax', undefined, 'MwSt (%)')}</th>
                        <th className="p-3 w-28 text-right">{t('invoice.modal_col_subtotal', undefined, 'Summe')}</th>
                        <th className="p-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {editingInvoice.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-2">
                            <select
                              value={item.product_id}
                              onChange={(e) => handleItemProductChange(item.id, parseInt(e.target.value))}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                            >
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku}) - {p.sale_price} {company.currency}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => handleItemFieldChange(item.id, 'qty', parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1.5 text-xs text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleItemFieldChange(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 text-xs text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount || 0}
                              onChange={(e) => handleItemFieldChange(item.id, 'discount', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 text-xs text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                            />
                          </td>

                          <td className="p-2">
                            <select
                              value={item.tax_rate}
                              onChange={(e) => handleItemFieldChange(item.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 text-xs text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                            >
                              <option value="19">19%</option>
                              <option value="7">7%</option>
                              <option value="0">0%</option>
                            </select>
                          </td>

                          <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatCurrency(item.subtotal)}
                          </td>

                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={(editingInvoice.items?.length || 0) <= 1}
                              className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary and Notes Block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('invoice.modal_notes_label', undefined, 'Rechnungshinweise & Zahlungsbedingungen')}
                  </label>
                  <textarea
                    rows={3}
                    value={editingInvoice.notes || ''}
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, notes: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>{t('invoice.modal_subtotal_label', undefined, 'Nettobetrag (Zwischensumme):')}</span>
                    <span className="font-mono">{formatCurrency(editingInvoice.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>{t('invoice.modal_tax_label', undefined, 'MwSt. (Umsatzsteuer):')}</span>
                    <span className="font-mono">{formatCurrency(editingInvoice.tax_total || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span>{t('invoice.modal_total_label', undefined, 'Gesamtbetrag (Brutto):')}</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 text-base">
                      {formatCurrency(editingInvoice.total || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => {
                  setEditingInvoice(null);
                  onCloseCreate();
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
              >
                {t('invoice.modal_btn_cancel', undefined, 'Abbrechen')}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition"
                >
                  {t('invoice.modal_btn_save_draft', undefined, 'Als Entwurf speichern')}
                </button>

                <button
                  type="button"
                  onClick={() => handlePostInvoice()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  {t('invoice.modal_btn_post', undefined, 'Rechnung freigeben & Buchen (Post)')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal (Real Card Terminal & Cash) */}
      {payingInvoice && (
        <PaymentModal
          invoice={payingInvoice}
          company={company}
          onClose={() => setPayingInvoice(null)}
          onPaymentSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* PDF Print Modal */}
      {printInvoice && (
        <InvoicePrintModal
          invoice={printInvoice}
          company={company}
          onClose={() => setPrintInvoice(null)}
        />
      )}

      {/* Fake SMTP Mail Modal */}
      {mailInvoice && (
        <FakeSmtpModal
          invoice={mailInvoice}
          onSuccess={async () => {
            if (mailInvoice.id) {
              await db.invoices.update(mailInvoice.id, {
                sent_at: new Date().toISOString()
              });
              onRefresh();
            }
          }}
          onClose={() => setMailInvoice(null)}
        />
      )}

      {/* FatturaPA / SdI XML Import Preview Modal */}
      {parsedFattura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    FatturaPA E-Rechnung importieren
                  </h3>
                  <p className="text-xs text-slate-500">
                    SdI XML Dokument erkannt • {parsedFattura.documentType} ({parsedFattura.invoiceNumber})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setParsedFattura(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document summary header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Rechnungs-Nr.</span>
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{parsedFattura.invoiceNumber}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Datum</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{parsedFattura.invoiceDate}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Währung</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{parsedFattura.currency}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block uppercase font-bold">Gesamtbetrag</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {parsedFattura.totalAmount.toFixed(2)} {parsedFattura.currency}
                </span>
              </div>
            </div>

            {/* Direction Selection (Incoming vs Outgoing) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Rechnungstyp zuordnen:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setImportDirection('incoming')}
                  className={`p-3 rounded-xl text-left border text-xs font-semibold transition ${
                    importDirection === 'incoming'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold">Eingangsrechnung (Lieferant)</div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    Lieferant: {parsedFattura.seller.name || 'Unbekannt'} (P.IVA: {parsedFattura.seller.taxId || '-'})
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setImportDirection('outgoing')}
                  className={`p-3 rounded-xl text-left border text-xs font-semibold transition ${
                    importDirection === 'outgoing'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold">Ausgangsrechnung (Kunde)</div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    Kunde: {parsedFattura.buyer.name || 'Unbekannt'} (P.IVA: {parsedFattura.buyer.taxId || '-'})
                  </div>
                </button>
              </div>
            </div>

            {/* Line items preview */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Positionen ({parsedFattura.items.length})
              </h4>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[11px]">
                    <tr>
                      <th className="p-2.5">Beschreibung</th>
                      <th className="p-2.5 text-right">Menge</th>
                      <th className="p-2.5 text-right">Einzelpreis</th>
                      <th className="p-2.5 text-right">MwSt</th>
                      <th className="p-2.5 text-right">Gesamt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedFattura.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{item.product_name}</td>
                        <td className="p-2.5 text-right font-mono">{item.qty}</td>
                        <td className="p-2.5 text-right font-mono">{item.unit_price.toFixed(2)} €</td>
                        <td className="p-2.5 text-right text-[11px] text-slate-500">{item.tax_rate}%</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {(item.subtotal || (item.qty * item.unit_price)).toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment & Bank info */}
            {parsedFattura.payment?.iban && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Zahlungsweg &amp; IBAN</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{parsedFattura.payment.iban}</span>
                  {parsedFattura.payment.bankName && <span className="text-slate-500 ml-2">({parsedFattura.payment.bankName})</span>}
                </div>
                {parsedFattura.payment.dueDate && (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded text-[11px] font-semibold">
                    Fällig am {parsedFattura.payment.dueDate}
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setParsedFattura(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirmFatturaImport}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Rechnung jetzt in SOCDOF übernehmen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
