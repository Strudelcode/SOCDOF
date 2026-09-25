import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  FileText, 
  Palette, 
  Building2, 
  Check, 
  Upload, 
  Trash2, 
  Copy, 
  RotateCcw, 
  Eye, 
  Download, 
  Printer, 
  Plus, 
  AlertCircle,
  HelpCircle,
  Type,
  Layout,
  CheckCircle2,
  Code
} from 'lucide-react';
import { 
  TherapyInvoiceTemplate, 
  AVAILABLE_TEMPLATE_VARIABLES, 
  DEFAULT_THERAPY_TEMPLATES, 
  getStoredTemplates, 
  saveStoredTemplates, 
  getActiveTemplateId, 
  setActiveTemplateId,
  scanTemplateVariables,
  generateTherapyInvoiceHtml,
  exportTherapyInvoiceToWord,
  buildTemplateVariablesDictionary
} from '../../lib/therapyInvoiceTemplateManager';
import { Client, BillingItem } from './types';
import { CompanyProfile } from '../../types';
import { useLanguage } from '../../lib/i18n';

interface TherapyInvoiceTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  company?: CompanyProfile;
  clients?: Client[];
  currency?: string;
  onTemplatesUpdated?: () => void;
}

const COLOR_PRESETS = [
  { label: 'Teal (Praxis Grün/Blau)', hex: '#0d9488' },
  { label: 'Indigo (Modern)', hex: '#4f46e5' },
  { label: 'Sky Blue (Klassisch)', hex: '#0284c7' },
  { label: 'Emerald (Heilkunde)', hex: '#059669' },
  { label: 'Rose (Achtsamkeit)', hex: '#e11d48' },
  { label: 'Slate (Neutral Graphit)', hex: '#475569' }
];

export const TherapyInvoiceTemplateModal: React.FC<TherapyInvoiceTemplateModalProps> = ({
  isOpen,
  onClose,
  company,
  clients = [],
  currency = '€',
  onTemplatesUpdated
}) => {
  const lang = useLanguage();
  const [templates, setTemplates] = useState<TherapyInvoiceTemplate[]>(getStoredTemplates);
  const [activeId, setActiveId] = useState<string>(getActiveTemplateId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(getActiveTemplateId);
  const [currentTab, setCurrentTab] = useState<'editor' | 'clinic' | 'preview'>('editor');
  
  // Active editing draft
  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0] || DEFAULT_THERAPY_TEMPLATES[0];
  const [draft, setDraft] = useState<TherapyInvoiceTemplate>(currentTemplate);
  const [previewClientId, setPreviewClientId] = useState<string>('sample');
  const [copiedVarKey, setCopiedVarKey] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync draft when selected template changes
  useEffect(() => {
    const found = templates.find(t => t.id === selectedTemplateId) || templates[0];
    if (found) {
      setDraft(JSON.parse(JSON.stringify(found)));
    }
  }, [selectedTemplateId, templates]);

  if (!isOpen) return null;

  // Mock billing item for live preview
  const sampleBilling: BillingItem = {
    id: 'bill_preview_01',
    clientId: previewClientId === 'sample' ? 'client_demo' : previewClientId,
    date: new Date().toISOString().slice(0, 10),
    service: 'Psychotherapeutische Einzelsitzung & Beratung (60 Min)',
    amount: 90,
    taxRate: 0,
    status: 'ready',
    invoiceNumber: `PRAXIS-${new Date().getFullYear()}-001`,
    notes: 'Behandlung nach Heilpraktikergesetz (Psychotherapie)'
  };

  const sampleClient: Client = previewClientId === 'sample' 
    ? {
        id: 'client_demo',
        name: 'Max Mustermann',
        birthDate: '1985-05-12',
        contact: '+49 89 12345678',
        email: 'max.mustermann@beispiel.de',
        address: 'Musterstraße 12',
        zip: '80331',
        city: 'München',
        notes: '',
        createdAt: new Date().toISOString()
      }
    : (clients.find(c => c.id === previewClientId) || {
        id: 'client_demo',
        name: 'Patient / Klient',
        birthDate: '',
        contact: '',
        notes: '',
        createdAt: new Date().toISOString()
      });

  // Real-time scanned variables
  const scanned = scanTemplateVariables(
    draft.useCustomLayout ? (draft.customBodyTemplate || '') : `${draft.headerTitle} ${draft.headerText || ''} ${draft.footerText} ${draft.taxNote}`
  );

  // Insert variable tag at cursor position
  const handleInsertVariable = (varKey: string) => {
    setCopiedVarKey(varKey);
    setTimeout(() => setCopiedVarKey(null), 2000);

    if (draft.useCustomLayout && textareaRef.current) {
      const el = textareaRef.current;
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const currentVal = draft.customBodyTemplate || '';
      const newVal = currentVal.substring(0, start) + varKey + currentVal.substring(end);
      
      setDraft(prev => ({ ...prev, customBodyTemplate: newVal }));
      
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + varKey.length, start + varKey.length);
      }, 50);
    } else {
      // If clipboard fallback
      try {
        navigator.clipboard.writeText(varKey);
      } catch {}
    }
  };

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert(lang === 'de' ? 'Das Logo darf maximal 2 MB groß sein.' : 'Logo size must not exceed 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setDraft(prev => ({
        ...prev,
        logoUrl: dataUrl,
        showLogo: true
      }));
    };
    reader.readAsDataURL(file);
  };

  // Import practice data from company profile
  const handleImportFromCompany = () => {
    if (!company) return;
    setDraft(prev => ({
      ...prev,
      clinicName: company.name || prev.clinicName,
      clinicSubtitle: prev.clinicSubtitle || 'Heilpraktische Praxis & Beratung',
      clinicOwner: prev.clinicOwner || '',
      clinicAddress: company.street || prev.clinicAddress,
      clinicZipCity: company.zip_city || prev.clinicZipCity,
      clinicPhone: company.phone || prev.clinicPhone,
      clinicEmail: company.email || prev.clinicEmail,
      clinicWebsite: prev.clinicWebsite || '',
      clinicTaxId: company.tax_id || prev.clinicTaxId,
      clinicIban: company.iban || prev.clinicIban,
      clinicBic: company.bic || prev.clinicBic,
      clinicBankName: company.bank_name || prev.clinicBankName
    }));
  };

  // Save current template draft
  const handleSaveDraft = (setAsActive = false) => {
    const updatedList = templates.map(t => t.id === draft.id ? draft : t);
    
    // If new template
    const exists = updatedList.some(t => t.id === draft.id);
    const finalList = exists ? updatedList : [...updatedList, draft];

    setTemplates(finalList);
    saveStoredTemplates(finalList);

    if (setAsActive || draft.id === activeId) {
      setActiveId(draft.id);
      setActiveTemplateId(draft.id);
    }

    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    if (onTemplatesUpdated) onTemplatesUpdated();
  };

  // Create new blank or custom template
  const handleCreateNewTemplate = () => {
    const newId = `template_custom_${Date.now()}`;
    const newTemplate: TherapyInvoiceTemplate = {
      id: newId,
      name: `${lang === 'de' ? 'Neue Vorlage' : 'New Template'} ${templates.length + 1}`,
      description: lang === 'de' ? 'Individuelle Rechnungsvorlage' : 'Custom invoice template',
      isDefault: false,
      showLogo: true,
      clinicName: draft.clinicName || company?.name || 'Praxis für Psychotherapie',
      clinicSubtitle: draft.clinicSubtitle || 'Heilbehandlung / Psychologische Beratung',
      clinicOwner: draft.clinicOwner || company?.owner || '',
      clinicAddress: draft.clinicAddress || company?.street || 'Praxisstraße 10',
      clinicZipCity: draft.clinicZipCity || `${company?.zip || ''} ${company?.city || ''}`.trim(),
      clinicPhone: draft.clinicPhone || company?.phone || '',
      clinicEmail: draft.clinicEmail || company?.email || '',
      clinicWebsite: draft.clinicWebsite || company?.website || '',
      clinicTaxId: draft.clinicTaxId || company?.tax_id || '',
      clinicIban: draft.clinicIban || company?.bank_iban || '',
      clinicBic: draft.clinicBic || company?.bank_bic || '',
      clinicBankName: draft.clinicBankName || company?.bank_name || '',
      primaryColor: '#0d9488',
      fontFamily: 'sans',
      headerTitle: 'Honorarabrechnung',
      headerText: 'Für die erbrachten Leistungen erlaube ich mir folgendes Honorar in Rechnung zu stellen:',
      footerText: 'Bitte überweisen Sie den Betrag innerhalb von {Zahlungsziel_Tage} Tagen auf das Praxiskonto.',
      taxNote: 'Umsatzsteuerfrei nach § 4 Nr. 14 UStG (Heilbehandlung)',
      dueDays: 14,
      useCustomLayout: true,
      customBodyTemplate: DEFAULT_THERAPY_TEMPLATES[2].customBodyTemplate,
      createdAt: new Date().toISOString()
    };

    const nextList = [...templates, newTemplate];
    setTemplates(nextList);
    saveStoredTemplates(nextList);
    setSelectedTemplateId(newId);
    setDraft(newTemplate);
  };

  // Duplicate current template
  const handleDuplicateTemplate = () => {
    const newId = `template_copy_${Date.now()}`;
    const copy: TherapyInvoiceTemplate = {
      ...draft,
      id: newId,
      name: `${draft.name} (${lang === 'de' ? 'Kopie' : 'Copy'})`,
      createdAt: new Date().toISOString()
    };
    const nextList = [...templates, copy];
    setTemplates(nextList);
    saveStoredTemplates(nextList);
    setSelectedTemplateId(newId);
    setDraft(copy);
  };

  // Delete current template
  const handleDeleteTemplate = () => {
    if (templates.length <= 1) {
      alert(lang === 'de' ? 'Es muss mindestens eine Vorlage vorhanden sein.' : 'At least one template must remain.');
      return;
    }
    const nextList = templates.filter(t => t.id !== draft.id);
    setTemplates(nextList);
    saveStoredTemplates(nextList);
    setSelectedTemplateId(nextList[0].id);
    if (activeId === draft.id) {
      setActiveId(nextList[0].id);
      setActiveTemplateId(nextList[0].id);
    }
  };

  // Reset to factory default templates
  const handleResetDefaults = () => {
    if (confirm(lang === 'de' ? 'Möchten Sie alle Vorlagen auf die Standard-Vorlagen zurücksetzen?' : 'Reset all templates to defaults?')) {
      setTemplates(DEFAULT_THERAPY_TEMPLATES);
      saveStoredTemplates(DEFAULT_THERAPY_TEMPLATES);
      setSelectedTemplateId(DEFAULT_THERAPY_TEMPLATES[0].id);
      setActiveId(DEFAULT_THERAPY_TEMPLATES[0].id);
      setActiveTemplateId(DEFAULT_THERAPY_TEMPLATES[0].id);
      setDraft(DEFAULT_THERAPY_TEMPLATES[0]);
    }
  };

  // Render preview HTML
  const previewHtml = generateTherapyInvoiceHtml(draft, sampleBilling, sampleClient, company, currency);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  {lang === 'de' ? 'Praxis-Rechnungsvorlagen & Layout-Editor' : 'Practice Invoice Templates & Layout Editor'}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                  {templates.length} {lang === 'de' ? 'Vorlagen' : 'Templates'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'de' 
                  ? 'Erstellen und formatieren Sie PDF- & Word-Rechnungsvorlagen mit automatischen {Variablen}' 
                  : 'Design & format PDF & Word invoice templates with automatic {variables}'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveToast && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl animate-fade-in shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{lang === 'de' ? 'Gespeichert!' : 'Saved!'}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title={lang === 'de' ? 'Schließen' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Template Selector & Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              {lang === 'de' ? 'Vorlage wählen:' : 'Select Template:'}
            </span>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white shadow-2xs focus:ring-2 focus:ring-teal-500"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.id === activeId ? `(${lang === 'de' ? 'Standard' : 'Active'})` : ''}
                </option>
              ))}
            </select>

            <button
              onClick={handleCreateNewTemplate}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Neu' : 'New'}</span>
            </button>

            <button
              onClick={handleDuplicateTemplate}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl border border-slate-200 dark:border-slate-700 transition shadow-2xs"
              title={lang === 'de' ? 'Vorlage duplizieren' : 'Duplicate template'}
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'de' ? 'Duplizieren' : 'Duplicate'}</span>
            </button>

            {templates.length > 1 && (
              <button
                onClick={handleDeleteTemplate}
                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition"
                title={lang === 'de' ? 'Vorlage löschen' : 'Delete template'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Tabs */}
          <div className="flex items-center bg-slate-200/90 dark:bg-slate-800 p-1 rounded-xl border border-slate-300/60 dark:border-slate-700 font-medium">
            <button
              onClick={() => setCurrentTab('editor')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                currentTab === 'editor'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 font-bold shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-slate-700/60'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Layout & Variablen' : 'Layout & Variables'}</span>
            </button>
            <button
              onClick={() => setCurrentTab('clinic')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                currentTab === 'clinic'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 font-bold shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-slate-700/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Praxisdaten & Logo' : 'Clinic & Logo'}</span>
            </button>
            <button
              onClick={() => setCurrentTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                currentTab === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 font-bold shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-slate-700/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Echtzeit-Vorschau' : 'Live Preview'}</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: Layout & Word/HTML Template Editor */}
          {currentTab === 'editor' && (
            <div className="space-y-6">
              
              {/* Template Name & Mode Switcher */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Vorlagen-Name' : 'Template Name'}
                  </label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Vorlagen-Typ' : 'Template Layout Mode'}
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, useCustomLayout: false })}
                      className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold border transition ${
                        !draft.useCustomLayout
                          ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-500'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {lang === 'de' ? 'Standard DIN' : 'Standard DIN'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, useCustomLayout: true })}
                      className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold border transition ${
                        draft.useCustomLayout
                          ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-500'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {lang === 'de' ? 'Word / {Variablen}' : 'Word / {Variables}'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Variable Chips Palette */}
              <div className="bg-gradient-to-br from-teal-50/70 to-indigo-50/70 dark:from-slate-800/80 dark:to-slate-800/40 p-4 rounded-2xl border border-teal-200/60 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {lang === 'de' ? 'Automatische Platzhalter / Variablen (1 Klick zum Einfügen)' : 'Automatic Placeholders (Click to insert)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">
                      {lang === 'de' ? 'Erkannt im Dokument:' : 'Detected in document:'}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full font-bold">
                      {scanned.validTokens.length} {lang === 'de' ? 'Variablen aktiv' : 'active variables'}
                    </span>
                  </div>
                </div>

                {/* Categories of Variables */}
                <div className="space-y-2 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_TEMPLATE_VARIABLES.map(v => {
                      const isFound = scanned.validTokens.includes(v.key);
                      return (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => handleInsertVariable(v.key)}
                          title={`${v.desc} (z.B. ${v.example})`}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono transition shadow-2xs ${
                            isFound
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 font-bold'
                              : 'bg-white dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-slate-600'
                          }`}
                        >
                          <span>{v.key}</span>
                          {isFound ? (
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <span className="text-[9px] opacity-60 font-sans">{v.label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {copiedVarKey && (
                  <div className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold animate-fade-in flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'de' ? `Variable ${copiedVarKey} eingefügt!` : `Variable ${copiedVarKey} inserted!`}</span>
                  </div>
                )}
              </div>

              {/* Template Editor Area */}
              {draft.useCustomLayout ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-teal-600" />
                      <span>{lang === 'de' ? 'Fließtext- & Dokumenten-Vorlage (HTML / Word-Layout)' : 'Document & Word Layout Template (HTML)'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, customBodyTemplate: DEFAULT_THERAPY_TEMPLATES[2].customBodyTemplate })}
                      className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{lang === 'de' ? 'Muster-Vorlage wiederherstellen' : 'Reset to sample layout'}</span>
                    </button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    rows={16}
                    value={draft.customBodyTemplate || ''}
                    onChange={(e) => setDraft({ ...draft, customBodyTemplate: e.target.value })}
                    placeholder="HTML / Word Vorlage mit {Rechnung}, {Klient_Name}, {Gesamtbetrag}..."
                    className="w-full p-4 font-mono text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden leading-relaxed resize-none shadow-inner"
                    spellCheck={false}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {lang === 'de' 
                      ? 'Tipp: Sie können hier vollständiges HTML/CSS oder Dokumententext einfügen. Alle Platzhalter in geschweiften Klammern {Variable} werden beim Drucken und Word-Export automatisch ersetzt.'
                      : 'Tip: You can use full HTML/CSS or styled text here. All placeholders in curly braces {Variable} are evaluated automatically on print & Word export.'}
                  </p>
                </div>
              ) : (
                /* Standard Structured Fields */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'de' ? 'Rechnungstitel ({Rechnung})' : 'Invoice Title ({Rechnung})'}
                      </label>
                      <input
                        type="text"
                        value={draft.headerTitle}
                        onChange={(e) => setDraft({ ...draft, headerTitle: e.target.value })}
                        placeholder="Honorarabrechnung"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'de' ? 'Zahlungsziel in Tagen ({Zahlungsziel_Tage})' : 'Due Days ({Zahlungsziel_Tage})'}
                      </label>
                      <input
                        type="number"
                        value={draft.dueDays || 14}
                        onChange={(e) => setDraft({ ...draft, dueDays: Number(e.target.value) || 14 })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Einleitungstext / Anschreiben' : 'Introductory Salutation'}
                    </label>
                    <textarea
                      rows={2}
                      value={draft.headerText || ''}
                      onChange={(e) => setDraft({ ...draft, headerText: e.target.value })}
                      placeholder="Für die erbrachten heilkundlich-psychotherapeutischen Leistungen..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Steuerbefreiungshinweis ({Steuerhinweis})' : 'Tax Exemption Notice ({Steuerhinweis})'}
                    </label>
                    <input
                      type="text"
                      value={draft.taxNote}
                      onChange={(e) => setDraft({ ...draft, taxNote: e.target.value })}
                      placeholder="Umsatzsteuerfrei nach § 4 Nr. 14 UStG (Heilbehandlung)"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Fußzeilentext / Zahlungsanweisung' : 'Footer Instructions'}
                    </label>
                    <textarea
                      rows={2}
                      value={draft.footerText}
                      onChange={(e) => setDraft({ ...draft, footerText: e.target.value })}
                      placeholder="Bitte überweisen Sie den Betrag innerhalb von {Zahlungsziel_Tage} Tagen..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Clinic Master Data, Colors & Logo */}
          {currentTab === 'clinic' && (
            <div className="space-y-6">
              
              {/* Quick Import Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-2xl">
                <div>
                  <div className="text-xs font-bold text-teal-900 dark:text-teal-200">
                    {lang === 'de' ? 'Firmendaten aus Einstellungen übernehmen' : 'Import Company Profile'}
                  </div>
                  <div className="text-[11px] text-teal-700 dark:text-teal-400">
                    {lang === 'de' ? 'Übernimmt Praxisname, Anschrift, IBAN, BIC und Steuernummer mit 1 Klick.' : 'Auto-fills clinic name, address, IBAN, BIC and tax ID from settings.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleImportFromCompany}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  {lang === 'de' ? 'Jetzt übernehmen' : 'Import Now'}
                </button>
              </div>

              {/* Logo & Colors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                {/* Logo Section */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    {lang === 'de' ? 'Praxis-Logo' : 'Clinic Logo'}
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden p-1 shadow-2xs">
                      {draft.logoUrl ? (
                        <img src={draft.logoUrl} alt="Praxis Logo" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{lang === 'de' ? 'Logo hochladen' : 'Upload Logo'}</span>
                      </button>
                      {draft.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, logoUrl: undefined })}
                          className="text-[11px] text-rose-600 hover:underline block"
                        >
                          {lang === 'de' ? 'Logo entfernen' : 'Remove logo'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Accent Color & Typography */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {lang === 'de' ? 'Haupt-Akzentfarbe' : 'Primary Accent Color'}
                    </label>
                    <div className="flex items-center gap-2">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setDraft({ ...draft, primaryColor: c.hex })}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            draft.primaryColor === c.hex ? 'border-slate-900 dark:border-white scale-110 shadow-sm' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        />
                      ))}
                      <input
                        type="color"
                        value={draft.primaryColor || '#0d9488'}
                        onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                        className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Schriftart' : 'Font Family'}
                    </label>
                    <select
                      value={draft.fontFamily}
                      onChange={(e) => setDraft({ ...draft, fontFamily: e.target.value as any })}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                    >
                      <option value="sans">Modern Sans-Serif (Segoe UI / Arial)</option>
                      <option value="serif">Klassisch / Mediziner Serif (Georgia / Times)</option>
                      <option value="mono">Monospace (Dokumenten-Stil)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Master Data Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Praxisname ({Praxis_Name})' : 'Clinic Name ({Praxis_Name})'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicName}
                    onChange={(e) => setDraft({ ...draft, clinicName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Untertitel ({Praxis_Untertitel})' : 'Subtitle ({Praxis_Untertitel})'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicSubtitle}
                    onChange={(e) => setDraft({ ...draft, clinicSubtitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Inhaber / Therapeut ({Praxis_Inhaber})' : 'Owner ({Praxis_Inhaber})'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicOwner || ''}
                    onChange={(e) => setDraft({ ...draft, clinicOwner: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Straße & Hausnr. ({Praxis_Adresse})' : 'Street Address'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicAddress}
                    onChange={(e) => setDraft({ ...draft, clinicAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'PLZ & Ort' : 'Zip & City'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicZipCity || ''}
                    onChange={(e) => setDraft({ ...draft, clinicZipCity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Telefon ({Praxis_Telefon})' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicPhone}
                    onChange={(e) => setDraft({ ...draft, clinicPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'E-Mail ({Praxis_Email})' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={draft.clinicEmail}
                    onChange={(e) => setDraft({ ...draft, clinicEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'IBAN ({Praxis_IBAN})' : 'IBAN'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicIban}
                    onChange={(e) => setDraft({ ...draft, clinicIban: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'BIC / SWIFT ({Praxis_BIC})' : 'BIC'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicBic || ''}
                    onChange={(e) => setDraft({ ...draft, clinicBic: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Bankname ({Praxis_Bank})' : 'Bank Name'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicBankName || ''}
                    onChange={(e) => setDraft({ ...draft, clinicBankName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Steuernummer ({Praxis_Steuernummer})' : 'Tax Number'}
                  </label>
                  <input
                    type="text"
                    value={draft.clinicTaxId || ''}
                    onChange={(e) => setDraft({ ...draft, clinicTaxId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Live Real-Time Preview & Word Export */}
          {currentTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    {lang === 'de' ? 'Vorschau-Daten:' : 'Preview Data:'}
                  </span>
                  <select
                    value={previewClientId}
                    onChange={(e) => setPreviewClientId(e.target.value)}
                    className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-medium"
                  >
                    <option value="sample">Muster-Patient (Max Mustermann)</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportTherapyInvoiceToWord(draft, sampleBilling, sampleClient, company, currency)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{lang === 'de' ? 'Als Word (.doc) testen' : 'Export Word (.doc)'}</span>
                  </button>
                </div>
              </div>

              {/* Rendered Invoice Paper Container */}
              <div className="bg-slate-200/80 dark:bg-slate-950 p-4 sm:p-8 rounded-2xl border border-slate-300 dark:border-slate-800 flex justify-center overflow-x-auto">
                <div 
                  className="bg-white text-slate-900 w-full max-w-[780px] p-8 sm:p-12 rounded-xl shadow-lg border border-slate-200 min-h-[600px]"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 shrink-0 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
            >
              {lang === 'de' ? 'Werkseinstellungen' : 'Reset defaults'}
            </button>
            <label className="flex items-center gap-2 font-medium cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={activeId === draft.id}
                onChange={(e) => {
                  if (e.target.checked) {
                    setActiveId(draft.id);
                    setActiveTemplateId(draft.id);
                  }
                }}
                className="w-4 h-4 text-teal-600 rounded-md focus:ring-teal-500"
              />
              <span>{lang === 'de' ? 'Als Standard-Rechnungsvorlage verwenden' : 'Use as active default invoice template'}</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition font-medium"
            >
              {lang === 'de' ? 'Schließen' : 'Close'}
            </button>
            <button
              type="button"
              onClick={() => handleSaveDraft(activeId === draft.id)}
              className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition"
            >
              <Check className="w-4 h-4" />
              <span>{lang === 'de' ? 'Vorlage speichern' : 'Save Template'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
