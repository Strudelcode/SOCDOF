import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Layers,
  CheckCircle2,
  ArrowRight,
  ListPlus,
  Check
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
  initialSequentialMode?: boolean;
  onBatchComplete?: (count: number) => void;
}

export const ContactEditModal: React.FC<ContactEditModalProps> = ({
  isOpen,
  onClose,
  contact,
  onSaveSuccess,
  currency = '€',
  initialSequentialMode = false,
  onBatchComplete
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
  const [isSequentialMode, setIsSequentialMode] = useState(false);
  const [createdInBatch, setCreatedInBatch] = useState<Contact[]>([]);
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const formScrollRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (contact) {
        setIsSequentialMode(false);
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
        setIsSequentialMode(Boolean(initialSequentialMode));
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
        setLastSavedName(null);
        setCreatedInBatch([]);
      }

      // Auto-focus the Name field
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 80);
    }
  }, [isOpen, contact, initialSequentialMode]);

  // Handle keyboard shortcuts (ESC to close, Ctrl+Enter / Alt+S to save & continue)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        if (isSequentialMode && createdInBatch.length > 0) {
          handleFinishBatch();
        } else {
          onClose();
        }
        return;
      }

      // Ctrl+Enter or Cmd+Enter: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isOpen && !isSubmitting) {
        e.preventDefault();
        if (isSequentialMode) {
          handleSaveContact(true);
        } else {
          handleSaveContact(false);
        }
      }

      // Alt+S: Save & Next in sequential mode
      if (e.altKey && (e.key === 's' || e.key === 'S') && isOpen && !isSubmitting && isSequentialMode) {
        e.preventDefault();
        handleSaveContact(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isSequentialMode, createdInBatch, formData]);

  if (!isOpen) return null;

  const isEditing = Boolean(formData.id);

  const handleSaveContact = async (keepOpenForNext: boolean) => {
    if (!formData.name?.trim() || !formData.email?.trim()) {
      sounds.playError();
      nameInputRef.current?.focus();
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
        onClose();
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
          avatar_color: (createdInBatch.length % 2 === 0) ? 'bg-indigo-600' : 'bg-emerald-600',
          createdAt: new Date().toISOString()
        };

        const newId = await db.contacts.add(newRecord as Contact);
        const saved = await db.contacts.get(newId);
        const savedContact = saved || ({ ...newRecord, id: newId } as Contact);

        sounds.playSuccess();
        onSaveSuccess(savedContact);

        if (keepOpenForNext) {
          setCreatedInBatch(prev => [savedContact, ...prev]);
          setLastSavedName(savedContact.name);

          // Reset form for next contact while maintaining type and country
          setFormData({
            name: '',
            company: '',
            email: '',
            phone: '',
            type: formData.type || 'customer',
            street: '',
            zip: '',
            city: '',
            country: formData.country || 'Deutschland',
            taxId: '',
            fiscal_code: '',
            sdi_recipient_code: '',
            pec: '',
            is_public_admin: false,
            notes: '',
            default_hourly_rate: undefined
          });

          // Scroll back to top & re-focus name input
          if (formScrollRef.current) {
            formScrollRef.current.scrollTop = 0;
          }
          setTimeout(() => {
            nameInputRef.current?.focus();
          }, 60);
        } else {
          if (onBatchComplete && createdInBatch.length > 0) {
            onBatchComplete(createdInBatch.length + 1);
          }
          onClose();
        }
      }
    } catch (err) {
      console.error('Failed to save contact:', err);
      sounds.playError();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishBatch = () => {
    // If user filled in name & email, ask if they want to save it first
    if (formData.name?.trim() && formData.email?.trim()) {
      const wantSave = confirm(t('contacts.confirm_save_current_before_exit', currentLang, 'Möchten Sie den aktuell eingegebenen Kontakt vor dem Beenden noch speichern?'));
      if (wantSave) {
        handleSaveContact(false);
        return;
      }
    }
    sounds.playClick();
    if (onBatchComplete && createdInBatch.length > 0) {
      onBatchComplete(createdInBatch.length);
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSequentialMode) {
      handleSaveContact(true);
    } else {
      handleSaveContact(false);
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
            <div className={`w-10 h-10 rounded-2xl ${isSequentialMode ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'} flex items-center justify-center font-bold shadow-2xs transition`}>
              {isEditing ? (
                <Edit2 className="w-5 h-5" />
              ) : isSequentialMode ? (
                <Layers className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {isEditing 
                    ? t('contact.modal_edit_title', currentLang, 'Edit Contact') 
                    : isSequentialMode
                      ? t('contacts.sequential_mode_title', currentLang, 'Batch Create Contacts (Sequential Entry)')
                      : t('contact.modal_create_title', currentLang, 'Create New Contact')}
                </h3>
                {isSequentialMode && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-700/60">
                    {t('contacts.sequential_mode_badge', currentLang, 'Batch Entry Active')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditing && (formData.company || formData.name)
                  ? `${formData.name || ''} ${formData.company ? `(${formData.company})` : ''}`
                  : isSequentialMode
                    ? `${t('contacts.sequential_counter', currentLang, 'Created in this batch:')} ${createdInBatch.length}`
                    : t('contact.title', currentLang, 'Contacts & Address Book')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isSequentialMode && createdInBatch.length > 0 ? handleFinishBatch : onClose}
              disabled={isSubmitting}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={isSequentialMode && createdInBatch.length > 0 ? t('contacts.btn_all_entered', currentLang, 'All Entered (Finish)') : t('contact.btn_close', currentLang, 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form ref={formScrollRef} onSubmit={handleSubmit} className="space-y-3.5 overflow-y-auto pr-1 flex-1">
          {/* Sequential Mode Banner & Feedback */}
          {isSequentialMode && (
            <div className="space-y-2">
              {lastSavedName ? (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      <strong>„{lastSavedName}“</strong> {t('contacts.sequential_success_toast', currentLang, 'Contact saved! Enter next contact...')}
                    </span>
                  </div>
                  <span className="font-bold text-[11px] px-2 py-0.5 rounded-md bg-emerald-200/60 dark:bg-emerald-800/50">
                    #{createdInBatch.length}
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-300 text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {t('contacts.sequential_mode_banner', currentLang, 'Enter contacts one after another with full details. After saving, the form is immediately refreshed for the next contact until you click "All Entered".')}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {t('contacts.sequential_tip', currentLang, 'Tip: Use Ctrl + Enter or the button below to capture contacts in quick succession.')}
                    </p>
                  </div>
                </div>
              )}

              {/* History pills of contacts saved in current session */}
              {createdInBatch.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium shrink-0">{t('contacts.sequential_counter', currentLang, 'Created in this batch:')} ({createdInBatch.length}):</span>
                  {createdInBatch.slice(0, 5).map((c, i) => (
                    <span key={c.id || i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 shrink-0 border border-slate-200/60 dark:border-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {c.name}
                    </span>
                  ))}
                  {createdInBatch.length > 5 && (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      +{createdInBatch.length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Row 1: Name & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_name', currentLang, 'Full Name *')}
              </label>
              <input
                ref={nameInputRef}
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
                {t('contact.modal_hourly_rate_tag', currentLang, 'Support & Service')}
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder={t('contact.modal_hourly_rate_placeholder', currentLang, 'e.g. 95.00')}
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
                placeholder={t('contact.modal_country_placeholder', currentLang, 'e.g. Germany')}
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
              <span>🇮🇹 {showItalianFields 
                ? t('contact.italian_einvoice_hide', currentLang, 'Hide Italian Electronic Invoicing (FatturaPA / SdI)') 
                : t('contact.italian_einvoice_show', currentLang, 'Show Italian Electronic Invoicing (FatturaPA / SdI)')}
              </span>
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
                    <span>{t('contact.italian_public_admin', currentLang, 'Public Administration (PA)')}</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Codice Fiscale
                    </label>
                    <input
                      type="text"
                      placeholder={t('contact.fiscal_code_placeholder', currentLang, 'e.g. RSSMRA80A01H501U')}
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
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
            {/* Left action / Done button */}
            <div className="flex items-center gap-2">
              {isSequentialMode && createdInBatch.length > 0 ? (
                <button
                  type="button"
                  onClick={handleFinishBatch}
                  className="px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('contacts.btn_all_entered', currentLang, 'All Entered (Finish)')} ({createdInBatch.length})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  {t('contact.btn_cancel', currentLang, 'Cancel')}
                </button>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 justify-end">
              {isSequentialMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSaveContact(false)}
                    disabled={isSubmitting}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{t('contacts.btn_save_and_finish', currentLang, 'Save & Finish')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveContact(true)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title={t('contacts.btn_save_and_next_tooltip', currentLang, 'Save contact and open form for next contact (Ctrl + Enter)')}
                  >
                    <ListPlus className="w-4 h-4" />
                    <span>{t('contacts.btn_save_and_next', currentLang, 'Save & Next Contact')}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                  </button>
                </>
              ) : (
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
              )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
