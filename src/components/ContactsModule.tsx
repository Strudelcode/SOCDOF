import React, { useState } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { Contact, ContactType, Invoice } from '../types';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';
import { t, useLanguage } from '../lib/i18n';

interface ContactsModuleProps {
  contacts: Contact[];
  invoices: Invoice[];
  onRefresh: () => void;
  onCreateInvoiceForContact: (contact: Contact) => void;
  currency: string;
}

export const ContactsModule: React.FC<ContactsModuleProps> = ({
  contacts,
  invoices,
  onRefresh,
  onCreateInvoiceForContact,
  currency = '€'
}) => {
  const currentLang = useLanguage();
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'vendor'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // Single Edit / Create Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);

  // Batch Multiple Contacts Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchRows, setBatchRows] = useState<Array<{ name: string; email: string; company: string; phone: string; type: ContactType }>>([
    { name: '', email: '', company: '', phone: '', type: 'customer' },
    { name: '', email: '', company: '', phone: '', type: 'customer' },
    { name: '', email: '', company: '', phone: '', type: 'customer' }
  ]);

  // Import Modal (CSV / Outlook / vCard)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedPreview, setImportedPreview] = useState<Contact[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');

  // Filtered contacts
  const filteredContacts = contacts.filter((c) => {
    const matchesType = 
      filterType === 'all' || 
      c.type === filterType || 
      c.type === 'both';

    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q));

    return matchesType && matchesSearch;
  });

  const handleOpenCreateModal = () => {
    sounds.playClick();
    setEditingContact({
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
      notes: ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (c: Contact, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sounds.playClick();
    setEditingContact({ ...c });
    setIsEditModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact?.name || !editingContact?.email) {
      sounds.playError();
      return;
    }

    try {
      if (editingContact.id) {
        await db.contacts.update(editingContact.id, editingContact);
        if (selectedContact?.id === editingContact.id) {
          setSelectedContact(editingContact as Contact);
        }
      } else {
        const newId = await db.contacts.add({
          name: editingContact.name,
          company: editingContact.company || '',
          email: editingContact.email,
          phone: editingContact.phone || '',
          type: (editingContact.type as ContactType) || 'customer',
          street: editingContact.street || '',
          zip: editingContact.zip || '',
          city: editingContact.city || '',
          country: editingContact.country || 'Deutschland',
          taxId: editingContact.taxId || '',
          notes: editingContact.notes || '',
          avatar_color: 'bg-indigo-600',
          createdAt: new Date().toISOString()
        });
        const created = await db.contacts.get(newId);
        if (created) setSelectedContact(created);
      }

      sounds.playSuccess();
      setIsEditModalOpen(false);
      setEditingContact(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  // Batch multiple contacts handler
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(r => r.name.trim() !== '' && r.email.trim() !== '');
    if (validRows.length === 0) {
      alert('Bitte füllen Sie mindestens einen Kontakt mit Name und E-Mail aus.');
      sounds.playError();
      return;
    }

    try {
      const contactsToAdd: Contact[] = validRows.map((r, idx) => ({
        name: r.name.trim(),
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
      const parsedContacts: Contact[] = [];

      if (file.name.endsWith('.vcf') || file.name.endsWith('.vcard')) {
        // Simple vCard parser
        const vcards = text.split(/BEGIN:VCARD/i).filter(Boolean);
        for (const card of vcards) {
          const fnMatch = card.match(/FN:(.+)/i);
          const emailMatch = card.match(/EMAIL[^:]*:(.+)/i);
          const orgMatch = card.match(/ORG:(.+)/i);
          const telMatch = card.match(/TEL[^:]*:(.+)/i);

          const name = fnMatch ? fnMatch[1].trim() : '';
          const email = emailMatch ? emailMatch[1].trim() : '';
          if (name || email) {
            parsedContacts.push({
              name: name || 'Unbenannter Kontakt',
              email: email || 'keine-mail@kontakt.local',
              company: orgMatch ? orgMatch[1].replace(/;/g, ' ').trim() : '',
              phone: telMatch ? telMatch[1].trim() : '',
              type: 'customer',
              createdAt: new Date().toISOString()
            });
          }
        }
      } else {
        // CSV / Outlook parser
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length >= 2) {
          const delimiter = lines[0].includes(';') ? ';' : ',';
          const header = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

          const nameIdx = header.findIndex(h => h.includes('name') || h.includes('vorname') || h.includes('first') || h.includes('nachname'));
          const emailIdx = header.findIndex(h => h.includes('mail') || h.includes('e-mail'));
          const compIdx = header.findIndex(h => h.includes('firma') || h.includes('company') || h.includes('organisation') || h.includes('unternehm'));
          const phoneIdx = header.findIndex(h => h.includes('tel') || h.includes('phone') || h.includes('mobil'));
          const cityIdx = header.findIndex(h => h.includes('stadt') || h.includes('city') || h.includes('ort'));

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
            const name = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : `Kontakt ${i}`;
            const email = emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : `kontakt_${i}@import.local`;
            const company = compIdx !== -1 && cols[compIdx] ? cols[compIdx] : '';
            const phone = phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx] : '';
            const city = cityIdx !== -1 && cols[cityIdx] ? cols[cityIdx] : '';

            parsedContacts.push({
              name,
              email,
              company,
              phone,
              city,
              type: 'customer',
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      setImportedPreview(parsedContacts);
      sounds.playImport();
      setIsImportModalOpen(true);
    } catch (err) {
      console.error(err);
      sounds.playError();
      alert('Fehler beim Lesen der Importdatei.');
    }
  };

  const handleConfirmImport = async () => {
    if (importedPreview.length === 0) return;
    try {
      await db.contacts.bulkAdd(importedPreview);
      sounds.playSuccess();
      setIsImportModalOpen(false);
      setImportedPreview([]);
      alert(`${importedPreview.length} Kontakte erfolgreich importiert!`);
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleExportCsv = () => {
    sounds.playClick();
    const headers = ['Name', 'Firma', 'E-Mail', 'Telefon', 'Typ', 'Strasse', 'PLZ', 'Stadt', 'Land', 'UStId'];
    const rows = contacts.map(c => [
      `"${c.name}"`,
      `"${c.company || ''}"`,
      `"${c.email}"`,
      `"${c.phone || ''}"`,
      `"${c.type}"`,
      `"${c.street || ''}"`,
      `"${c.zip || ''}"`,
      `"${c.city || ''}"`,
      `"${c.country || ''}"`,
      `"${c.taxId || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odoo_kontakte_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    sounds.playSuccess();
  };

  const handleDeleteContact = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sounds.playWarning();
    if (!confirm('Diesen Kontakt wirklich unwiderruflich aus der Datenbank löschen?')) return;

    try {
      await db.contacts.delete(id);
      sounds.playDelete();
      if (selectedContact?.id === id) {
        setSelectedContact(null);
      }
      onRefresh();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  // Invoices linked to currently selected contact
  const contactInvoices = selectedContact 
    ? invoices.filter(inv => inv.contact_id === selectedContact.id)
    : [];

  const contactTotalRevenue = contactInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);

  const contactOpenReceivables = contactInvoices
    .filter(inv => inv.status === 'posted')
    .reduce((sum, inv) => sum + inv.total, 0);

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('contact.btn_new', currentLang, 'New Contact')}</span>
          </button>

          <button
            onClick={() => { sounds.playClick(); setIsBatchModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>{t('contacts.btn_batch', currentLang, '+ Batch Add')}</span>
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

          <button
            onClick={handleExportCsv}
            title={t('contacts.btn_export_csv', currentLang, 'Export all contacts as CSV')}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto">
          <button
            onClick={() => { sounds.playClick(); setFilterType('all'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filterType === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {t('contacts.filter_all', currentLang, 'All')} ({contacts.length})
          </button>
          <button
            onClick={() => { sounds.playClick(); setFilterType('customer'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filterType === 'customer' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {t('contacts.filter_customers', currentLang, 'Customers')}
          </button>
          <button
            onClick={() => { sounds.playClick(); setFilterType('vendor'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filterType === 'vendor' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {t('contacts.filter_vendors', currentLang, 'Suppliers')}
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

      {/* 3. Main Split View: Contact Cards / Table & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Contact List / Cards Grid */}
        <div className={`${selectedContact ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
          {filteredContacts.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs font-medium">{t('contacts.empty_list', currentLang, 'No contacts found.')}</p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
              >
                {t('contacts.btn_create_first', currentLang, '+ Create First Contact Now')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredContacts.map((c) => {
                const isSelected = selectedContact?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => { sounds.playClick(); setSelectedContact(c); }}
                    className={`p-4 rounded-2xl border transition cursor-pointer text-left ${isSelected ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500 shadow-md ring-1 ring-emerald-500/30' : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${c.avatar_color || 'bg-indigo-600'} text-white flex items-center justify-center font-bold text-xs shadow-xs`}>
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
                            {c.name}
                          </h4>
                          {c.company && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                              {c.company}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${c.type === 'customer' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' : c.type === 'vendor' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400' : 'bg-amber-100 text-amber-800'}`}>
                        {c.type === 'customer' ? t('contact.type_customer', currentLang, 'Customer') : c.type === 'vendor' ? t('contact.type_vendor', currentLang, 'Supplier') : t('contacts.type_partner', currentLang, 'Partner')}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      {c.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.city && (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{c.city}, {c.country}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contact Detail Panel */}
        {selectedContact && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-5 animate-fade-in">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl ${selectedContact.avatar_color || 'bg-emerald-600'} text-white flex items-center justify-center font-extrabold text-sm shadow-md`}>
                  {selectedContact.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {selectedContact.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedContact.company || t('contacts.individual_customer', currentLang, 'Individual Customer')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => handleOpenEditModal(selectedContact, e)}
                  className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteContact(selectedContact.id!, e)}
                  className="p-2 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedContact(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onCreateInvoiceForContact(selectedContact)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>{t('contacts.btn_create_invoice', currentLang, 'Create Invoice')}</span>
              </button>
            </div>

            {/* Financial KPIs for this contact */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{t('contacts.kpi_paid_total', currentLang, 'Total Paid')}</span>
                <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {contactTotalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currency}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{t('contacts.kpi_open_receivables', currentLang, 'Open Receivables')}</span>
                <div className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                  {contactOpenReceivables.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currency}
                </div>
              </div>
            </div>

            {/* Contact Details List */}
            <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">{t('contact.modal_email', currentLang, 'Email Address')}</span>
                <a href={`mailto:${selectedContact.email}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  {selectedContact.email}
                </a>
              </div>

              {selectedContact.phone && (
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">{t('contact.modal_phone', currentLang, 'Phone Number')}</span>
                  <span>{selectedContact.phone}</span>
                </div>
              )}

              {selectedContact.street && (
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">{t('contacts.field_address', currentLang, 'Address')}</span>
                  <span>{selectedContact.street}, {selectedContact.zip} {selectedContact.city}</span>
                </div>
              )}

              {selectedContact.taxId && (
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">{t('contact.modal_tax_id', currentLang, 'Tax ID / VAT No.')}</span>
                  <span className="font-mono">{selectedContact.taxId}</span>
                </div>
              )}

              {selectedContact.fiscal_code && (
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Codice Fiscale</span>
                  <span className="font-mono">{selectedContact.fiscal_code}</span>
                </div>
              )}

              {(selectedContact.sdi_recipient_code || selectedContact.pec) && (
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-1">
                    Italienische E-Rechnung (SdI)
                  </span>
                  {selectedContact.sdi_recipient_code && (
                    <div className="text-[11px] flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Codice Destinatario:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedContact.sdi_recipient_code}</span>
                    </div>
                  )}
                  {selectedContact.pec && (
                    <div className="text-[11px] flex items-center justify-between mt-0.5">
                      <span className="text-slate-500 dark:text-slate-400">PEC-Adresse:</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{selectedContact.pec}</span>
                    </div>
                  )}
                  {selectedContact.is_public_admin && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded">
                      🏛️ Pubblica Amministrazione (FPA12)
                    </span>
                  )}
                </div>
              )}

              {selectedContact.notes && (
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">{t('contact.modal_notes', currentLang, 'Internal Notes')}</span>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    {selectedContact.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Single Edit / Create Contact Modal */}
      {isEditModalOpen && editingContact && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  {editingContact.id ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {editingContact.id 
                      ? t('contact.modal_edit_title', currentLang, 'Edit Contact') 
                      : t('contact.modal_create_title', currentLang, 'Create New Contact')}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('contact.title', currentLang, 'Contacts & Address Book')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-3.5 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_name', currentLang, 'Full Name *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('contact.modal_name_placeholder', currentLang, 'e.g. Dr. Alex Weber')}
                    value={editingContact.name || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_company', currentLang, 'Company / Business')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('contact.modal_company_placeholder', currentLang, 'e.g. Tech Solutions AG')}
                    value={editingContact.company || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, company: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_email', currentLang, 'Email Address *')}
                  </label>
                  <input
                    type="email"
                    required
                    placeholder={t('contact.modal_email_placeholder', currentLang, 'contact@domain.com')}
                    value={editingContact.email || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_phone', currentLang, 'Phone Number')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('contact.modal_phone_placeholder', currentLang, '+1 (555) 000-0000')}
                    value={editingContact.phone || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_street', currentLang, 'Street & House No.')}
                  </label>
                  <input
                    type="text"
                    value={editingContact.street || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, street: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_type', currentLang, 'Contact Type')}
                  </label>
                  <select
                    value={editingContact.type || 'customer'}
                    onChange={(e) => setEditingContact({ ...editingContact, type: e.target.value as ContactType })}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  >
                    <option value="customer">{t('contact.type_customer', currentLang, 'Customer')}</option>
                    <option value="vendor">{t('contact.type_vendor', currentLang, 'Supplier / Vendor')}</option>
                    <option value="both">{t('contact.type_both', currentLang, 'Both')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_zip', currentLang, 'Postal Code / ZIP')}
                  </label>
                  <input
                    type="text"
                    placeholder="10115"
                    value={editingContact.zip || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, zip: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_city', currentLang, 'City / Town')}
                  </label>
                  <input
                    type="text"
                    placeholder="Berlin"
                    value={editingContact.city || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_country', currentLang, 'Country')}
                  </label>
                  <input
                    type="text"
                    placeholder="Deutschland"
                    value={editingContact.country || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, country: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('contact.modal_tax_id', currentLang, 'Tax ID / VAT No.')}
                  </label>
                  <input
                    type="text"
                    placeholder="DE 000000000 / IT01234567890"
                    value={editingContact.taxId || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, taxId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Italian E-Invoicing / SdI Fields */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    🇮🇹 Italienische E-Rechnung (FatturaPA / SdI)
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingContact.is_public_admin || false}
                      onChange={(e) => setEditingContact({ ...editingContact, is_public_admin: e.target.checked })}
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
                      value={editingContact.fiscal_code || ''}
                      onChange={(e) => setEditingContact({ ...editingContact, fiscal_code: e.target.value.toUpperCase() })}
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
                      placeholder={editingContact.is_public_admin ? 'z.B. UF6Z01 (6 Zeichen)' : '0000000 (7 Zeichen)'}
                      value={editingContact.sdi_recipient_code || ''}
                      onChange={(e) => setEditingContact({ ...editingContact, sdi_recipient_code: e.target.value.toUpperCase() })}
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
                      value={editingContact.pec || ''}
                      onChange={(e) => setEditingContact({ ...editingContact, pec: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('contact.modal_notes', currentLang, 'Internal Notes & Remarks')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('contact.notes_placeholder', currentLang, 'Optional customer notes, terms or contact person...')}
                  value={editingContact.notes || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {t('contact.btn_cancel', currentLang, 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition"
                >
                  {t('contact.btn_save', currentLang, 'Save Contact')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

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
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('contacts.import_modal_title', currentLang, 'Import Contacts')}: {importFileName}
                </h3>
                <p className="text-xs text-slate-500">
                  {importedPreview.length} {t('contacts.import_valid_count', currentLang, 'valid contacts detected')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5 font-bold">{t('contact.modal_name', currentLang, 'Name')}</th>
                    <th className="p-2.5 font-bold">{t('contact.modal_company', currentLang, 'Company')}</th>
                    <th className="p-2.5 font-bold">{t('contact.modal_email', currentLang, 'Email')}</th>
                    <th className="p-2.5 font-bold">{t('contact.modal_phone', currentLang, 'Phone')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {importedPreview.slice(0, 10).map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-medium text-slate-900 dark:text-white">{c.name}</td>
                      <td className="p-2.5 text-slate-500">{c.company || '—'}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{c.email}</td>
                      <td className="p-2.5 text-slate-500">{c.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importedPreview.length > 10 && (
                <div className="p-2 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30">
                  ... {t('contacts.import_more_count', currentLang, 'and')} {importedPreview.length - 10} {t('contact.title', currentLang, 'more contacts')}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
              >
                {t('contact.btn_cancel', currentLang, 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-xs transition"
              >
                {importedPreview.length} {t('contacts.btn_confirm_import', currentLang, 'Import into Database')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
