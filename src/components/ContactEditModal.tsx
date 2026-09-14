import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  UserPlus, 
  Edit2, 
  X, 
  Clock, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Save, 
  Sparkles 
} from 'lucide-react';
import { Contact, ContactType } from '../types';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';
import { useLanguage, t } from '../lib/i18n';

export interface ContactEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: Partial<Contact> | null;
  onSaveSuccess: (savedContact: Contact) => void;
  currency?: string;
}

export const ContactEditModal: React.FC<ContactEditModalProps> = ({
  isOpen,
  onClose,
  contact,
  onSaveSuccess,
  currency = '€'
}) => {
  const currentLang = useLanguage();
  const [formData, setFormData] = useState<Partial<Contact>>({
    name: '',
    company: '',
    email: '',
    phone: '',
    type: 'customer',
    street: '',
    zip: '',
    city: '',
    country: 'Deutschland',
    taxId: '',
    fiscal_code: '',
    sdi_recipient_code: '',
    pec: '',
    is_public_admin: false,
    notes: '',
    default_hourly_rate: undefined
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showItalianFields, setShowItalianFields] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (contact) {
        setFormData({
          ...contact,
          country: contact.country || 'Deutschland',
          type: contact.type || 'customer',
          default_hourly_rate: contact.default_hourly_rate !== undefined ? contact.default_hourly_rate : undefined
        });
        if (contact.fiscal_code || contact.sdi_recipient_code || contact.pec || contact.is_public_admin) {
          setShowItalianFields(true);
        } else {
          setShowItalianFields(false);
        }
      } else {
        setFormData({
          name: '',
          company: '',
          email: '',
          phone: '',
          type: 'customer',
          street: '',
          zip: '',
          city: '',
          country: 'Deutschland',
          taxId: '',
          fiscal_code: '',
          sdi_recipient_code: '',
          pec: '',
          is_public_admin: false,
          notes: '',
          default_hourly_rate: undefined
        });
        setShowItalianFields(false);
      }
    }
  }, [isOpen, contact]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const isEditing = Boolean(formData.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim() || !formData.email?.trim()) {
      sounds.playError();
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedHourlyRate = 
        formData.default_hourly_rate !== undefined && formData.default_hourly_rate !== null && !isNaN(Number(formData.default_hourly_rate))
          ? Number(formData.default_hourly_rate)
          : undefined;

      if (formData.id) {
        const updatePayload: Partial<Contact> = {
          name: formData.name.trim(),
          company: formData.company?.trim() || '',
          email: formData.email.trim(),
          phone: formData.phone?.trim() || '',
          type: (formData.type as ContactType) || 'customer',
          street: formData.street?.trim() || '',
          zip: formData.zip?.trim() || '',
          city: formData.city?.trim() || '',
          country: formData.country?.trim() || 'Deutschland',
          taxId: formData.taxId?.trim() || '',
          fiscal_code: formData.fiscal_code?.trim() || '',
          sdi_recipient_code: formData.sdi_recipient_code?.trim() || '',
          pec: formData.pec?.trim() || '',
          is_public_admin: formData.is_public_admin || false,
          notes: formData.notes?.trim() || '',
          default_hourly_rate: parsedHourlyRate && parsedHourlyRate > 0 ? parsedHourlyRate : undefined
        };

        await db.contacts.update(formData.id, updatePayload);
        const saved = await db.contacts.get(formData.id);
        sounds.playSuccess();
        onSaveSuccess(saved || { ...(formData as Contact), ...updatePayload });
      } else {
        const newRecord: Omit<Contact, 'id'> = {
          name: formData.name.trim(),
          company: formData.company?.trim() || '',
          email: formData.email.trim(),
          phone: formData.phone?.trim() || '',
          type: (formData.type as ContactType) || 'customer',
          street: formData.street?.trim() || '',
          zip: formData.zip?.trim() || '',
          city: formData.city?.trim() || '',
          country: formData.country?.trim() || 'Deutschland',
          taxId: formData.taxId?.trim() || '',
          fiscal_code: formData.fiscal_code?.trim() || '',
          sdi_recipient_code: formData.sdi_recipient_code?.trim() || '',
          pec: formData.pec?.trim() || '',
          is_public_admin: formData.is_public_admin || false,
          notes: formData.notes?.trim() || '',
          default_hourly_rate: parsedHourlyRate && parsedHourlyRate > 0 ? parsedHourlyRate : undefined,
          avatar_color: 'bg-indigo-600',
          createdAt: new Date().toISOString()
        };

        const newId = await db.contacts.add(newRecord as Contact);
        const saved = await db.contacts.get(newId);
        sounds.playSuccess();
        if (saved) {
          onSaveSuccess(saved);
        }
      }
      onClose();
    } catch (err) {
      console.error('Failed to save contact:', err);
      sounds.playError();
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div 
      id="contact-edit-modal-backdrop"
      className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div 
        id="contact-edit-modal-container"
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-2xs">
              {isEditing ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {isEditing 
                  ? t('contact.modal_edit_title', currentLang, 'Edit Contact') 
                  : t('contact.modal_create_title', currentLang, 'Create New Contact')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditing && (formData.company || formData.name)
                  ? `${formData.name || ''} ${formData.company ? `(${formData.company})` : ''}`
                  : t('contact.title', currentLang, 'Contacts & Address Book')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 overflow-y-auto pr-1 flex-1">
          {/* Row 1: Name & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_name', currentLang, 'Full Name *')}
              </label>
              <input
                type="text"
                required
                placeholder={t('contact.modal_name_placeholder', currentLang, 'e.g. Dr. Alex Weber')}
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_company', currentLang, 'Company / Business')}
              </label>
              <input
                type="text"
                placeholder={t('contact.modal_company_placeholder', currentLang, 'e.g. Tech Solutions AG')}
                value={formData.company || ''}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Row 2: Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_email', currentLang, 'Email Address *')}
              </label>
              <input
                type="email"
                required
                placeholder={t('contact.modal_email_placeholder', currentLang, 'contact@domain.com')}
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_phone', currentLang, 'Phone Number')}
              </label>
              <input
                type="text"
                placeholder={t('contact.modal_phone_placeholder', currentLang, '+1 (555) 000-0000')}
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Standard Hourly Rate (Stundensatz) */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
                <span>{t('contact.modal_hourly_rate', currentLang, 'Standard Hourly Rate')}</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                Support & Service
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="z.B. 95.00"
                value={formData.default_hourly_rate ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    default_hourly_rate: val === '' ? undefined : parseFloat(val) || 0
                  });
                }}
                className="w-full pl-3 pr-16 py-2 text-xs font-mono bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-mono font-medium text-slate-400 dark:text-slate-400 pointer-events-none">
                {currency} / h
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('contact.modal_hourly_rate_hint', currentLang, 'Auto-applied to Support & Service tickets for this client.')}
            </p>
          </div>

          {/* Row 3: Street & Contact Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_street', currentLang, 'Street & House No.')}
              </label>
              <input
                type="text"
                value={formData.street || ''}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_type', currentLang, 'Contact Type')}
              </label>
              <select
                value={formData.type || 'customer'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ContactType })}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              >
                <option value="customer">{t('contact.type_customer', currentLang, 'Customer')}</option>
                <option value="vendor">{t('contact.type_vendor', currentLang, 'Supplier / Vendor')}</option>
                <option value="both">{t('contact.type_both', currentLang, 'Both')}</option>
              </select>
            </div>
          </div>

          {/* Row 4: ZIP & City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_zip', currentLang, 'Postal Code / ZIP')}
              </label>
              <input
                type="text"
                placeholder="10115"
                value={formData.zip || ''}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_city', currentLang, 'City / Town')}
              </label>
              <input
                type="text"
                placeholder="Berlin"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Row 5: Country & Tax ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_country', currentLang, 'Country')}
              </label>
              <input
                type="text"
                placeholder="Deutschland"
                value={formData.country || ''}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_tax_id', currentLang, 'Tax ID / VAT No.')}
              </label>
              <input
                type="text"
                placeholder="DE 000000000 / IT01234567890"
                value={formData.taxId || ''}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Italian E-Invoicing / SdI Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowItalianFields(!showItalianFields)}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>🇮🇹 {showItalianFields ? 'Italienische E-Rechnung (FatturaPA / SdI) ausblenden' : 'Italienische E-Rechnung (FatturaPA / SdI) einblenden'}</span>
            </button>

            {showItalianFields && (
              <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    Fattura Elettronica
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_public_admin || false}
                      onChange={(e) => setFormData({ ...formData, is_public_admin: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Öffentliche Verwaltung (PA)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Codice Fiscale
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. RSSMRA80A01H501U"
                      value={formData.fiscal_code || ''}
                      onChange={(e) => setFormData({ ...formData, fiscal_code: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Codice Destinatario
                    </label>
                    <input
                      type="text"
                      maxLength={7}
                      placeholder={formData.is_public_admin ? 'UF6Z01 (6)' : '0000000 (7)'}
                      value={formData.sdi_recipient_code || ''}
                      onChange={(e) => setFormData({ ...formData, sdi_recipient_code: e.target.value.toUpperCase() })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      PEC E-Mail
                    </label>
                    <input
                      type="email"
                      placeholder="kunde@pec.it"
                      value={formData.pec || ''}
                      onChange={(e) => setFormData({ ...formData, pec: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('contact.modal_notes', currentLang, 'Internal Notes & Remarks')}
            </label>
            <textarea
              rows={2}
              placeholder={t('contact.notes_placeholder', currentLang, 'Optional customer notes, terms or contact person...')}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              {t('contact.btn_cancel', currentLang, 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isSubmitting 
                  ? '...' 
                  : (isEditing ? t('contact.btn_save', currentLang, 'Save Contact') : t('contacts.btn_new', currentLang, 'Create Contact'))}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
