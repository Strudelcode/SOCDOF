import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Check,
  Users,
  User,
  Plus,
  Trash2,
  Star,
  Globe,
  Briefcase
} from 'lucide-react';
import { Contact, ContactType, ContactPerson } from '../types';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';
import { useLanguage, t } from '../lib/i18n';
import { searchCountries, getLocalizedCountryName, CountryItem } from '../lib/countries';

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

  // Mode: Company (Fa.) vs Individual Person
  const [isCompany, setIsCompany] = useState<boolean>(true);

  // Sub-contacts / Contact persons for this company
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);

  // Main Form Data
  const [formData, setFormData] = useState<Partial<Contact>>({
    name: '',
    first_name: '',
    last_name: '',
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

  // Country Auto-Suggest
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [activeCountryIndex, setActiveCountryIndex] = useState<number>(-1);
  const countryInputContainerRef = useRef<HTMLDivElement>(null);

  const companyInputRef = useRef<HTMLInputElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const formScrollRef = useRef<HTMLFormElement>(null);

  // Filtered country suggestions based on query
  const countrySuggestions = useMemo(() => {
    return searchCountries(formData.country || '', currentLang);
  }, [formData.country, currentLang]);

  // Close country dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        countryInputContainerRef.current && 
        !countryInputContainerRef.current.contains(e.target as Node)
      ) {
        setIsCountryDropdownOpen(false);
        setActiveCountryIndex(-1);
      }
    };
    if (isCountryDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isCountryDropdownOpen]);

  // Load initial contact state
  useEffect(() => {
    if (isOpen) {
      if (contact) {
        setIsSequentialMode(false);

        // Determine if company or individual
        const hasCompanyExplicit = contact.is_company !== undefined 
          ? contact.is_company 
          : Boolean(contact.company && (!contact.first_name || contact.company === contact.name));
        
        setIsCompany(hasCompanyExplicit);

        // Split name into first and last name if not explicitly set (only for individuals)
        let fName = contact.first_name || '';
        let lName = contact.last_name || '';
        if (!hasCompanyExplicit && !fName && !lName && contact.name) {
          const parts = contact.name.trim().split(' ');
          if (parts.length > 1) {
            fName = parts[0];
            lName = parts.slice(1).join(' ');
          } else {
            fName = parts[0];
          }
        }

        setFormData({
          ...contact,
          first_name: fName,
          last_name: lName,
          country: contact.country || 'Deutschland',
          type: contact.type || 'customer',
          default_hourly_rate: contact.default_hourly_rate !== undefined ? contact.default_hourly_rate : undefined
        });

        setContactPersons(contact.contact_persons ? [...contact.contact_persons] : []);

        if (contact.fiscal_code || contact.sdi_recipient_code || contact.pec || contact.is_public_admin) {
          setShowItalianFields(true);
        } else {
          setShowItalianFields(false);
        }
      } else {
        setIsSequentialMode(Boolean(initialSequentialMode));
        setIsCompany(true); // Default to company as requested
        setContactPersons([]);
        setFormData({
          name: '',
          first_name: '',
          last_name: '',
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

      // Auto-focus primary input
      setTimeout(() => {
        if (contact?.is_company === false) {
          firstNameInputRef.current?.focus();
        } else {
          companyInputRef.current?.focus();
        }
      }, 80);
    }
  }, [isOpen, contact, initialSequentialMode]);

  // Handle keyboard shortcuts (ESC to close, Ctrl+Enter / Alt+S to save & continue)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        if (isCountryDropdownOpen) {
          setIsCountryDropdownOpen(false);
          return;
        }
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
  }, [isOpen, isSubmitting, isSequentialMode, createdInBatch, isCountryDropdownOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(formData.id);

  // Sub-contact helpers
  const handleAddPerson = () => {
    sounds.playClick();
    const newPerson: ContactPerson = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: '',
      is_primary: contactPersons.length === 0
    };
    setContactPersons(prev => [...prev, newPerson]);
  };

  const handleUpdatePerson = (id: string, patch: Partial<ContactPerson>) => {
    setContactPersons(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  };

  const handleRemovePerson = (id: string) => {
    sounds.playClick();
    setContactPersons(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (filtered.length > 0 && !filtered.some(p => p.is_primary)) {
        filtered[0].is_primary = true;
      }
      return filtered;
    });
  };

  const handleSetPrimaryPerson = (id: string) => {
    sounds.playClick();
    setContactPersons(prev => prev.map(p => ({
      ...p,
      is_primary: p.id === id
    })));
  };

  const handleSelectCountry = (item: CountryItem) => {
    sounds.playClick();
    const localized = getLocalizedCountryName(item, currentLang);
    setFormData(prev => ({ ...prev, country: localized }));
    setIsCountryDropdownOpen(false);
    setActiveCountryIndex(-1);
  };

  const handleSaveContact = async (keepOpenForNext: boolean) => {
    const trimmedCompany = formData.company?.trim() || '';
    const trimmedFirst = formData.first_name?.trim() || '';
    const trimmedLast = formData.last_name?.trim() || '';

    // Validation
    if (isCompany) {
      if (!trimmedCompany) {
        sounds.playError();
        companyInputRef.current?.focus();
        return;
      }
    } else {
      if (!trimmedFirst && !trimmedLast && !formData.name?.trim()) {
        sounds.playError();
        firstNameInputRef.current?.focus();
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const parsedHourlyRate = 
        formData.default_hourly_rate !== undefined && formData.default_hourly_rate !== null && !isNaN(Number(formData.default_hourly_rate))
          ? Number(formData.default_hourly_rate)
          : undefined;

      // Construct normalized full name
      const computedPersonName = `${trimmedFirst} ${trimmedLast}`.trim();
      const effectiveName = isCompany 
        ? trimmedCompany 
        : (computedPersonName || trimmedCompany || formData.name?.trim() || '');

      // Sanitize sub-contacts
      const sanitizedPersons = contactPersons
        .filter(p => p.first_name.trim() || p.last_name.trim() || p.email?.trim() || p.phone?.trim())
        .map(p => ({
          ...p,
          first_name: p.first_name.trim(),
          last_name: p.last_name.trim(),
          email: p.email?.trim() || '',
          phone: p.phone?.trim() || '',
          role: p.role?.trim() || ''
        }));

      // If company has contact persons and primary is selected, pick its email/phone as default if empty
      const primaryPerson = sanitizedPersons.find(p => p.is_primary) || sanitizedPersons[0];
      const fallbackEmail = formData.email?.trim() || (isCompany && primaryPerson?.email ? primaryPerson.email : '');
      const fallbackPhone = formData.phone?.trim() || (isCompany && primaryPerson?.phone ? primaryPerson.phone : '');

      const payload: Partial<Contact> = {
        name: effectiveName,
        first_name: trimmedFirst || (isCompany && primaryPerson ? primaryPerson.first_name : ''),
        last_name: trimmedLast || (isCompany && primaryPerson ? primaryPerson.last_name : ''),
        is_company: isCompany,
        company: isCompany ? trimmedCompany : (trimmedCompany || ''),
        email: fallbackEmail,
        phone: fallbackPhone,
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
        contact_persons: sanitizedPersons,
        default_hourly_rate: parsedHourlyRate && parsedHourlyRate > 0 ? parsedHourlyRate : undefined
      };

      if (formData.id) {
        await db.contacts.update(formData.id, payload);
        const saved = await db.contacts.get(formData.id);
        sounds.playSuccess();
        onSaveSuccess(saved || { ...(formData as Contact), ...payload });
        onClose();
      } else {
        const newRecord: Omit<Contact, 'id'> = {
          ...(payload as Contact),
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

          // Reset form for next contact
          setContactPersons([]);
          setFormData({
            name: '',
            first_name: '',
            last_name: '',
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

          if (formScrollRef.current) {
            formScrollRef.current.scrollTop = 0;
          }
          setTimeout(() => {
            if (isCompany) {
              companyInputRef.current?.focus();
            } else {
              firstNameInputRef.current?.focus();
            }
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
    if (formData.company?.trim() || formData.first_name?.trim() || formData.name?.trim()) {
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
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${isCompany ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'} flex items-center justify-center font-bold shadow-2xs transition`}>
              {isEditing ? (
                <Edit2 className="w-5 h-5" />
              ) : isCompany ? (
                <Building2 className="w-5 h-5" />
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
                      ? t('contacts.sequential_mode_title', currentLang, 'Batch Create Contacts')
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
                  ? `${formData.name || ''} ${formData.company && formData.company !== formData.name ? `(${formData.company})` : ''}`
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
        <form ref={formScrollRef} onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Sequential Mode Banner & Feedback */}
          {isSequentialMode && (
            <div className="space-y-2">
              {lastSavedName && (
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
              )}
            </div>
          )}

          {/* Contact Classification Switcher: Company (Fa.) vs. Individual Person */}
          <div className="p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setIsCompany(true);
                setTimeout(() => companyInputRef.current?.focus(), 50);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                isCompany
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0 text-indigo-500" />
              <span>{t('contact.entry_type_company', currentLang, 'Firma / Unternehmen (Fa.)')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setIsCompany(false);
                setTimeout(() => firstNameInputRef.current?.focus(), 50);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                !isCompany
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{t('contact.entry_type_person', currentLang, 'Privatperson / Einzelperson')}</span>
            </button>
          </div>

          {/* COMPANY MODE: Firmenname (Fa.) & Sub-contacts */}
          {isCompany ? (
            <div className="space-y-3.5 animate-fade-in">
              {/* Firmenname (Fa.) Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('contact.company_name', currentLang, 'Firmenname (Fa.) *')}
                </label>
                <div className="relative">
                  <input
                    ref={companyInputRef}
                    type="text"
                    required
                    placeholder={t('contact.modal_company_placeholder', currentLang, 'z. B. Tech Solutions AG')}
                    value={formData.company || ''}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
                  />
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* KONTAKTPERSONEN (UNTERKONTAKTE) SECTION */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/60 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {t('contact.subcontacts_title', currentLang, 'Kontaktpersonen (Unterkontakte)')}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t('contact.subcontacts_desc', currentLang, 'Ansprechpartner und Mitarbeiter dieser Firma')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddPerson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('contact.btn_add_person', currentLang, '+ Kontaktperson hinzufügen')}</span>
                  </button>
                </div>

                {/* Sub-contacts list */}
                {contactPersons.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800/60 bg-white/70 dark:bg-slate-900/60 text-center space-y-1">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {t('contact.no_subcontacts', currentLang, 'Noch keine Kontaktpersonen hinterlegt')}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Klicken Sie oben auf „+ Kontaktperson hinzufügen“, um Ansprechpartner mit aufgeteiltem Vor- & Nachnamen, E-Mail und Durchwahl anzulegen.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {contactPersons.map((person, index) => (
                      <div 
                        key={person.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          person.is_primary
                            ? 'bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 shadow-xs ring-1 ring-indigo-500/20'
                            : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {/* Header of Person Card */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {person.first_name || person.last_name 
                                ? `${person.first_name} ${person.last_name}`.trim() 
                                : `Ansprechpartner #${index + 1}`}
                            </span>
                            {person.is_primary && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 text-[10px] font-bold">
                                <Star className="w-3 h-3 fill-indigo-600 dark:fill-indigo-400 text-indigo-600 dark:text-indigo-400" />
                                <span>{t('contact.primary_badge', currentLang, 'Hauptkontakt')}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {!person.is_primary && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryPerson(person.id)}
                                className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                              >
                                {t('contact.mark_primary', currentLang, 'Als Hauptkontakt festlegen')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemovePerson(person.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Kontaktperson entfernen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Fields: Aufgeteilt in Vorname und Nachname */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                              {t('contact.first_name', currentLang, 'Vorname')}
                            </label>
                            <input
                              type="text"
                              placeholder="z. B. Julia"
                              value={person.first_name}
                              onChange={(e) => handleUpdatePerson(person.id, { first_name: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                              {t('contact.last_name', currentLang, 'Nachname')}
                            </label>
                            <input
                              type="text"
                              placeholder="z. B. Schmidt"
                              value={person.last_name}
                              onChange={(e) => handleUpdatePerson(person.id, { last_name: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Fields: E-Mail & Telefon & Rolle */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                              {t('contact.modal_email', currentLang, 'E-Mail-Adresse')}
                            </label>
                            <input
                              type="email"
                              placeholder="j.schmidt@firma.de"
                              value={person.email || ''}
                              onChange={(e) => handleUpdatePerson(person.id, { email: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                              {t('contact.modal_phone', currentLang, 'Telefonnummer')}
                            </label>
                            <input
                              type="text"
                              placeholder="+49 (0) 123 45678"
                              value={person.phone || ''}
                              onChange={(e) => handleUpdatePerson(person.id, { phone: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                              {t('contact.role_position', currentLang, 'Position / Rolle')}
                            </label>
                            <input
                              type="text"
                              placeholder={t('contact.role_placeholder', currentLang, 'z. B. Einkauf')}
                              value={person.role || ''}
                              onChange={(e) => handleUpdatePerson(person.id, { role: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* PERSON MODE: Aufgeteilte Felder für Vorname und Nachname */
            <div className="space-y-3.5 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.first_name_required', currentLang, 'Vorname *')}
                  </label>
                  <input
                    ref={firstNameInputRef}
                    type="text"
                    required={!formData.last_name}
                    placeholder="z. B. Maximilian"
                    value={formData.first_name || ''}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.last_name_required', currentLang, 'Nachname *')}
                  </label>
                  <input
                    type="text"
                    required={!formData.first_name}
                    placeholder="z. B. Mustermann"
                    value={formData.last_name || ''}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                  />
                </div>
              </div>

              {/* Optional Company / Employer for individual */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('contact.modal_company', currentLang, 'Firma / Arbeitgeber')} <span className="text-[11px] font-normal text-slate-400">({t('common.optional', currentLang, 'optional')})</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="z. B. Freiberuflich oder Arbeitgeber..."
                    value={formData.company || ''}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          )}

          {/* General Email & Phone (Main company contact or person contact) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isCompany ? t('contact.modal_company_email', currentLang, 'Zentrale E-Mail-Adresse') : t('contact.modal_email', currentLang, 'E-Mail-Adresse')} <span className="text-[11px] font-normal text-slate-400">({t('common.optional', currentLang, 'optional')})</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder={isCompany ? 'info@firma.de' : 'kontakt@domain.de'}
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isCompany ? t('contact.modal_company_phone', currentLang, 'Zentrale Telefonnummer') : t('contact.modal_phone', currentLang, 'Telefonnummer')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="+49 (0) ..."
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Standard Hourly Rate (Stundensatz) */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
                <span>{t('contact.modal_hourly_rate', currentLang, 'Standard-Stundensatz')}</span>
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
                placeholder={t('contact.modal_hourly_rate_placeholder', currentLang, 'z.B. 95.00')}
                value={formData.default_hourly_rate ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    default_hourly_rate: val === '' ? undefined : parseFloat(val) || 0
                  });
                }}
                className="w-full pl-3 pr-16 py-2 text-xs font-mono bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-mono font-medium text-slate-400 pointer-events-none">
                {currency} / h
              </span>
            </div>
          </div>

          {/* Street & Contact Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_street', currentLang, 'Straße & Hausnummer')}
              </label>
              <input
                type="text"
                placeholder="Musterstraße 12"
                value={formData.street || ''}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_type', currentLang, 'Kontakttyp')}
              </label>
              <select
                value={formData.type || 'customer'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ContactType })}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              >
                <option value="customer">{t('contact.type_customer', currentLang, 'Kunde')}</option>
                <option value="guest">{t('contact.type_guest', currentLang, 'Gästebuch / Privat')}</option>
                <option value="vendor">{t('contact.type_vendor', currentLang, 'Lieferant')}</option>
                <option value="both">{t('contact.type_both', currentLang, 'Beide')}</option>
              </select>
            </div>
          </div>

          {/* ZIP & City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_zip', currentLang, 'Postleitzahl')}
              </label>
              <input
                type="text"
                placeholder="10115"
                value={formData.zip || ''}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_city', currentLang, 'Stadt / Ort')}
              </label>
              <input
                type="text"
                placeholder="Berlin"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Country with Live Auto-Suggest & Tax ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* LAND INPUT WITH LIVE AUTO-SUGGESTION */}
            <div ref={countryInputContainerRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('contact.modal_country', currentLang, 'Land')}
                </label>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-indigo-500" />
                  <span>Vorschläge bei Eingabe</span>
                </span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder={t('contact.modal_country_placeholder', currentLang, 'z. B. Deutschland')}
                  value={formData.country || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, country: e.target.value });
                    setIsCountryDropdownOpen(true);
                    setActiveCountryIndex(0);
                  }}
                  onFocus={() => {
                    setIsCountryDropdownOpen(true);
                    setActiveCountryIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (!isCountryDropdownOpen) {
                      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        setIsCountryDropdownOpen(true);
                        setActiveCountryIndex(0);
                        e.preventDefault();
                      }
                      return;
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveCountryIndex((prev) => 
                        prev < countrySuggestions.length - 1 ? prev + 1 : 0
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveCountryIndex((prev) => 
                        prev > 0 ? prev - 1 : countrySuggestions.length - 1
                      );
                    } else if (e.key === 'Enter') {
                      if (activeCountryIndex >= 0 && activeCountryIndex < countrySuggestions.length) {
                        e.preventDefault();
                        handleSelectCountry(countrySuggestions[activeCountryIndex]);
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsCountryDropdownOpen(false);
                      setActiveCountryIndex(-1);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  autoComplete="off"
                />

                {/* Country Suggestion Dropdown Popover */}
                {isCountryDropdownOpen && countrySuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 max-h-52 overflow-y-auto p-1.5 space-y-0.5 animate-scale-in">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t('contact.country_suggestions', currentLang, 'Vorgeschlagene Länder')}
                    </div>
                    {countrySuggestions.map((item, index) => {
                      const localizedName = getLocalizedCountryName(item, currentLang);
                      const isSelected = (formData.country || '').trim().toLowerCase() === localizedName.toLowerCase();
                      const isHighlighted = activeCountryIndex === index;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => handleSelectCountry(item)}
                          onMouseEnter={() => setActiveCountryIndex(index)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition cursor-pointer ${
                            isSelected || isHighlighted
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold' 
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base leading-none select-none">{item.flag}</span>
                            <span className="font-medium">{localizedName}</span>
                          </div>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {item.code}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('contact.modal_tax_id', currentLang, 'USt-IdNr. / Steuernummer')}
              </label>
              <input
                type="text"
                placeholder="DE 000000000 / IT01234567890"
                value={formData.taxId || ''}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
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
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:outline-none focus:border-indigo-500"
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
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold focus:outline-none focus:border-indigo-500"
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
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('contact.modal_notes', currentLang, 'Interne Notizen & Bemerkungen')}
            </label>
            <textarea
              rows={2}
              placeholder={t('contact.notes_placeholder', currentLang, 'Optionale Kundennotizen, Vereinbarungen oder Details...')}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none"
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
                  {t('contact.btn_cancel', currentLang, 'Abbrechen')}
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
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {isSubmitting 
                      ? '...' 
                      : (isEditing ? t('contact.btn_save', currentLang, 'Kontakt speichern') : t('contacts.btn_new', currentLang, 'Kontakt erstellen'))}
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
