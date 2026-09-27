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
  Code,
  FileCode,
  CheckSquare,
  ArrowRight,
  Boxes
} from 'lucide-react';
import { 
  InvoiceTemplate, 
  DEFAULT_INVOICE_TEMPLATES, 
  AVAILABLE_INVOICE_VARIABLES, 
  getStoredInvoiceTemplates, 
  saveStoredInvoiceTemplates, 
  getActiveInvoiceTemplateId, 
  setActiveInvoiceTemplateId,
  scanTemplateVariables,
  generateInvoiceHtml,
  exportInvoiceToWord,
  readUploadedTemplateFile
} from '../lib/invoiceTemplateManager';
import { Invoice, CompanyProfile } from '../types';
import { useLanguage, t } from '../lib/i18n';
import { sounds } from '../lib/sound';

interface InvoiceTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  company?: CompanyProfile;
  invoices?: Invoice[];
  currency?: string;
  onTemplatesUpdated?: () => void;
}

const COLOR_PRESETS = [
  { label: 'Royal Blue (Business)', hex: '#2563eb' },
  { label: 'Slate Dark (Modern Minimal)', hex: '#0f172a' },
  { label: 'Navy Corporate', hex: '#1e3a8a' },
  { label: 'Teal (Praxis & Healthcare)', hex: '#0d9488' },
  { label: 'Warm Amber / Rust (Studio)', hex: '#c2410c' },
  { label: 'Indigo / Violet', hex: '#6366f1' },
  { label: 'Emerald Green', hex: '#059669' },
  { label: 'Rose Accent', hex: '#e11d48' }
];

export const InvoiceTemplateModal: React.FC<InvoiceTemplateModalProps> = ({
  isOpen,
  onClose,
  company,
  invoices = [],
  currency = '€',
  onTemplatesUpdated
}) => {
  const lang = useLanguage();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(getStoredInvoiceTemplates);
  const [activeId, setActiveId] = useState<string>(getActiveInvoiceTemplateId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(getActiveInvoiceTemplateId);
  const [currentTab, setCurrentTab] = useState<'design' | 'content' | 'company' | 'variables' | 'import'>('design');
  
  // Active editing draft
  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0] || DEFAULT_INVOICE_TEMPLATES[0];
  const [draft, setDraft] = useState<InvoiceTemplate>(currentTemplate);
  
  // Responsive view tab for compact screens ('editor' | 'preview')
  const [responsiveTab, setResponsiveTab] = useState<'editor' | 'preview'>('editor');

  // Preview controls
  const [isPreviewTestMode, setIsPreviewTestMode] = useState<boolean>(true);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<number | 'test'>('test');
  const [copiedVarKey, setCopiedVarKey] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<boolean>(false);
  const [importedVarsNotice, setImportedVarsNotice] = useState<string[] | null>(null);
  const [isImportingFile, setIsImportingFile] = useState<boolean>(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const fileTemplateInputRef = useRef<HTMLInputElement | null>(null);

  // Sync draft when selected template changes
  useEffect(() => {
    const found = templates.find(t => t.id === selectedTemplateId) || templates[0];
    if (found) {
      setDraft(JSON.parse(JSON.stringify(found)));
    }
  }, [selectedTemplateId, templates]);

  if (!isOpen) return null;

  // Selected invoice for preview
  const selectedRealInvoice = previewInvoiceId !== 'test' ? invoices.find(i => i.id === previewInvoiceId) : null;

  // Real-time scanned variables in custom layout
  const scanned = scanTemplateVariables(
    draft.useCustomLayout ? (draft.customBodyTemplate || '') : `${draft.headerTitle} ${draft.headerText || ''} ${draft.footerText} ${draft.taxNote || ''}`
  );

  // Insert variable tag at cursor position
  const handleInsertVariable = (varKey: string) => {
    sounds.playClick();
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
      sounds.playSuccess();
    };
    reader.readAsDataURL(file);
  };

  // Template file upload handler (.docx / .html / .txt / .json)
  const handleTemplateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingFile(true);
    setImportStatusMessage(lang === 'de' ? 'Vorlagendatei wird geladen...' : 'Loading template file...');

    try {
      const { content, detectedVariables } = await readUploadedTemplateFile(file, (msg) => {
        setImportStatusMessage(msg);
      });

      setDraft(prev => ({
        ...prev,
        useCustomLayout: true,
        customBodyTemplate: content
      }));
      setImportedVarsNotice(detectedVariables);
      setCurrentTab('variables');
      sounds.playSuccess();
    } catch (err: any) {
      console.error('Failed to parse uploaded template file', err);
      sounds.playError();
      alert(lang === 'de' ? 'Fehler beim Lesen der Vorlagendatei: ' + (err?.message || err) : 'Error reading template file.');
    } finally {
      setIsImportingFile(false);
      setImportStatusMessage('');
      if (e.target) e.target.value = '';
    }
  };

  // Import practice / company data from company profile
  const handleImportFromCompany = () => {
    if (!company) return;
    sounds.playClick();
    setDraft(prev => ({
      ...prev,
      companyName: company.name || prev.companyName,
      companySubtitle: prev.companySubtitle || '',
      companyOwner: company.letterhead_managing_director || prev.companyOwner || '',
      companyAddress: company.street || prev.companyAddress,
      companyZipCity: company.zip_city || prev.companyZipCity,
      companyPhone: company.phone || prev.companyPhone || '',
      companyEmail: company.email || prev.companyEmail || '',
      companyWebsite: prev.companyWebsite || '',
      companyTaxId: company.tax_id || prev.companyTaxId || '',
      companyVatId: company.tax_id || prev.companyVatId || '',
      companyIban: company.iban || prev.companyIban || '',
      companyBic: company.bic || prev.companyBic || '',
      companyBankName: company.bank_name || prev.companyBankName || '',
      companyCommercialRegister: company.letterhead_commercial_register || prev.companyCommercialRegister || '',
      logoUrl: company.letterhead_photo_url || prev.logoUrl
    }));
  };

  // Save current template draft
  const handleSaveDraft = (setAsActive = false) => {
    sounds.playSuccess();
    const updatedList = templates.map(t => t.id === draft.id ? draft : t);
    
    // If new template
    const exists = updatedList.some(t => t.id === draft.id);
    const finalList = exists ? updatedList : [...updatedList, draft];

    setTemplates(finalList);
    saveStoredInvoiceTemplates(finalList);

    if (setAsActive || draft.id === activeId) {
      setActiveId(draft.id);
      setActiveInvoiceTemplateId(draft.id);
    }

    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    if (onTemplatesUpdated) onTemplatesUpdated();
  };

  // Create new blank or custom template
  const handleCreateNewTemplate = () => {
    sounds.playClick();
    const newId = `template_custom_${Date.now()}`;
    const newTemplate: InvoiceTemplate = {
      id: newId,
      name: `${lang === 'de' ? 'Neue Vorlage' : 'New Template'} ${templates.length + 1}`,
      description: lang === 'de' ? 'Individuelle Rechnungsvorlage' : 'Custom invoice template',
      presetType: 'custom',
      isDefault: false,
      showLogo: true,
      logoPosition: 'left',
      companyName: draft.companyName || company?.name || 'Ihr Unternehmen',
      companySubtitle: draft.companySubtitle || '',
      companyOwner: draft.companyOwner || company?.letterhead_managing_director || '',
      companyAddress: draft.companyAddress || company?.street || 'Musterstraße 1',
      companyZipCity: draft.companyZipCity || company?.zip_city || '10115 Berlin',
      companyPhone: draft.companyPhone || company?.phone || '',
      companyEmail: draft.companyEmail || company?.email || '',
      companyWebsite: draft.companyWebsite || '',
      companyTaxId: draft.companyTaxId || company?.tax_id || '',
      companyIban: draft.companyIban || company?.iban || '',
      companyBic: draft.companyBic || company?.bic || '',
      companyBankName: draft.companyBankName || company?.bank_name || '',
      primaryColor: '#2563eb',
      fontFamily: 'sans',
      headerTitle: 'Rechnung',
      headerText: 'Wir stellen folgende Leistungen in Rechnung:',
      footerText: 'Zahlbar innerhalb von {Zahlungsziel_Tage} Tagen ohne Abzug. Vielen Dank für Ihren Auftrag!',
      taxNote: 'Rechnungsbetrag enthält die gesetzliche Mehrwertsteuer.',
      dueDays: 14,
      showFoldMarks: true,
      useCustomLayout: false,
      createdAt: new Date().toISOString()
    };

    const nextList = [...templates, newTemplate];
    setTemplates(nextList);
    saveStoredInvoiceTemplates(nextList);
    setSelectedTemplateId(newId);
    setDraft(newTemplate);
  };

  // Duplicate current template
  const handleDuplicateTemplate = () => {
    sounds.playClick();
    const newId = `template_copy_${Date.now()}`;
    const copy: InvoiceTemplate = {
      ...draft,
      id: newId,
      name: `${draft.name} (${lang === 'de' ? 'Kopie' : 'Copy'})`,
      createdAt: new Date().toISOString()
    };
    const nextList = [...templates, copy];
    setTemplates(nextList);
    saveStoredInvoiceTemplates(nextList);
    setSelectedTemplateId(newId);
    setDraft(copy);
  };

  // Delete current template
  const handleDeleteTemplate = () => {
    if (templates.length <= 1) {
      alert(lang === 'de' ? 'Es muss mindestens eine Vorlage vorhanden sein.' : 'At least one template must remain.');
      return;
    }
    sounds.playClick();
    const nextList = templates.filter(t => t.id !== draft.id);
    setTemplates(nextList);
    saveStoredInvoiceTemplates(nextList);
    setSelectedTemplateId(nextList[0].id);
    if (activeId === draft.id) {
      setActiveId(nextList[0].id);
      setActiveInvoiceTemplateId(nextList[0].id);
    }
  };

  // Reset to factory defaults
  const handleResetDefaults = () => {
    if (confirm(lang === 'de' ? 'Möchten Sie alle Vorlagen auf die Standard-Vorlagen zurücksetzen?' : 'Reset all templates to defaults?')) {
      sounds.playClick();
      setTemplates(DEFAULT_INVOICE_TEMPLATES);
      saveStoredInvoiceTemplates(DEFAULT_INVOICE_TEMPLATES);
      setSelectedTemplateId(DEFAULT_INVOICE_TEMPLATES[0].id);
      setActiveId(DEFAULT_INVOICE_TEMPLATES[0].id);
      setActiveInvoiceTemplateId(DEFAULT_INVOICE_TEMPLATES[0].id);
      setDraft(DEFAULT_INVOICE_TEMPLATES[0]);
    }
  };

  // Render preview HTML
  const previewHtml = generateInvoiceHtml(
    draft, 
    selectedRealInvoice, 
    company, 
    currency, 
    isPreviewTestMode
  );

  return (
    <div className="fixed inset-0 z-[999999] bg-black/75 flex items-center justify-center p-3 sm:px-5 sm:pt-5 sm:pb-20 pb-16 backdrop-blur-xs overflow-hidden animate-fade-in">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[calc(100vh-5.5rem)] h-full overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Layout className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {lang === 'de' ? 'Rechnungsvorlagen & Layout-Editor' : 'Invoice Templates & Layout Editor'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                {templates.length} {lang === 'de' ? 'Vorlagen' : 'Templates'}
              </span>
              {draft.id === activeId && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{lang === 'de' ? 'Aktiver Standard' : 'Active Default'}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saveToast && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-xs animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>{lang === 'de' ? 'Vorlage gespeichert!' : 'Template saved!'}</span>
              </div>
            )}

            <button
              onClick={() => handleSaveDraft(true)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'de' ? 'Speichern & Aktivieren' : 'Save & Activate'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body Grid */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Panel: Template List & Configuration */}
          <div className={`w-full lg:w-5/12 border-r border-slate-200 dark:border-slate-800 ${
            responsiveTab === 'editor' ? 'flex' : 'hidden lg:flex'
          } flex-col bg-slate-50/50 dark:bg-slate-900/40 overflow-hidden`}>
            
            {/* Compact Toolbar: Template Selector & Section Dropdown */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shrink-0">
              {/* Row 1: Template Selector & Quick Actions */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                  {lang === 'de' ? 'Vorlage:' : 'Template:'}
                </label>
                
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer truncate"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.id === activeId ? `(${lang === 'de' ? 'Standard' : 'Default'})` : ''}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={handleCreateNewTemplate}
                    title={lang === 'de' ? 'Neue Vorlage erstellen' : 'Create new template'}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{lang === 'de' ? 'Neu' : 'New'}</span>
                  </button>
                  <button
                    onClick={handleDuplicateTemplate}
                    title={lang === 'de' ? 'Aktuelle Vorlage duplizieren' : 'Duplicate template'}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDeleteTemplate}
                    title={lang === 'de' ? 'Vorlage löschen' : 'Delete template'}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg text-xs transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: Section Dropdown Selector */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                  {lang === 'de' ? 'Bearbeiten:' : 'Edit Section:'}
                </label>
                
                <select
                  value={currentTab}
                  onChange={e => setCurrentTab(e.target.value as any)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-bold text-indigo-900 dark:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="design">
                    {lang === 'de' ? 'Design, Logo, Farben & Typografie' : lang === 'fr' ? 'Design, Logo & Typographie' : lang === 'es' ? 'Diseño, Logo & Tipografía' : 'Design, Logo & Typography'}
                  </option>
                  <option value="content">
                    {lang === 'de' ? 'Texte, Titel & Belegangaben' : lang === 'fr' ? 'Textes & Champs' : lang === 'es' ? 'Textos y Campos' : 'Texts & Document Fields'}
                  </option>
                  <option value="company">
                    {lang === 'de' ? 'Firmendaten, Adresse & Bank' : lang === 'fr' ? 'Données Société & Banque' : lang === 'es' ? 'Datos Empresa & Banco' : 'Company Data & Banking'}
                  </option>
                  <option value="variables">
                    {lang === 'de' ? 'Platzhalter & Variablen' : lang === 'fr' ? 'Variables & Modèles' : lang === 'es' ? 'Variables & Plantillas' : 'Variables & Placeholders'}
                  </option>
                  <option value="import">
                    {lang === 'de' ? 'Datei-Import (.docx / HTML)' : lang === 'fr' ? 'Importation (.docx / HTML)' : lang === 'es' ? 'Importar Archivo (.docx / HTML)' : 'File Import (.docx / HTML)'}
                  </option>
                </select>
              </div>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* TAB 1: DESIGN & LOGO */}
              {currentTab === 'design' && (
                <div className="space-y-4 text-xs">
                  {/* Template Name & Description */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Bezeichnung der Vorlage:' : 'Template Name:'}
                    </label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={e => setDraft({ ...draft, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Logo Upload & Position */}
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{lang === 'de' ? 'Firmenlogo / Sockel-Branding' : 'Company Logo / Branding'}</span>
                      </label>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.showLogo}
                          onChange={e => setDraft({ ...draft, showLogo: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span>{lang === 'de' ? 'Logo anzeigen' : 'Show logo'}</span>
                      </label>
                    </div>

                    {draft.showLogo && (
                      <div className="space-y-2">
                        {draft.logoUrl ? (
                          <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                            <img src={draft.logoUrl} alt="Logo" className="max-h-12 max-w-[120px] object-contain rounded" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] text-emerald-600 font-semibold block truncate">
                                {lang === 'de' ? '✓ Logo hinterlegt' : '✓ Logo active'}
                              </span>
                              <button
                                onClick={() => setDraft({ ...draft, logoUrl: undefined })}
                                className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                              >
                                {lang === 'de' ? 'Entfernen' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                            <p className="text-[11px] text-slate-500 mb-2">
                              {lang === 'de' ? 'PNG, JPG oder SVG (max. 2 MB)' : 'PNG, JPG, or SVG (max 2 MB)'}
                            </p>
                            <button
                              type="button"
                              onClick={() => logoInputRef.current?.click()}
                              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition cursor-pointer"
                            >
                              {lang === 'de' ? 'Logo-Datei wählen' : 'Choose Logo File'}
                            </button>
                          </div>
                        )}

                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>

                  {/* Primary Color Accent */}
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      {lang === 'de' ? 'Akzentfarbe für Belegkopf & Linien:' : 'Primary Accent Color:'}
                    </label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setDraft({ ...draft, primaryColor: c.hex })}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                          className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                            draft.primaryColor === c.hex ? 'border-white ring-2 ring-indigo-500 scale-110' : 'border-transparent hover:scale-105'
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        value={draft.primaryColor}
                        onChange={e => setDraft({ ...draft, primaryColor: e.target.value })}
                        className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0"
                      />
                    </div>
                  </div>

                  {/* Font Family */}
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      {lang === 'de' ? 'Schriftart (Typografie):' : 'Typography / Font:'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, fontFamily: 'sans' })}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          draft.fontFamily === 'sans'
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className="text-sm font-sans font-bold">Sans-Serif</div>
                        <div className="text-[10px] opacity-70">Modern & Clean</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, fontFamily: 'serif' })}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          draft.fontFamily === 'serif'
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className="text-sm font-serif font-bold">Serif</div>
                        <div className="text-[10px] opacity-70">Klassisch & Elegant</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, fontFamily: 'mono' })}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          draft.fontFamily === 'mono'
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className="text-sm font-mono font-bold">Mono</div>
                        <div className="text-[10px] opacity-70">Technisch & Klar</div>
                      </button>
                    </div>
                  </div>

                  {/* DIN 5008 Fold Marks Option */}
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {lang === 'de' ? 'DIN 5008 Falt- & Lochermarken' : 'DIN 5008 Fold & Punch Marks'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {lang === 'de' ? 'Faltmarken bei 105 mm & 210 mm für DIN-Lang-Kuverts' : 'Folds at 105 mm & 210 mm for standard envelopes'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft.showFoldMarks ?? true}
                      onChange={e => setDraft({ ...draft, showFoldMarks: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: TEXTE & BELEGANGABEN */}
              {currentTab === 'content' && (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Beleg-Überschrift (z.B. Rechnung oder Honorarabrechnung):' : 'Document Title:'}
                    </label>
                    <input
                      type="text"
                      value={draft.headerTitle}
                      onChange={e => setDraft({ ...draft, headerTitle: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Einleitungstext (Vor den Positionen):' : 'Introductory Text:'}
                    </label>
                    <textarea
                      rows={2}
                      value={draft.headerText || ''}
                      onChange={e => setDraft({ ...draft, headerText: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="z.B. Wir bedanken uns für die gute Zusammenarbeit und stellen in Rechnung:"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'de' ? 'Zahlungsziel (Tage):' : 'Due Days:'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={draft.dueDays}
                        onChange={e => setDraft({ ...draft, dueDays: parseInt(e.target.value, 10) || 14 })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'de' ? 'Steuerhinweis:' : 'Tax Exemption Note:'}
                      </label>
                      <input
                        type="text"
                        value={draft.taxNote || ''}
                        onChange={e => setDraft({ ...draft, taxNote: e.target.value })}
                        placeholder="z.B. § 19 UStG oder § 4 Nr. 14 UStG"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'de' ? 'Zahlungshinweis & Fußtext:' : 'Payment & Footer Notice:'}
                    </label>
                    <textarea
                      rows={2}
                      value={draft.footerText}
                      onChange={e => setDraft({ ...draft, footerText: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] text-slate-400">
                      {lang === 'de' ? 'Unterstützt {Zahlungsziel_Tage} und {Rechnungsnummer}' : 'Supports {Zahlungsziel_Tage} and {Rechnungsnummer}'}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 3: FIRMENDATEN */}
              {currentTab === 'company' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">
                      {lang === 'de' ? 'Firmendaten für diesen Belegkopf:' : 'Company details for header:'}
                    </span>
                    <button
                      type="button"
                      onClick={handleImportFromCompany}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg text-[11px] transition flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{lang === 'de' ? 'Aus Stammdaten laden' : 'Load from Profile'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Firmenname:</label>
                      <input
                        type="text"
                        value={draft.companyName}
                        onChange={e => setDraft({ ...draft, companyName: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Zusatz / Branche:</label>
                      <input
                        type="text"
                        value={draft.companySubtitle || ''}
                        onChange={e => setDraft({ ...draft, companySubtitle: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Inhaber / Geschäftsleitung:</label>
                      <input
                        type="text"
                        value={draft.companyOwner || ''}
                        onChange={e => setDraft({ ...draft, companyOwner: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Straße & Hausnr.:</label>
                      <input
                        type="text"
                        value={draft.companyAddress}
                        onChange={e => setDraft({ ...draft, companyAddress: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">PLZ & Ort:</label>
                      <input
                        type="text"
                        value={draft.companyZipCity}
                        onChange={e => setDraft({ ...draft, companyZipCity: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">IBAN:</label>
                      <input
                        type="text"
                        value={draft.companyIban || ''}
                        onChange={e => setDraft({ ...draft, companyIban: e.target.value })}
                        className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">BIC & Bank:</label>
                      <input
                        type="text"
                        value={draft.companyBic || ''}
                        onChange={e => setDraft({ ...draft, companyBic: e.target.value })}
                        className="w-full px-3 py-2 font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: FREIES LAYOUT & VARIABLEN-EDITOR */}
              {currentTab === 'variables' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {lang === 'de' ? 'Freies HTML-Layout aktivieren' : 'Enable Custom HTML Layout'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {lang === 'de' ? 'Volle Kontrolle über HTML & CSS mit automatischen {Variablen}' : 'Full control over HTML & CSS with template variables'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft.useCustomLayout}
                      onChange={e => setDraft({ ...draft, useCustomLayout: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Scanned Variables Info Badge */}
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {scanned.recognized.length} {lang === 'de' ? 'erkannte Variablen im Template' : 'recognized variables in template'}
                    </span>
                    {scanned.unrecognized.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                        {scanned.unrecognized.length} unbekannt
                      </span>
                    )}
                  </div>

                  {/* Click to insert variable pills */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {lang === 'de' ? 'Klicken, um Variable an Cursor-Position einzufügen:' : 'Click to insert variable:'}
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
                      {AVAILABLE_INVOICE_VARIABLES.map(v => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => handleInsertVariable(v.key)}
                          title={`${v.label} (Beispiel: ${v.example})`}
                          className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] transition cursor-pointer flex items-center gap-1"
                        >
                          <span>{v.key}</span>
                          {copiedVarKey === v.key && <Check className="w-3 h-3 text-emerald-500" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {draft.useCustomLayout && (
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        HTML Template Code:
                      </label>
                      <textarea
                        ref={textareaRef}
                        rows={10}
                        value={draft.customBodyTemplate || ''}
                        onChange={e => setDraft({ ...draft, customBodyTemplate: e.target.value })}
                        className="w-full p-2.5 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="<div>... {Rechnungsnummer} ... {Positionen_Tabelle} ...</div>"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: DATEI-IMPORT (.PDF, .DOCX, HTML, VORLAGE) */}
              {currentTab === 'import' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/40 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                          {lang === 'de' ? 'Rechnungsvorlage aus PDF, Word (.docx) oder HTML importieren' : 'Import invoice template from PDF, Word (.docx) or HTML'}
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {lang === 'de' 
                            ? 'Laden Sie eine PDF-, Word- (.docx / .doc), HTML- oder Text-Vorlagendatei hoch. Alle enthaltenen Variablen ({Rechnungsnummer}, {Kunde_Name}, {Gesamtbetrag}) werden automatisch ausgelesen und 1:1 als wiederverwendbare Vorlage übernommen.' 
                            : 'Upload a PDF, Word (.docx), HTML, or text file. Variables like {Rechnungsnummer}, {Kunde_Name}, {Gesamtbetrag} are extracted automatically.'}
                        </p>
                      </div>
                    </div>

                    {/* Supported Format Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold border border-rose-200 dark:border-rose-800">
                        📄 PDF (.pdf)
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                        📝 Word (.docx / .doc)
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                        🌐 HTML (.html)
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                        ⚙️ JSON / Text (.txt)
                      </span>
                    </div>

                    <div className="text-center p-6 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-slate-900/60 relative">
                      {isImportingFile ? (
                        <div className="py-4 space-y-3 animate-fade-in">
                          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                          <div className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                            {importStatusMessage || (lang === 'de' ? 'Vorlagendatei wird analysiert & extrahiert...' : 'Analyzing & extracting template file...')}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {lang === 'de' ? 'Verarbeitung läuft geschmeidig im Hintergrund. Die Seite bleibt voll bedienbar.' : 'Processing smoothly in background. UI remains responsive.'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2 animate-bounce-subtle" />
                          <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            {lang === 'de' ? 'PDF, Word-Dokument oder HTML-Datei hier ablegen oder auswählen' : 'Drop PDF, Word document or HTML file here'}
                          </div>
                          <p className="text-[10px] text-slate-400 mb-3">
                            .pdf, .docx, .doc, .html, .htm, .txt, .json
                          </p>
                          <button
                            type="button"
                            onClick={() => fileTemplateInputRef.current?.click()}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5 mx-auto"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{lang === 'de' ? 'Datei jetzt auswählen' : 'Select File Now'}</span>
                          </button>
                        </>
                      )}
                    </div>

                    <input
                      ref={fileTemplateInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.html,.htm,.txt,.json"
                      onChange={handleTemplateFileUpload}
                      className="hidden"
                    />

                    {importedVarsNotice && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1.5 animate-fade-in">
                        <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{lang === 'de' ? 'Dokument erfolgreich analysiert & als Vorlage übernommen!' : 'Document analyzed & converted to template!'}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-[10px] font-bold">
                            {importedVarsNotice.length} {lang === 'de' ? 'Variablen' : 'Variables'}
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          {importedVarsNotice.length > 0 ? (
                            <div className="space-y-1">
                              <div>{lang === 'de' ? 'Automatisch erkannte Platzhalter:' : 'Automatically detected variables:'}</div>
                              <div className="flex flex-wrap gap-1 pt-1">
                                {importedVarsNotice.map((v, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 rounded font-mono text-[10px] font-semibold border border-emerald-300 dark:border-emerald-700">
                                    {v}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span>{lang === 'de' ? 'Der Dokumententext wurde geladen. Sie können nun Platzhalter wie {Rechnungsnummer} oder {Gesamtbetrag} einfügen.' : 'Text loaded. You can now insert variables.'}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
                    <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <span>💡</span>
                      <span>{lang === 'de' ? 'Hinweis zu PDF- & Word-Vorlagen:' : '💡 Note on PDF & Word Templates:'}</span>
                    </div>
                    <div>
                      {lang === 'de' 
                        ? 'Geben Sie in Ihrer PDF- oder Word-Datei einfach Variablen in geschweiften Klammern an (z.B. {Rechnungsnummer}, {Datum}, {Kunde_Name}, {Gesamtbetrag}). Beim Import werden alle Variablen ausgelesen, 1:1 übergeben und bei der Erstellung echter Rechnungen automatisch mit den Echtdaten befüllt.' 
                        : 'Include variable placeholders like {Rechnungsnummer}, {Datum}, {Kunde_Name}, and {Gesamtbetrag} in your PDF or Word files. They are parsed 1:1 and populated automatically for invoices.'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions for Template Management */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{lang === 'de' ? 'Werkseinstellungen' : 'Reset to Defaults'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveDraft(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {lang === 'de' ? 'Änderungen speichern' : 'Save Draft'}
              </button>
            </div>
          </div>

          {/* Right Panel: Live DIN-A4 Sheet Preview */}
          <div className={`w-full lg:w-7/12 ${
            responsiveTab === 'preview' ? 'flex' : 'hidden lg:flex'
          } flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden`}>
            
            {/* Live Preview Toolbar */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{lang === 'de' ? 'Live-Vorschau:' : 'Live Preview:'}</span>
                </span>

                {/* Preview Switcher: Test Mode vs Real Invoices */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    onClick={() => {
                      setIsPreviewTestMode(true);
                      setPreviewInvoiceId('test');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      isPreviewTestMode 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {lang === 'de' ? '100.000 € Test-Beleg' : '100k Sample'}
                  </button>

                  {invoices.length > 0 && (
                    <button
                      onClick={() => {
                        setIsPreviewTestMode(false);
                        setPreviewInvoiceId(invoices[0].id || 'test');
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                        !isPreviewTestMode 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {lang === 'de' ? 'Echte Belegdaten' : 'Real Invoice'}
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons for Word & Print */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => exportInvoiceToWord(draft, selectedRealInvoice, company, currency)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
                  title={lang === 'de' ? 'Als Word (.doc) exportieren' : 'Export to Word (.doc)'}
                >
                  <Download className="w-3 h-3 text-blue-600" />
                  <span className="hidden sm:inline">Word (.doc)</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'de' ? 'Drucken / PDF' : 'Print / PDF'}</span>
                </button>
              </div>
            </div>

            {/* Document Render Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center items-start">
              <div 
                className="bg-white text-slate-900 w-full max-w-[760px] min-h-[900px] p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200 transition-all select-text"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>

        </div>

        {/* Bottom View Switcher Bar for compact/small screens */}
        <div className="lg:hidden no-print p-2 bg-slate-100 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-xs shrink-0">
          <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setResponsiveTab('editor');
              }}
              className={`px-4 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                responsiveTab === 'editor'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Editor' : 'Editor'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setResponsiveTab('preview');
              }}
              className={`px-4 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                responsiveTab === 'preview'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{lang === 'de' ? 'Live-Vorschau' : 'Live Preview'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
