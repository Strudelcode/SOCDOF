import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  UserPlus, 
  Search, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Receipt, 
  Plus, 
  FileText, 
  Check, 
  X, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Tag,
  Trash2,
  Edit2,
  Upload,
  Download,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Share2,
  CreditCard,
  Clock,
  BookOpen,
  ChevronDown
} from 'lucide-react';
import { Contact, ContactType, Invoice, CompanyProfile } from '../types';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';
import { t, useLanguage, formatSystemDate } from '../lib/i18n';
import { generateContactEml } from '../lib/emlGenerator';
import { downloadVCard } from '../lib/vcardGenerator';
import { 
  parseContactsCsv, 
  parseContactsVcard, 
  exportContactsToCsv, 
  exportContactsToVCard, 
  downloadFile, 
  sanitizeLegacyContacts 
} from '../lib/contactImportExport';
import { ContactEditModal } from './ContactEditModal';
import { ContactDetailModal } from './ContactDetailModal';

interface ContactsModuleProps {
  contacts: Contact[];
  invoices: Invoice[];
  company?: CompanyProfile;
  onRefresh: () => void;
  onCreateInvoiceForContact: (contact: Contact) => void;
  currency: string;
}

export const ContactsModule: React.FC<ContactsModuleProps> = ({
  contacts,
  invoices,
  company,
  onRefresh,
  onCreateInvoiceForContact,
  currency = '€'
}) => {
  const currentLang = useLanguage();
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'vendor' | 'guest'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // Single Edit / Create Modal & Sequential Batch Mode
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSequentialCreate, setIsSequentialCreate] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);

  // Batch Multiple Contacts Modal (Fast matrix table)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchRows, setBatchRows] = useState<Array<{ name: string; email: string; company: string; phone: string; type: ContactType }>>([
    { name: '', email: '', company: '', phone: '', type: 'customer' },
    { name: '', email: '', company: '', phone: '', type: 'customer' },
    { name: '', email: '', company: '', phone: '', type: 'customer' }
  ]);

  // Import Modal (CSV / Outlook / vCard)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetType, setImportTargetType] = useState<ContactType>('guest');
  const [importedPreview, setImportedPreview] = useState<Contact[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');

  // Export dropdown
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Auto-clean any legacy dummy emails (like kontakt_X@import.local) from previous flawed imports
  useEffect(() => {
    sanitizeLegacyContacts().then((cleanedCount) => {
      if (cleanedCount > 0) {
        onRefresh();
      }
    });
  }, []);

  // Category counts
  const customerCount = contacts.filter(c => c.type === 'customer' || c.type === 'both').length;
  const vendorCount = contacts.filter(c => c.type === 'vendor' || c.type === 'both').length;
  const guestCount = contacts.filter(c => c.type === 'guest').length;

  // Filtered contacts
  const filteredContacts = contacts.filter((c) => {
    const matchesType = 
      filterType === 'all' || 
      c.type === filterType || 
      (filterType !== 'guest' && c.type === 'both');

    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q));

    return matchesType && matchesSearch;
  });

  const handleOpenCreateModal = () => {
    sounds.playClick();
    setEditingContact(null);
    setIsSequentialCreate(false);
    setIsEditModalOpen(true);
  };

  const handleOpenBatchCreateModal = () => {
    sounds.playClick();
    setEditingContact(null);
    setIsSequentialCreate(true);
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (c: Contact, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sounds.playClick();
    setIsSequentialCreate(false);
    setEditingContact({ ...c });
    setIsEditModalOpen(true);
  };

  // Batch multiple contacts handler
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(r => r.name.trim() !== '' || r.company.trim() !== '');
    if (validRows.length === 0) {
      alert('Bitte füllen Sie mindestens einen Kontakt mit Name oder Firma aus.');
      sounds.playError();
      return;
    }

    try {
      const contactsToAdd: Contact[] = validRows.map((r, idx) => ({
        name: r.name.trim() || r.company.trim(),
        company: r.company.trim(),
        email: r.email.trim(),
        phone: r.phone.trim(),
        type: r.type,
        country: 'Deutschland',
        avatar_color: idx % 2 === 0 ? 'bg-indigo-600' : 'bg-emerald-600',
        createdAt: new Date().toISOString()
      }));

      await db.contacts.bulkAdd(contactsToAdd);
      sounds.playSuccess();
      setIsBatchModalOpen(false);
      setBatchRows([
        { name: '', email: '', company: '', phone: '', type: 'customer' },
        { name: '', email: '', company: '', phone: '', type: 'customer' },
        { name: '', email: '', company: '', phone: '', type: 'customer' }
      ]);
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  // Parse CSV or vCard for import
  const handleFileUploadForImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    try {
      const text = await file.text();
      let parsedContacts: Contact[] = [];

      if (file.name.endsWith('.vcf') || file.name.endsWith('.vcard')) {
        parsedContacts = parseContactsVcard(text, importTargetType);
      } else {
        parsedContacts = parseContactsCsv(text, importTargetType);
      }

      if (parsedContacts.length === 0) {
        sounds.playWarning();
        alert(t('contacts.empty_list', currentLang, 'Keine gültigen Kontakte in der Datei gefunden.'));
        return;
      }

      setImportedPreview(parsedContacts);
      sounds.playImport();
      setIsImportModalOpen(true);
    } catch (err) {
      console.error(err);
      sounds.playError();
      alert('Fehler beim Lesen der Importdatei: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      e.target.value = '';
    }
  };

  const handleTargetTypeChange = (newType: ContactType) => {
    setImportTargetType(newType);
    setImportedPreview(prev => prev.map(c => ({ ...c, type: newType })));
  };

  const handleRemovePreviewRow = (index: number) => {
    sounds.playClick();
    setImportedPreview(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirmImport = async () => {
    if (importedPreview.length === 0) return;
    try {
      await db.contacts.bulkAdd(importedPreview);
      sounds.playSuccess();
      setIsImportModalOpen(false);
      const count = importedPreview.length;
      setImportedPreview([]);
      alert(`${count} Kontakte erfolgreich importiert!`);
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleExportCsv = (onlyFiltered = false) => {
    sounds.playClick();
    const list = onlyFiltered ? filteredContacts : contacts;
    if (list.length === 0) {
      alert('Keine Kontakte zum Exportieren vorhanden.');
      return;
    }
    const csvContent = exportContactsToCsv(list, ';');
    const filename = `kontakte_export_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
    sounds.playSuccess();
    setIsExportDropdownOpen(false);
  };

  const handleExportVcf = (onlyFiltered = false) => {
    sounds.playClick();
    const list = onlyFiltered ? filteredContacts : contacts;
    if (list.length === 0) {
      alert('Keine Kontakte zum Exportieren vorhanden.');
      return;
    }
    const vcfContent = exportContactsToVCard(list);
    const filename = `kontakte_export_${new Date().toISOString().split('T')[0]}.vcf`;
    downloadFile(filename, vcfContent, 'text/vcard;charset=utf-8;');
    sounds.playSuccess();
    setIsExportDropdownOpen(false);
  };

  const handleDeleteContact = async (id: number | string, skipConfirm = false, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!skipConfirm) {
      sounds.playWarning();
      if (!confirm(t('contact.delete_confirm', currentLang, 'Diesen Kontakt wirklich unwiderruflich aus der Datenbank löschen?'))) return;
    }

    try {
      await db.contacts.delete(Number(id));
      sounds.playDelete();
      if (selectedContact?.id === Number(id)) {
        setSelectedContact(null);
      }
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('contact.title', currentLang, 'Contacts & Address Book')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {contacts.length} {t('invoice.entries', currentLang, 'entries')} ({t('contacts.filter_customers', currentLang, 'Customers')} &amp; {t('contacts.filter_vendors', currentLang, 'Suppliers')})
            </p>
          </div>
        </div>

        {/* Actions: Neu, Mehrere Kontakte, Import CSV/Outlook, Export */}
        <div className="flex flex-wrap items-center gap-2 relative">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('contact.btn_new', currentLang, 'New Contact')}</span>
          </button>

          <button
            onClick={handleOpenBatchCreateModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
            title={t('contacts.sequential_mode_banner', currentLang, 'Batch create contacts one after another with full details')}
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>{t('contacts.btn_batch', currentLang, '+ Batch Add Multiple')}</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition">
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>{t('contacts.btn_import', currentLang, 'CSV / Outlook Import')}</span>
            <input
              type="file"
              accept=".csv,.vcf,.vcard,text/csv"
              onChange={handleFileUploadForImport}
              className="hidden"
            />
          </label>

          {/* Export Dropdown Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { sounds.playClick(); setIsExportDropdownOpen(prev => !prev); }}
              title={t('contacts.btn_export_csv', currentLang, 'Export all contacts')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {isExportDropdownOpen && (
              <div 
                className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 animate-scale-in text-xs space-y-1"
                onMouseLeave={() => setIsExportDropdownOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('contacts.export_options', currentLang, 'Kontakte exportieren')}
                </div>
                <button
                  type="button"
                  onClick={() => handleExportCsv(false)}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">CSV / Excel ({contacts.length})</div>
                    <div className="text-[10px] text-slate-500">{t('contacts.export_all', currentLang, 'Alle Kontakte exportieren')}</div>
                  </div>
                </button>
                {filteredContacts.length !== contacts.length && (
                  <button
                    type="button"
                    onClick={() => handleExportCsv(true)}
                    className="w-full text-left px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">CSV (Filter: {filteredContacts.length})</div>
                      <div className="text-[10px] text-slate-500">{t('contacts.export_filtered', currentLang, 'Aktuelle Filteransicht')}</div>
                    </div>
                  </button>
                )}
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={() => handleExportVcf(false)}
                  className="w-full text-left px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">vCard (.vcf) ({contacts.length})</div>
                    <div className="text-[10px] text-slate-500">Outlook, Apple &amp; Android</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => { sounds.playClick(); setFilterType('all'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${filterType === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {t('contacts.filter_all', currentLang, 'All')} ({contacts.length})
          </button>
          <button
            onClick={() => { sounds.playClick(); setFilterType('customer'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${filterType === 'customer' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {t('contacts.filter_customers', currentLang, 'Customers')} ({customerCount})
          </button>
          <button
            onClick={() => { sounds.playClick(); setFilterType('guest'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${filterType === 'guest' ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
          >
            <BookOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>{t('contacts.filter_guestbook', currentLang, 'Gästebuch / Adressbuch')}</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 rounded-full font-bold">
              {guestCount}
            </span>
          </button>
          <button
            onClick={() => { sounds.playClick(); setFilterType('vendor'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${filterType === 'vendor' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {t('contacts.filter_vendors', currentLang, 'Suppliers')} ({vendorCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('contacts.search_placeholder', currentLang, 'Search contact or company...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 3. Contact Cards Grid (Full-Width Responsive Grid) */}
      {filteredContacts.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
          <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
          <p className="text-xs font-medium">{t('contacts.empty_list', currentLang, 'No contacts found.')}</p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
          >
            {t('contacts.btn_create_first', currentLang, '+ Create First Contact Now')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredContacts.map((c) => {
            return (
              <div
                key={c.id}
                onClick={() => { sounds.playClick(); setSelectedContact(c); }}
                className="group p-4 rounded-2xl border transition cursor-pointer text-left bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${c.avatar_color || 'bg-indigo-600'} text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0`}>
                      {c.name ? c.name.substring(0, 2).toUpperCase() : (c.company ? c.company.substring(0, 2).toUpperCase() : 'KD')}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {c.name || c.company || t('contact.individual_customer', currentLang, 'Individual Customer')}
                      </h4>
                      {c.company && c.name && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                          {c.company}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      c.type === 'customer' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' 
                        : c.type === 'vendor' 
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400' 
                        : c.type === 'guest'
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-400'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                    }`}>
                      {c.type === 'customer' 
                        ? t('contact.type_customer', currentLang, 'Customer') 
                        : c.type === 'vendor' 
                        ? t('contact.type_vendor', currentLang, 'Supplier') 
                        : c.type === 'guest'
                        ? t('contact.type_guest', currentLang, 'Gästebuch / Privat')
                        : t('contacts.type_partner', currentLang, 'Partner')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditModal(c, e)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title={t('contact.edit_contact', currentLang, 'Edit Contact')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  {c.default_hourly_rate !== undefined && c.default_hourly_rate > 0 && (
                    <div className="flex items-center gap-1.5 font-bold font-mono text-cyan-700 dark:text-cyan-400">
                      <Clock className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      <span>{c.default_hourly_rate.toFixed(2)} {currency} / h</span>
                    </div>
                  )}
                  {c.email && !c.email.includes('@import.local') && !c.email.includes('@kontakt.local') && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.city && (
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.city}{c.country ? `, ${c.country}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contact Detail In-App Popup Modal */}
      <ContactDetailModal
        isOpen={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        contact={selectedContact}
        invoices={invoices}
        company={company}
        currency={currency}
        onEdit={(contactToEdit) => {
          handleOpenEditModal(contactToEdit);
        }}
        onDelete={(id) => {
          handleDeleteContact(id, true);
        }}
        onCreateInvoice={(contactForInv) => {
          onCreateInvoiceForContact(contactForInv);
        }}
      />

      {/* 4. Single Edit / Create / Sequential Batch Contact Modal */}
      <ContactEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setIsSequentialCreate(false);
          setEditingContact(null);
        }}
        contact={editingContact}
        currency={currency}
        initialSequentialMode={isSequentialCreate}
        onSaveSuccess={(savedContact) => {
          if (selectedContact?.id === savedContact.id || !selectedContact) {
            setSelectedContact(savedContact);
          }
          onRefresh();
        }}
        onBatchComplete={() => {
          onRefresh();
        }}
      />

      {/* 5. Batch Multiple Contacts Modal */}
      {isBatchModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('contacts.batch_modal_title', currentLang, 'Create Multiple Contacts at Once')}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchModalOpen(false);
                    handleOpenBatchCreateModal();
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition"
                >
                  {t('contacts.sequential_mode_badge', currentLang, 'Batch Entry')} →
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveBatch} className="space-y-3">
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {batchRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 items-center">
                    <span className="col-span-1 text-[11px] font-bold text-slate-400 text-center">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      placeholder={t('contact.modal_name', currentLang, 'Full Name') + ' *'}
                      value={row.name}
                      onChange={(e) => {
                        const updated = [...batchRows];
                        updated[idx].name = e.target.value;
                        setBatchRows(updated);
                      }}
                      className="col-span-3 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                    />
                    <input
                      type="email"
                      placeholder={t('contact.modal_email', currentLang, 'Email Address') + ' *'}
                      value={row.email}
                      onChange={(e) => {
                        const updated = [...batchRows];
                        updated[idx].email = e.target.value;
                        setBatchRows(updated);
                      }}
                      className="col-span-3 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder={t('contact.modal_company', currentLang, 'Company')}
                      value={row.company}
                      onChange={(e) => {
                        const updated = [...batchRows];
                        updated[idx].company = e.target.value;
                        setBatchRows(updated);
                      }}
                      className="col-span-3 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                    />
                    <select
                      value={row.type}
                      onChange={(e) => {
                        const updated = [...batchRows];
                        updated[idx].type = e.target.value as ContactType;
                        setBatchRows(updated);
                      }}
                      className="col-span-2 px-1.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                    >
                      <option value="customer">{t('contact.type_customer', currentLang, 'Customer')}</option>
                      <option value="vendor">{t('contact.type_vendor', currentLang, 'Supplier')}</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setBatchRows([...batchRows, { name: '', email: '', company: '', phone: '', type: 'customer' }]);
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                >
                  {t('contacts.btn_add_batch_row', currentLang, '+ Add Another Row')}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBatchModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                  >
                    {t('contact.btn_cancel', currentLang, 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition"
                  >
                    {t('contacts.btn_save_batch', currentLang, 'Save All Rows')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 6. Import Preview Modal */}
      {isImportModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('contacts.import_modal_title', currentLang, 'Import Contacts')}: <span className="font-mono text-indigo-600 dark:text-indigo-400">{importFileName}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {importedPreview.length} {t('contacts.import_valid_count', currentLang, 'valid contacts detected')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Category Selector */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {t('contacts.import_category_label', currentLang, 'Importieren als Kategorie:')}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Kontakte ohne E-Mail werden sauber mit Name/Firma und Telefon gespeichert.
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleTargetTypeChange('guest')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                    importTargetType === 'guest'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{t('contact.type_guest', currentLang, 'Gästebuch')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTargetTypeChange('customer')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    importTargetType === 'customer'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {t('contact.type_customer', currentLang, 'Kunden')}
                </button>
                <button
                  type="button"
                  onClick={() => handleTargetTypeChange('vendor')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    importTargetType === 'vendor'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {t('contact.type_vendor', currentLang, 'Lieferanten')}
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                  <tr>
                    <th className="p-2.5 font-bold">{t('contact.modal_name', currentLang, 'Name')}</th>
                    <th className="p-2.5 font-bold">{t('contact.modal_company', currentLang, 'Company')}</th>
                    <th className="p-2.5 font-bold">{t('contact.modal_email', currentLang, 'Email')}</th>
                    <th className="p-2.5 font-bold">{t('contact.modal_phone', currentLang, 'Phone')}</th>
                    <th className="p-2.5 font-bold text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {importedPreview.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 group">
                      <td className="p-2.5 font-medium text-slate-900 dark:text-white">{c.name}</td>
                      <td className="p-2.5 text-slate-500">{c.company || '—'}</td>
                      <td className="p-2.5">
                        {c.email ? (
                          <span className="text-slate-700 dark:text-slate-300">{c.email}</span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Keine E-Mail</span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-500">{c.phone || '—'}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePreviewRow(i)}
                          className="text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                          title="Eintrag entfernen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                {importedPreview.length} Kontakte werden übernommen
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  {t('contact.btn_cancel', currentLang, 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importedPreview.length === 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {importedPreview.length} {t('contacts.btn_confirm_import', currentLang, 'Import into Database')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
