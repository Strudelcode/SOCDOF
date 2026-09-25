import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileText, 
  Settings, 
  Building2, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';
import { BillingItem, Client } from './types';
import { CompanyProfile } from '../../types';
import { useLanguage } from '../../lib/i18n';
import { 
  getStoredTemplates, 
  getActiveTemplate, 
  getActiveTemplateId,
  setActiveTemplateId,
  generateTherapyInvoiceHtml, 
  exportTherapyInvoiceToWord,
  TherapyInvoiceTemplate 
} from '../../lib/therapyInvoiceTemplateManager';
import { TherapyInvoiceTemplateModal } from './TherapyInvoiceTemplateModal';

interface TherapyInvoicePrintModalProps {
  billing: BillingItem;
  client?: Client;
  company?: CompanyProfile;
  currency: string;
  onClose: () => void;
}

export const TherapyInvoicePrintModal: React.FC<TherapyInvoicePrintModalProps> = ({
  billing,
  client,
  company,
  currency,
  onClose
}) => {
  const lang = useLanguage();
  const [templates, setTemplates] = useState<TherapyInvoiceTemplate[]>(getStoredTemplates);
  const [activeTemplate, setActiveTemplate] = useState<TherapyInvoiceTemplate>(getActiveTemplate);
  const [isTemplateSettingsOpen, setIsTemplateSettingsOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExportWord = () => {
    exportTherapyInvoiceToWord(activeTemplate, billing, client, company, currency);
  };

  const handleSelectTemplate = (templateId: string) => {
    const found = templates.find(t => t.id === templateId);
    if (found) {
      setActiveTemplate(found);
      setActiveTemplateId(found.id);
    }
  };

  const invoiceHtml = generateTherapyInvoiceHtml(activeTemplate, billing, client, company, currency);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
        <div className="bg-white text-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none">
          
          {/* Modal Toolbar (Hidden on Print) */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-50 border-b border-slate-200 print:hidden text-xs">
            {/* Left: Module title & template selection */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-800 hidden sm:inline">
                  {lang === 'de' ? 'Praxisrechnung' : 'Therapy Invoice'}
                </span>
              </div>

              {/* Template dropdown switcher */}
              <div className="flex items-center gap-1.5 ml-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-2xs">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <select
                  value={activeTemplate.id}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Template Edit Quick Button */}
              <button
                onClick={() => setIsTemplateSettingsOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-teal-700 hover:bg-slate-200/60 rounded-xl transition"
                title={lang === 'de' ? 'Rechnungsvorlage anpassen' : 'Customize template'}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{lang === 'de' ? 'Vorlage anpassen' : 'Edit Template'}</span>
              </button>
            </div>

            {/* Right: Actions (Word Export, Print/PDF, Close) */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportWord}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl border border-slate-200 transition shadow-2xs"
                title={lang === 'de' ? 'Als Microsoft Word Dokument (.doc) herunterladen' : 'Download Word document (.doc)'}
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>{lang === 'de' ? 'Word (.doc)' : 'Word (.doc)'}</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-bold rounded-xl transition shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{lang === 'de' ? 'Drucken / PDF' : 'Print / PDF'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Printable Invoice Document Body */}
          <div className="p-4 sm:p-10 bg-slate-100 print:p-0 print:bg-white flex justify-center">
            <div 
              className="bg-white text-slate-900 w-full max-w-[800px] p-6 sm:p-12 rounded-2xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0"
              id="printable-therapy-invoice"
              dangerouslySetInnerHTML={{ __html: invoiceHtml }}
            />
          </div>
        </div>
      </div>

      {/* Template Settings & Editor Modal */}
      {isTemplateSettingsOpen && (
        <TherapyInvoiceTemplateModal
          isOpen={isTemplateSettingsOpen}
          onClose={() => setIsTemplateSettingsOpen(false)}
          company={company}
          clients={client ? [client] : []}
          currency={currency}
          onTemplatesUpdated={() => {
            const reloaded = getStoredTemplates();
            setTemplates(reloaded);
            const active = getActiveTemplate();
            setActiveTemplate(active);
          }}
        />
      )}
    </>
  );
};
