import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  Download, 
  Building2, 
  Calendar, 
  CreditCard, 
  FileText,
  Boxes,
  Image as ImageIcon,
  Layout,
  Settings,
  Sparkles
} from 'lucide-react';
import { Invoice, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { 
  getStoredInvoiceTemplates, 
  getActiveInvoiceTemplate, 
  setActiveInvoiceTemplateId,
  generateInvoiceHtml,
  exportInvoiceToWord,
  InvoiceTemplate
} from '../lib/invoiceTemplateManager';
import { InvoiceTemplateModal } from './InvoiceTemplateModal';

interface InvoicePrintModalProps {
  invoice: Invoice;
  company: CompanyProfile;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  invoice,
  company,
  onClose
}) => {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(getStoredInvoiceTemplates);
  const [activeTemplate, setActiveTemplate] = useState<InvoiceTemplate>(getActiveInvoiceTemplate);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const handlePrint = () => {
    sounds.playClick();
    window.print();
  };

  const handleExportWord = () => {
    sounds.playClick();
    exportInvoiceToWord(activeTemplate, invoice, company, company.currency);
  };

  const handleSelectTemplate = (templateId: string) => {
    const found = templates.find(t => t.id === templateId);
    if (found) {
      setActiveTemplate(found);
      setActiveInvoiceTemplateId(found.id);
      sounds.playClick();
    }
  };

  const invoiceHtml = generateInvoiceHtml(activeTemplate, invoice, company, company.currency, false);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in print:p-0 print:bg-white">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:m-0 print:border-none print:shadow-none">
        
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  DIN-A4 Rechnungsbeleg ({invoice.number})
                </h3>
              </div>
              <p className="text-[11px] text-slate-500">
                {activeTemplate.name}
              </p>
            </div>

            {/* Template Switcher Dropdown */}
            <div className="flex items-center gap-1 ml-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 shadow-2xs">
              <Layout className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <select
                value={activeTemplate.id}
                onChange={e => handleSelectTemplate(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Open Template Editor Button */}
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Vorlage & Design bearbeiten"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportWord}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition cursor-pointer"
              title="Als Microsoft Word Dokument (.doc) herunterladen"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Word (.doc)</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Jetzt Drucken / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable DIN-A4 Sheet Container */}
        <div className="overflow-y-auto p-4 sm:p-10 bg-slate-100/60 dark:bg-slate-950 flex justify-center print-container print:p-0 print:bg-white">
          <div 
            className="relative bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-6 sm:p-12 shadow-lg rounded-xl print:shadow-none print:p-0 print:m-0 border border-slate-200/80 print:border-none select-text"
            dangerouslySetInnerHTML={{ __html: invoiceHtml }}
          />
        </div>

      </div>

      {/* Embedded Invoice Template Modal */}
      {isTemplateModalOpen && (
        <InvoiceTemplateModal
          isOpen={isTemplateModalOpen}
          onClose={() => {
            setIsTemplateModalOpen(false);
            setTemplates(getStoredInvoiceTemplates());
            setActiveTemplate(getActiveInvoiceTemplate());
          }}
          company={company}
          invoices={[invoice]}
          currency={company.currency}
          onTemplatesUpdated={() => {
            setTemplates(getStoredInvoiceTemplates());
            setActiveTemplate(getActiveInvoiceTemplate());
          }}
        />
      )}
    </div>
  );
};
