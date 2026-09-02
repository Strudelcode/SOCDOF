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
  FileSpreadsheet,
  AlertTriangle,
  Copy
} from 'lucide-react';
import { Invoice, InvoiceItem, InvoiceStatus, Contact, Product, CompanyProfile } from '../types';
import { db, executeStockMove, getNextInvoiceNumber } from '../lib/db';
import { sounds } from '../lib/sound';
import { InvoicePrintModal } from './InvoicePrintModal';
import { FakeSmtpModal } from './FakeSmtpModal';
import { PaymentModal } from './PaymentModal';
import { t, formatSystemDate } from '../lib/i18n';
import { generateInvoiceEml } from '../lib/emlGenerator';
import { downloadFatturaPaXml } from '../lib/fatturaPaGenerator';
import { parseFatturaPaXml, convertFatturaPaToInvoice, ParsedFatturaPa } from '../lib/fatturaPaParser';
import { isSdIReceiptXml, parseSdIReceiptXml, ParsedSdIReceipt, SDI_ERROR_CATALOG } from '../lib/sdiReceiptParser';
import { FatturaPaInspectorModal } from './FatturaPaInspectorModal';
import { DunningModal } from './DunningModal';

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
  onOpenSettings?: () => void;
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
  onOpenCreate,
  onOpenSettings
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [mailInvoice, setMailInvoice] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [sdiInspectorInvoice, setSdiInspectorInvoice] = useState<Invoice | null>(null);
  const [dunningInvoice, setDunningInvoice] = useState<Invoice | null>(null);
  const [incomingReceiptModal, setIncomingReceiptModal] = useState<{
    receipt: ParsedSdIReceipt;
    invoiceId?: number;
    rawXml: string;
  } | null>(null);

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

      // 1. Check if uploaded XML is an SdI notification / receipt (RC, NS, MC, NE, DT, AT)
      if (isSdIReceiptXml(text)) {
        const parsedReceipt = parseSdIReceiptXml(text);
        
        // Find matching invoice by SdI Identifier or filename
        const matched = invoices.find(inv => 
          (inv.sdi_identifier && parsedReceipt.identifierSdI && inv.sdi_identifier === parsedReceipt.identifierSdI) ||
          (inv.sdi_filename && parsedReceipt.fileName && inv.sdi_filename.toLowerCase() === parsedReceipt.fileName.toLowerCase()) ||
          (inv.number && parsedReceipt.fileName && parsedReceipt.fileName.toLowerCase().includes(inv.number.toLowerCase().replace(/[^a-z0-9]/g, '')))
        );

        setIncomingReceiptModal({
          receipt: parsedReceipt,
          invoiceId: matched?.id,
          rawXml: text
        });
        sounds.playPop();
        return;
      }

      // 2. Otherwise parse as standard FatturaPA 1.2.x XML invoice
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

  const handleApplySdIReceipt = async (invoiceId: number, receipt: ParsedSdIReceipt, rawXml: string) => {
    try {
      const inv = invoices.find(i => i.id === invoiceId);
      if (!inv) return;

      const currentReceipts = inv.sdi_receipts || [];
      const updatedReceipts = [
        ...currentReceipts,
        {
          type: receipt.receiptType,
          date: receipt.receiptDate || new Date().toISOString(),
          messageId: receipt.identifierSdI,
          description: receipt.errors?.map(e => `[${e.code}] ${e.description}`).join('; ') || receipt.notes || receipt.receiptTypeName,
          rawXml
        }
      ];

      await db.invoices.update(invoiceId, {
        sdi_status: receipt.sdiStatus,
        sdi_identifier: receipt.identifierSdI || inv.sdi_identifier,
        sdi_date: receipt.deliveryDate || receipt.receiptDate || new Date().toISOString(),
        sdi_receipt_type: receipt.receiptType,
        sdi_error_code: receipt.errors.length > 0 ? receipt.errors[0].code : undefined,
        sdi_error_message: receipt.errors.length > 0 ? receipt.errors[0].description : undefined,
        sdi_last_update: new Date().toISOString(),
        sdi_receipts: updatedReceipts
      } as any);

      sounds.playSuccess();
      setIncomingReceiptModal(null);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      sounds.playError();
      alert('Fehler beim Anwenden der SdI-Mitteilung: ' + (err?.message || err));
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
          fiscal_code: contact.fiscal_code,
          sdi_recipient_code: contact.sdi_recipient_code,
          pec: contact.pec,
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
        notes: invoice.notes,
        sdi_status: 'delivered',
        sdi_format: invoice.sdi_format || 'FPR12',
        sdi_recipient_code: invoice.sdi_recipient_code,
        sdi_pec: invoice.sdi_pec,
        sdi_bollo_virtuale: invoice.sdi_bollo_virtuale,
        sdi_cig: invoice.sdi_cig,
        sdi_cup: invoice.sdi_cup
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
      contact_address: contact.street ? `${contact.street}, ${contact.zip} ${contact.city}` : '',
      sdi_format: contact.is_public_admin ? 'FPA12' : (prev.sdi_format || 'FPR12'),
      sdi_recipient_code: contact.sdi_recipient_code || (contact.is_public_admin ? '000000' : (prev.sdi_recipient_code || company.sdi_default_recipient_code || '0000000')),
      sdi_pec: contact.pec || prev.sdi_pec || ''
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

  const handleDuplicateInvoice = async (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      sounds.playClick();
      const nextNum = await getNextInvoiceNumber();
      const duplicated: Invoice = {
        ...inv,
        id: undefined,
        number: nextNum,
        date: new Date().toISOString(),
        due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
        status: 'draft',
        paid_at: undefined,
        payment_method: undefined,
        stock_moved: false,
        sdi_status: undefined,
        sdi_identifier: undefined,
        sdi_receipts: []
      };
      await db.invoices.add(duplicated);
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

  const isCompanyIncomplete = !company.street?.trim() || !company.zip_city?.trim() || (!company.tax_id?.trim() && !company.iban?.trim());

  return (
    <div className="space-y-6">
      {/* Incomplete Master Data Warning Banner */}
      {isCompanyIncomplete && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs animate-fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200 block text-xs">
                {t('company.complete_details_title', undefined, 'Unternehmensdaten vervollständigen')}
              </span>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/90 mt-0.5">
                {t('company.complete_details_desc', undefined, 'Für rechtskonforme Rechnungen & Belege fehlen noch Stammdaten (wie Anschrift, Steuernummer oder Bankverbindung).')}
              </p>
            </div>
          </div>
          {onOpenSettings && (
            <button
              onClick={() => {
                sounds.playClick();
                onOpenSettings();
              }}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold rounded-xl shrink-0 transition text-xs shadow-xs cursor-pointer"
            >
              {t('company.complete_details_btn', undefined, 'Jetzt Stammdaten ausfüllen')}
            </button>
          )}
        </div>
      )}

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
                      <div className="flex items-center gap-1.5">
                        <span>{inv.number}</span>
                        {inv.number.startsWith('GASTRO') && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Gastro
                          </span>
                        )}
                        {inv.number.startsWith('POS') && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            Kasse
                          </span>
                        )}
                      </div>
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
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            {t('invoice.filter_posted', undefined, 'Offen')}
                          </span>
                          {inv.due_date && new Date(inv.due_date).getTime() < new Date().setHours(0, 0, 0, 0) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>Überfällig</span>
                            </span>
                          )}
                        </div>
                      )}
                      {inv.status === 'draft' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {t('invoice.filter_draft', undefined, 'Entwurf')}
                        </span>
                      )}

                      {/* SdI E-Invoicing Status Badge */}
                      {inv.sdi_status && (
                        <div className="mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sounds.playClick();
                              setSdiInspectorInvoice(inv);
                            }}
                            title="SdI / FatturaPA Status inspizieren"
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                              inv.sdi_status === 'delivered' || inv.sdi_status === 'accepted_by_pa'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : inv.sdi_status === 'rejected' || inv.sdi_status === 'rejected_by_pa'
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : inv.sdi_status === 'failed_delivery'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : inv.sdi_status === 'sent'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <FileCode className="w-2.5 h-2.5" />
                            <span>
                              {inv.sdi_status === 'delivered' ? 'SdI: Zugestellt'
                                : inv.sdi_status === 'accepted_by_pa' ? 'SdI: PA Akzeptiert'
                                : inv.sdi_status === 'rejected' ? 'SdI: Abgelehnt'
                                : inv.sdi_status === 'rejected_by_pa' ? 'SdI: PA Abgelehnt'
                                : inv.sdi_status === 'failed_delivery' ? 'SdI: Nicht zugest.'
                                : inv.sdi_status === 'sent' ? 'SdI: Gesendet'
                                : inv.sdi_status === 'deadline_passed' ? 'SdI: Fristablauf'
                                : 'SdI: Entwurf'}
                            </span>
                          </button>
                        </div>
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

                        {/* FatturaPA & SdI Inspector Modal */}
                        <button
                          onClick={() => {
                            sounds.playClick();
                            setSdiInspectorInvoice(inv);
                          }}
                          title="FatturaPA 1.2.x Inspektor & SdI Status (XML, Validierung, Übertragung)"
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

                        {/* Generate .EML Draft File */}
                        <button
                          onClick={() => {
                            sounds.playSuccess();
                            generateInvoiceEml(inv, company);
                          }}
                          title={t('invoice.btn_generate_eml_tooltip', undefined, 'E-Mail-Entwurf (.eml) mit Rechnungs- & Bankdaten herunterladen')}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <FileText className="w-4 h-4 text-indigo-500" />
                        </button>

                        {/* Duplicate Invoice */}
                        <button
                          onClick={(e) => handleDuplicateInvoice(inv, e)}
                          title={t('invoice.btn_duplicate_tooltip', undefined, 'Rechnung als neuen Entwurf duplizieren')}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Copy className="w-4 h-4 text-slate-500 hover:text-indigo-500" />
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

                        {/* Dunning / Payment Reminder if Overdue */}
                        {inv.status === 'posted' && inv.due_date && new Date(inv.due_date).getTime() < new Date().setHours(0, 0, 0, 0) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sounds.playWarning();
                              setDunningInvoice(inv);
                            }}
                            title="Zahlungserinnerung / Mahnung generieren (3-Stufiges Mahnwesen)"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-bold text-xs shadow-xs transition"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Mahnung</span>
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
              {isCompanyIncomplete && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{t('company.complete_details_desc', undefined, 'Für rechtskonforme Rechnungen & Belege fehlen noch Stammdaten (wie Anschrift, Steuernummer oder Bankverbindung).')}</span>
                  </div>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playClick();
                        onOpenSettings();
                      }}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shrink-0 text-[11px] transition cursor-pointer"
                    >
                      {t('company.complete_details_btn', undefined, 'Stammdaten ausfüllen')}
                    </button>
                  )}
                </div>
              )}

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

              {/* Italian E-Invoicing (SdI / FatturaPA 1.2.2) Configuration */}
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-850/60 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      🇮🇹 Italienische E-Rechnung (FatturaPA 1.2.2 &amp; SdI)
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                    Agenzia delle Entrate
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Übertragungsformat
                    </label>
                    <select
                      value={editingInvoice.sdi_format || 'FPR12'}
                      onChange={(e) => setEditingInvoice({ ...editingInvoice, sdi_format: e.target.value as 'FPR12' | 'FPA12' })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      <option value="FPR12">FPR12 (B2B / B2C Privatwirtschaft)</option>
                      <option value="FPA12">FPA12 (Pubblica Amministrazione)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Codice Destinatario (SdI)
                    </label>
                    <input
                      type="text"
                      maxLength={7}
                      placeholder={editingInvoice.sdi_format === 'FPA12' ? '6-stelliger PA-Code' : '7-stellig (z. B. 0000000)'}
                      value={editingInvoice.sdi_recipient_code || ''}
                      onChange={(e) => setEditingInvoice({ ...editingInvoice, sdi_recipient_code: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      PEC E-Mail (Zustellung)
                    </label>
                    <input
                      type="email"
                      placeholder="kunde@pec.it"
                      value={editingInvoice.sdi_pec || ''}
                      onChange={(e) => setEditingInvoice({ ...editingInvoice, sdi_pec: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CIG (Codice Gara)
                    </label>
                    <input
                      type="text"
                      placeholder="z. B. 9876543210"
                      value={editingInvoice.sdi_cig || ''}
                      onChange={(e) => setEditingInvoice({ ...editingInvoice, sdi_cig: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      CUP (Codice Progetto)
                    </label>
                    <input
                      type="text"
                      placeholder="z. B. J1234567890001"
                      value={editingInvoice.sdi_cup || ''}
                      onChange={(e) => setEditingInvoice({ ...editingInvoice, sdi_cup: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editingInvoice.sdi_bollo_virtuale || false}
                        onChange={(e) => setEditingInvoice({ ...editingInvoice, sdi_bollo_virtuale: e.target.checked })}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Bollo Virtuale (2,00 € Stempelsteuer)
                      </span>
                    </label>
                  </div>
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

      {/* FatturaPA 1.2.x & SdI Inspector Modal */}
      {sdiInspectorInvoice && (
        <FatturaPaInspectorModal
          invoice={sdiInspectorInvoice}
          company={company}
          customer={contacts.find(c => c.id === sdiInspectorInvoice.contact_id)}
          onClose={() => setSdiInspectorInvoice(null)}
          onUpdateInvoice={async (updated) => {
            if (updated.id) {
              await db.invoices.update(updated.id, updated);
              setSdiInspectorInvoice(updated);
              onRefresh();
            }
          }}
        />
      )}

      {/* SdI Incoming Receipt Notification Modal (RC, NS, MC, NE, DT, AT) */}
      {incomingReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  incomingReceiptModal.receipt.mappedStatus === 'delivered' || incomingReceiptModal.receipt.mappedStatus === 'accepted_by_pa'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                    : incomingReceiptModal.receipt.mappedStatus === 'rejected' || incomingReceiptModal.receipt.mappedStatus === 'rejected_by_pa'
                    ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                }`}>
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    SdI-Mitteilung empfangen: {incomingReceiptModal.receipt.receiptName} ({incomingReceiptModal.receipt.receiptType})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Italienische Steuerbehörde (Agenzia delle Entrate / SdI)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIncomingReceiptModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Details Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Neuer SdI-Status:</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  incomingReceiptModal.receipt.sdiStatus === 'delivered' || incomingReceiptModal.receipt.sdiStatus === 'accepted'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : incomingReceiptModal.receipt.sdiStatus === 'rejected' || incomingReceiptModal.receipt.sdiStatus === 'refused'
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}>
                  {incomingReceiptModal.receipt.sdiStatus === 'delivered' ? 'Zugestellt (Consegnata)'
                    : incomingReceiptModal.receipt.sdiStatus === 'accepted' ? 'PA Akzeptiert (Accettata)'
                    : incomingReceiptModal.receipt.sdiStatus === 'rejected' ? 'Abgelehnt (Scartata)'
                    : incomingReceiptModal.receipt.sdiStatus === 'refused' ? 'PA Abgelehnt (Rifiutata)'
                    : incomingReceiptModal.receipt.sdiStatus === 'failed_delivery' ? 'Nicht zugestellt (Mancata Consegna)'
                    : incomingReceiptModal.receipt.sdiStatus}
                </span>
              </div>

              {incomingReceiptModal.receipt.identifierSdI && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">SdI Identifikator:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {incomingReceiptModal.receipt.identifierSdI}
                  </span>
                </div>
              )}

              {incomingReceiptModal.receipt.fileName && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Dateiname der Rechnung:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[260px]">
                    {incomingReceiptModal.receipt.fileName}
                  </span>
                </div>
              )}

              {incomingReceiptModal.receipt.receiptDate && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Zeitstempel:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {incomingReceiptModal.receipt.receiptDate}
                  </span>
                </div>
              )}
            </div>

            {/* Error List if any */}
            {incomingReceiptModal.receipt.errors && incomingReceiptModal.receipt.errors.length > 0 && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Beanstandete Fehler (SdI Fehlerkatalog):</span>
                </h4>
                <div className="space-y-1.5">
                  {incomingReceiptModal.receipt.errors.map((err, idx) => (
                    <div key={idx} className="text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/60">
                      <div className="font-mono font-bold text-rose-700 dark:text-rose-400">
                        Fehlercode {err.code}
                      </div>
                      <div className="text-slate-700 dark:text-slate-300 text-[11px] mt-0.5">
                        {err.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoice Matching Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Rechnung zuordnen:
              </label>
              <select
                value={incomingReceiptModal.invoiceId || ''}
                onChange={(e) => setIncomingReceiptModal({
                  ...incomingReceiptModal,
                  invoiceId: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
              >
                <option value="">-- Keine Zuordnung / Manuell auswählen --</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} - {inv.contact_company || inv.contact_name} ({formatCurrency(inv.total)})
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIncomingReceiptModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!incomingReceiptModal.invoiceId}
                onClick={() => {
                  if (incomingReceiptModal.invoiceId) {
                    handleApplySdIReceipt(
                      incomingReceiptModal.invoiceId,
                      incomingReceiptModal.receipt,
                      incomingReceiptModal.rawXml
                    );
                  }
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>SdI-Status jetzt auf Rechnung anwenden</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 3-Stage Dunning Modal */}
      {dunningInvoice && (
        <DunningModal
          isOpen={!!dunningInvoice}
          onClose={() => setDunningInvoice(null)}
          invoice={dunningInvoice}
          company={company}
          contacts={contacts}
          onRefresh={onRefresh}
          currency={company.currency}
        />
      )}
    </div>
  );
};
