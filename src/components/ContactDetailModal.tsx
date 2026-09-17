import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Edit2, 
  Trash2, 
  Receipt, 
  Mail, 
  Share2, 
  Phone, 
  MapPin, 
  Clock, 
  Building2, 
  FileText,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { Contact, Invoice, CompanyProfile } from '../types';
import { t, useLanguage, formatSystemDate } from '../lib/i18n';
import { generateContactEml } from '../lib/emlGenerator';
import { downloadVCard } from '../lib/vcardGenerator';
import { sounds } from '../lib/sound';

interface ContactDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  invoices: Invoice[];
  company?: CompanyProfile;
  currency: string;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: string | number) => void;
  onCreateInvoice: (contact: Contact) => void;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
  isOpen,
  onClose,
  contact,
  invoices,
  company,
  currency,
  onEdit,
  onDelete,
  onCreateInvoice
}) => {
  const currentLang = useLanguage();
  const [activeTab, setActiveTab] = useState<'info' | 'invoices' | 'products' | 'notes'>('info');

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Financial KPIs and aggregates
  const contactInvoices = useMemo(() => {
    if (!contact) return [];
    return invoices.filter(inv => String(inv.contact_id) === String(contact.id));
  }, [contact, invoices]);

  const contactTotalRevenue = useMemo(() => {
    return contactInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
  }, [contactInvoices]);

  const contactOpenReceivables = useMemo(() => {
    return contactInvoices
      .filter(inv => inv.status === 'posted')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
  }, [contactInvoices]);

  const contactPurchasedProducts = useMemo(() => {
    if (!contact) return [];
    const productMap = new Map<string, { name: string; quantity: number; totalAmount: number; lastDate: string }>();

    contactInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          const key = item.product_name || (item as any).description || 'Artikel';
          const existing = productMap.get(key);
          const qty = Number(item.qty ?? (item as any).quantity ?? 1);
          const unitPrice = Number(item.unit_price ?? (item as any).unitPrice ?? (item as any).price ?? 0);
          const itemTotal = Number(item.subtotal ?? (item as any).amount ?? (qty * unitPrice));

          if (existing) {
            existing.quantity += qty;
            existing.totalAmount += itemTotal;
            if (new Date(inv.date) > new Date(existing.lastDate)) {
              existing.lastDate = inv.date;
            }
          } else {
            productMap.set(key, {
              name: key,
              quantity: qty,
              totalAmount: itemTotal,
              lastDate: inv.date
            });
          }
        });
      }
    });

    return Array.from(productMap.values());
  }, [contact, contactInvoices]);

  if (!isOpen || !contact) return null;

  const displayName = contact.name || contact.company || t('contact.individual_customer', currentLang, 'Individual Customer');
  const displayCompany = contact.company;

  return createPortal(
    <div 
      id="contact-detail-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sounds.playClick();
          onClose();
        }
      }}
    >
      <div 
        id="contact-detail-modal-container"
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-12 h-12 rounded-2xl ${contact.avatar_color || 'bg-emerald-600'} text-white flex items-center justify-center font-extrabold text-sm shadow-md shrink-0`}>
              {contact.name ? contact.name.substring(0, 2).toUpperCase() : (contact.company ? contact.company.substring(0, 2).toUpperCase() : 'KD')}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                  {displayName}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                  contact.type === 'customer' 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' 
                    : contact.type === 'vendor' 
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400' 
                    : contact.type === 'guest'
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-400'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                }`}>
                  {contact.type === 'customer' 
                    ? t('contact.type_customer', currentLang, 'Customer') 
                    : contact.type === 'vendor' 
                    ? t('contact.type_vendor', currentLang, 'Supplier') 
                    : contact.type === 'guest'
                    ? t('contact.type_guest', currentLang, 'Gästebuch / Privat')
                    : t('contacts.type_partner', currentLang, 'Partner')}
                </span>
              </div>
              {displayCompany && displayName !== displayCompany && (
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{displayCompany}</span>
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onEdit(contact);
              }}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={t('contact.edit_contact', currentLang, 'Edit Contact')}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                if (window.confirm(t('contact.delete_confirm', currentLang, 'Are you sure you want to delete this contact?'))) {
                  onDelete(contact.id!);
                  onClose();
                }
              }}
              className="p-2 text-rose-500 hover:text-rose-700 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              title={t('contact.btn_delete', currentLang, 'Delete Contact')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ml-1"
              title={t('contact.btn_close', currentLang, 'Close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Quick Actions Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onCreateInvoice(contact);
                onClose();
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer sm:col-span-1"
            >
              <Receipt className="w-4 h-4" />
              <span>{t('contact.btn_create_invoice', currentLang, 'Create Invoice')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playSuccess();
                generateContactEml(contact, company);
              }}
              title="Vorformatierte .eml Datei für Outlook / Thunderbird / Apple Mail herunterladen"
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">{t('contact.btn_generate_eml', currentLang, 'E-Mail-Entwurf (.eml)')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playSuccess();
                downloadVCard(contact);
              }}
              title="Elektronische Visitenkarte (.vcf) für Smartphone & Outlook herunterladen"
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">{t('contact.btn_export_vcf', currentLang, 'vCard (.vcf)')}</span>
            </button>
          </div>

          {/* Financial KPIs & Hourly Rate summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('contact.kpi_paid_total', currentLang, 'Total Paid')}
              </span>
              <div className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {contactTotalRevenue.toLocaleString(currentLang === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 2 })} {currency}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('contact.kpi_open_receivables', currentLang, 'Open Receivables')}
              </span>
              <div className="text-sm font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {contactOpenReceivables.toLocaleString(currentLang === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 2 })} {currency}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t('contact.modal_hourly_rate', currentLang, 'Standard Hourly Rate')}
              </span>
              <div className="text-sm font-extrabold font-mono text-cyan-600 dark:text-cyan-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {contact.default_hourly_rate !== undefined && contact.default_hourly_rate > 0
                    ? `${contact.default_hourly_rate.toFixed(2)} ${currency} / h`
                    : '–'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => { sounds.playClick(); setActiveTab('info'); }}
              className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                activeTab === 'info' 
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('contact.tab_master_data', currentLang, 'Stammdaten')}
            </button>
            <button
              type="button"
              onClick={() => { sounds.playClick(); setActiveTab('invoices'); }}
              className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === 'invoices' 
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{t('contact.tab_invoices', currentLang, 'Rechnungen')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700">
                {contactInvoices.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { sounds.playClick(); setActiveTab('products'); }}
              className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === 'products' 
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{t('contact.tab_products', currentLang, 'Produkte')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700">
                {contactPurchasedProducts.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { sounds.playClick(); setActiveTab('notes'); }}
              className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                activeTab === 'notes' 
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('contact.tab_notes', currentLang, 'Notizen')}
            </button>
          </div>

          {/* TAB CONTENT: 1. MASTER DATA */}
          {activeTab === 'info' && (
            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contact.email && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                      {t('contact.modal_email', currentLang, 'Email Address')}
                    </span>
                    <a 
                      href={`mailto:${contact.email}`} 
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium mt-0.5 flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{contact.email}</span>
                    </a>
                  </div>
                )}

                {contact.phone && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                      {t('contact.modal_phone', currentLang, 'Phone Number')}
                    </span>
                    <a 
                      href={`tel:${contact.phone}`} 
                      className="text-slate-800 dark:text-slate-200 hover:underline font-medium mt-0.5 flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>{contact.phone}</span>
                    </a>
                  </div>
                )}
              </div>

              {(contact.street || contact.city || contact.zip) && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                    {t('contacts.field_address', currentLang, 'Address')}
                  </span>
                  <div className="flex items-start gap-1.5 mt-0.5 text-slate-800 dark:text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      {contact.street ? `${contact.street}, ` : ''}
                      {contact.zip} {contact.city}
                      {contact.country ? ` (${contact.country})` : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Standard Hourly Rate card */}
              {contact.default_hourly_rate !== undefined && contact.default_hourly_rate > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase block">
                      {t('contact.field_default_hourly_rate', currentLang, 'Standard Hourly Rate')}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t('contact.modal_hourly_rate_hint', currentLang, 'Auto-applied to Support & Service tickets for this client')}
                    </span>
                  </div>
                  <span className="text-sm font-bold font-mono text-cyan-600 dark:text-cyan-400">
                    {contact.default_hourly_rate.toFixed(2)} {currency} / h
                  </span>
                </div>
              )}

              {/* Tax & Fiscal IDs */}
              {contact.taxId && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">
                    {t('contact.modal_tax_id', currentLang, 'Tax ID / VAT No.')}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {contact.taxId}
                  </span>
                </div>
              )}

              {/* Italian Electronic Invoicing Fields */}
              {(contact.fiscal_code || contact.sdi_recipient_code || contact.pec) && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase block">
                    Italienische E-Rechnung (FatturaPA / SdI)
                  </span>
                  
                  {contact.fiscal_code && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Codice Fiscale:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{contact.fiscal_code}</span>
                    </div>
                  )}

                  {contact.sdi_recipient_code && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Codice Destinatario (SdI):</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{contact.sdi_recipient_code}</span>
                    </div>
                  )}

                  {contact.pec && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">PEC-Adresse:</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{contact.pec}</span>
                    </div>
                  )}

                  {contact.is_public_admin && (
                    <div className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[10px] font-bold rounded">
                      🏛️ Pubblica Amministrazione (FPA12)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: 2. INVOICES */}
          {activeTab === 'invoices' && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 animate-fade-in">
              {contactInvoices.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-1.5" />
                  <p className="text-xs">{t('contact.no_invoices', currentLang, 'No invoices found for this contact.')}</p>
                </div>
              ) : (
                contactInvoices.map(inv => (
                  <div 
                    key={inv.id} 
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{inv.number}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatSystemDate(inv.date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {inv.total.toFixed(2)} {currency}
                      </div>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-md mt-0.5 ${
                        inv.status === 'paid' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                          : inv.status === 'posted' 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {inv.status === 'paid' ? 'Bezahlt' : inv.status === 'posted' ? 'Offen' : 'Entwurf'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB CONTENT: 3. PRODUCTS */}
          {activeTab === 'products' && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 animate-fade-in">
              {contactPurchasedProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Tag className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-1.5" />
                  <p className="text-xs">{t('contact.no_products', currentLang, 'No products billed yet.')}</p>
                </div>
              ) : (
                contactPurchasedProducts.map((prod, pIdx) => (
                  <div 
                    key={pIdx} 
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {prod.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {t('contact.quantity_label', currentLang, 'Menge')}: {prod.quantity} &bull; {t('contact.last_purchased', currentLang, 'Letzter Kauf')}: {formatSystemDate(prod.lastDate)}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {prod.totalAmount.toFixed(2)} {currency}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB CONTENT: 4. NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-3 animate-fade-in text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold mb-1">
                  {t('contact.notes_and_agreements', currentLang, 'Customer Notes & Agreements')}
                </span>
                <p className="text-slate-700 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-h-[90px] whitespace-pre-wrap leading-relaxed">
                  {contact.notes || t('contact.no_notes', currentLang, 'No notes entered. Click edit above to add remarks.')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-400">
            ID: <span className="font-mono">{contact.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onEdit(contact);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{t('contact.edit_contact', currentLang, 'Edit Contact')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 rounded-xl transition cursor-pointer"
            >
              {t('contact.btn_close', currentLang, 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
