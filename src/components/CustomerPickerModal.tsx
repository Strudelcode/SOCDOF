import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Users, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Check, 
  UserCheck, 
  UserX,
  Briefcase,
  Layers,
  UserPlus,
  Edit2,
  Clock
} from 'lucide-react';
import { Contact } from '../types';
import { sounds } from '../lib/sound';
import { useLanguage, t } from '../lib/i18n';
import { ContactEditModal } from './ContactEditModal';

interface CustomerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  selectedContactId?: number | string;
  onSelectContact: (contact: Contact | null) => void;
  onContactsChange?: () => void;
  currency?: string;
}

export const CustomerPickerModal: React.FC<CustomerPickerModalProps> = ({
  isOpen,
  onClose,
  contacts,
  selectedContactId,
  onSelectContact,
  onContactsChange,
  currency = '€'
}) => {
  const lang = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Edit / Create Contact modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTypeFilter('all');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered contacts list
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      // Type filter
      if (typeFilter === 'customer' && c.type !== 'customer' && c.type !== 'both') return false;
      if (typeFilter === 'supplier' && c.type !== 'supplier' && c.type !== 'both') return false;

      // Query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (c.name || '').toLowerCase();
      const company = (c.company || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const city = (c.city || '').toLowerCase();
      const street = (c.street || '').toLowerCase();
      const taxId = (c.taxId || '').toLowerCase();

      return (
        name.includes(q) ||
        company.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        city.includes(q) ||
        street.includes(q) ||
        taxId.includes(q)
      );
    });
  }, [contacts, searchQuery, typeFilter]);

  if (!isOpen) return null;

  const handleSelect = (contact: Contact) => {
    sounds.playClick();
    onSelectContact(contact);
    onClose();
  };

  const handleClear = () => {
    sounds.playClick();
    onSelectContact(null);
    onClose();
  };

  const customerCount = contacts.filter(c => c.type === 'customer' || c.type === 'both').length;
  const supplierCount = contacts.filter(c => c.type === 'supplier' || c.type === 'both').length;

  return (
    <div 
      id="customer-picker-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="customer-picker-modal-container"
        className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
      >
        {/* Modal Header */}
        <div 
          id="customer-picker-header"
          className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                {t('support.select_customer_modal_title', undefined, 'Select Customer (Address Book / CRM)')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t('support.select_customer_modal_desc', undefined, 'Search contacts, filter by type or assign a customer to this support ticket.')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-customer-picker-new-contact"
              type="button"
              onClick={() => {
                sounds.playClick();
                setEditingContact(null);
                setIsEditModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('support.btn_new_contact', undefined, 'New Contact')}</span>
            </button>
            <button
              id="btn-customer-picker-close"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
              title={t('action.cancel', undefined, 'Close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div 
          id="customer-picker-search-bar"
          className="p-3 sm:p-4 border-b border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900 shrink-0 space-y-3"
        >
          {/* Live Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="customer-picker-search-input"
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('support.search_contacts_placeholder', undefined, 'Search name, company, email, phone, city...')}
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs sm:text-sm focus:ring-2 focus:ring-cyan-500 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Pills & Counter */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  typeFilter === 'all'
                    ? 'bg-cyan-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t('support.filter_all_contacts', undefined, 'All Contacts')} ({contacts.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('customer')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  typeFilter === 'customer'
                    ? 'bg-cyan-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {t('support.filter_customers_only', undefined, 'Customers')} ({customerCount})
              </button>
              {supplierCount > 0 && (
                <button
                  type="button"
                  onClick={() => setTypeFilter('supplier')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    typeFilter === 'supplier'
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t('support.filter_suppliers_only', undefined, 'Suppliers')} ({supplierCount})
                </button>
              )}
            </div>

            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {filteredContacts.length} / {contacts.length}
            </span>
          </div>
        </div>

        {/* Contacts List Container */}
        <div 
          id="customer-picker-list"
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 min-h-[220px] bg-slate-50/50 dark:bg-slate-900/60"
        >
          {contacts.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t('support.customer_none', undefined, '– No customer assigned –')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {t('support.no_customer_assigned_desc', undefined, 'Click to open the customer directory and link an address book contact.')}
              </p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t('support.no_contacts_matching', undefined, 'No matching contacts found.')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                "{searchQuery}"
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                }}
                className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                {t('support.filter_all_contacts', undefined, 'Reset Filters')}
              </button>
            </div>
          ) : (
            filteredContacts.map(c => {
              const isSelected = selectedContactId !== undefined && selectedContactId !== null && String(c.id) === String(selectedContactId);
              const displayName = c.name || c.company || t('support.unnamed_customer', undefined, 'Unnamed Contact');
              const initials = displayName.substring(0, 2).toUpperCase();
              const fullAddress = [c.street, c.zip, c.city].filter(Boolean).join(' ');

              return (
                <div
                  key={String(c.id || Math.random())}
                  id={`customer-item-${c.id}`}
                  onClick={() => handleSelect(c)}
                  className={`group p-3 sm:p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500 dark:border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/50 shadow-xs'
                      : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-cyan-300 dark:hover:border-cyan-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar Circle */}
                    <div className={`w-10 h-10 rounded-2xl ${c.avatar_color || 'bg-cyan-600'} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}>
                      {initials}
                    </div>

                    {/* Contact Details */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {displayName}
                        </span>
                        {c.name && c.company && (
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{c.company}</span>
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 capitalize">
                          {c.type}
                        </span>
                        {c.default_hourly_rate !== undefined && c.default_hourly_rate > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/60">
                            <Clock className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                            <span>{c.default_hourly_rate.toFixed(2)} {currency} / h</span>
                          </span>
                        )}
                      </div>

                      {/* Contact metadata row */}
                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] flex-wrap">
                        {c.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{c.phone}</span>
                          </span>
                        )}
                        {fullAddress && (
                          <span className="hidden sm:flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{fullAddress}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action / Selected Indicator */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playClick();
                        setEditingContact(c);
                        setIsEditModalOpen(true);
                      }}
                      className="p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-cyan-600 hover:border-cyan-400 dark:hover:text-cyan-400 dark:hover:border-cyan-600 transition shadow-2xs cursor-pointer"
                      title={t('support.btn_edit_contact', undefined, 'Edit Contact & Rate')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isSelected ? (
                      <span className="px-2.5 py-1 rounded-xl bg-cyan-600 text-white text-xs font-bold flex items-center gap-1 shadow-2xs">
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('support.assigned_customer_badge', undefined, 'Active')}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(c);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-semibold group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600 dark:group-hover:bg-cyan-600 dark:group-hover:text-white dark:group-hover:border-cyan-600 transition shadow-2xs cursor-pointer"
                      >
                        {t('support.btn_choose_customer', undefined, 'Select')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div 
          id="customer-picker-footer"
          className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0"
        >
          <div>
            {selectedContactId ? (
              <button
                id="btn-customer-picker-clear"
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-1.5 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>{t('support.btn_clear_customer', undefined, 'Remove Assignment')}</span>
              </button>
            ) : (
              <span className="text-xs text-slate-400">
                {contacts.length} {t('support.contacts_found_count', undefined, 'Contacts')}
              </span>
            )}
          </div>

          <button
            id="btn-customer-picker-close-footer"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {t('action.cancel', undefined, 'Close')}
          </button>
        </div>
      </div>

      {/* Edit / Create Contact Modal directly from Customer Picker */}
      <ContactEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingContact(null);
        }}
        contact={editingContact}
        currency={currency}
        onSaveSuccess={(savedContact) => {
          setIsEditModalOpen(false);
          setEditingContact(null);
          onContactsChange?.();
          onSelectContact(savedContact);
          onClose();
        }}
      />
    </div>
  );
};
