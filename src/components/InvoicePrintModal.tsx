import React from 'react';
import { 
  Printer, 
  X, 
  Download, 
  Building2, 
  Calendar, 
  CreditCard, 
  FileText,
  Boxes,
  Image as ImageIcon
} from 'lucide-react';
import { Invoice, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';

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
  const handlePrint = () => {
    sounds.playClick();
    window.print();
  };

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${company.currency}`;
  };

  const showBg = company.letterhead_show_bg && !!company.letterhead_photo_url;
  const showFoldMarks = company.letterhead_show_fold_marks ?? true;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                DIN-A4 Rechnungsbeleg ({invoice.number})
              </h3>
              <p className="text-[11px] text-slate-500">
                {showBg ? 'Briefpapier-Hintergrundbild aktiv' : 'Standard DIN 5008 Layout'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>Jetzt Drucken / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable DIN-A4 Sheet Container */}
        <div className="overflow-y-auto p-6 sm:p-12 bg-slate-100/60 dark:bg-slate-950 flex justify-center print-container">
          <div 
            style={{
              backgroundImage: showBg ? `url(${company.letterhead_photo_url})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
            className="relative bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-10 sm:p-14 shadow-lg rounded-xl print:shadow-none print:p-0 print:m-0 flex flex-col justify-between border border-slate-200/80 print:border-none"
          >
            {/* DIN 5008 Fold & Punch Marks (Falt- & Lochermarken) */}
            {showFoldMarks && (
              <div className="absolute left-0 top-0 bottom-0 pointer-events-none print:block">
                {/* Falzmarke 1: 105mm */}
                <div className="absolute left-1 top-[105mm] w-3 h-[1px] bg-slate-400" />
                {/* Lochermarke: 148.5mm */}
                <div className="absolute left-1 top-[148.5mm] w-5 h-[1px] bg-slate-500" />
                {/* Falzmarke 2: 210mm */}
                <div className="absolute left-1 top-[210mm] w-3 h-[1px] bg-slate-400" />
              </div>
            )}

            {/* Top Sheet Content */}
            <div>
              {/* 1. Header with Company Info & Logo */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                      <Boxes className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                        {company.name}
                      </h1>
                      <p className="text-[11px] text-slate-500">{company.legal_form}</p>
                    </div>
                  </div>

                  <div className="mt-4 text-[11px] text-slate-500 leading-relaxed">
                    <div>{company.street}</div>
                    <div>{company.zip_city}</div>
                    <div>{company.country}</div>
                    <div className="mt-1">E-Mail: {company.email}</div>
                    <div>Tel: {company.phone}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg">
                    {invoice.type === 'out_invoice' ? 'Rechnung' : 'Lieferantenbeleg'}
                  </div>

                  <div className="mt-3 font-mono text-lg font-bold text-slate-900">
                    {invoice.number}
                  </div>

                  <div className="mt-2 text-xs space-y-1 text-slate-600">
                    <div>
                      <span className="text-slate-400">Rechnungsdatum: </span>
                      <strong className="font-mono text-slate-800">{new Date(invoice.date).toLocaleDateString('de-DE')}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Fälligkeitsdatum: </span>
                      <strong className="font-mono text-slate-800">{new Date(invoice.due_date).toLocaleDateString('de-DE')}</strong>
                    </div>
                    {invoice.payment_terms && (
                      <div>
                        <span className="text-slate-400">Zahlungsziel: </span>
                        <span>{invoice.payment_terms}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Recipient Address Window & DIN Sender Return Line */}
              <div className="mt-6 mb-6">
                <div className="text-[9px] text-slate-400 underline mb-1">
                  {company.name} • {company.street} • {company.zip_city}
                </div>
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
                    Rechnungsempfänger
                  </span>
                  <div className="mt-1">
                    {invoice.contact_company && (
                      <div className="font-bold text-sm text-slate-900">
                        {invoice.contact_company}
                      </div>
                    )}
                    <div className="text-xs text-slate-800 font-medium">{invoice.contact_name}</div>
                    {invoice.contact_address && (
                      <div className="text-xs text-slate-600 whitespace-pre-line mt-0.5">
                        {invoice.contact_address}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Subject Line (Betreff) */}
              <div className="mb-6">
                <h2 className="text-base font-extrabold text-slate-900">
                  {invoice.subject || company.letterhead_default_subject || `Rechnung ${invoice.number}`}
                </h2>
                {invoice.notes && (
                  <p className="text-xs text-slate-600 mt-1">{invoice.notes}</p>
                )}
              </div>

              {/* 4. Invoice Line Items Table */}
              <div className="mt-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200 bg-slate-50/80 text-slate-600">
                      <th className="py-2.5 px-3 font-bold">Pos.</th>
                      <th className="py-2.5 px-3 font-bold">Artikelbeschreibung</th>
                      <th className="py-2.5 px-3 font-bold text-right">Menge</th>
                      <th className="py-2.5 px-3 font-bold text-right">Einzelpreis</th>
                      <th className="py-2.5 px-3 font-bold text-right">MwSt.</th>
                      <th className="py-2.5 px-3 font-bold text-right">Gesamt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, index) => (
                      <tr key={item.id || index} className="text-slate-800">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{index + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{item.product_name}</div>
                          {item.sku && <div className="text-[10px] text-slate-400 font-mono">Art-Nr: {item.sku}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">{item.qty}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">{item.tax_rate}%</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 5. Totals & Tax Breakdown */}
              <div className="mt-6 flex justify-end">
                <div className="w-72 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span>Nettobetrag:</span>
                    <span className="font-mono font-semibold">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span>Umsatzsteuer (MwSt.):</span>
                    <span className="font-mono font-semibold">{formatCurrency(invoice.tax_total)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-extrabold text-slate-900">
                    <span>Gesamtbetrag (Brutto):</span>
                    <span className="font-mono">{formatCurrency(invoice.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Professional 4-Column DIN Letterhead Footer */}
            <div className="mt-12 pt-6 border-t border-slate-200 text-[10px] text-slate-500 grid grid-cols-4 gap-4">
              <div>
                <strong className="block text-slate-700 font-bold mb-0.5">Unternehmen</strong>
                <p>{company.letterhead_footer_line1 || `${company.name} • ${company.street}`}</p>
                <p>{company.zip_city}</p>
              </div>

              <div>
                <strong className="block text-slate-700 font-bold mb-0.5">Register & Leitung</strong>
                <p>{company.letterhead_managing_director || company.letterhead_footer_line2 || 'Geschäftsleitung'}</p>
                <p>{company.letterhead_commercial_register || ''}</p>
              </div>

              <div>
                <strong className="block text-slate-700 font-bold mb-0.5">Bankverbindung</strong>
                <p>{company.bank_name}</p>
                <p className="font-mono">IBAN: {company.iban}</p>
                <p className="font-mono">BIC: {company.bic}</p>
              </div>

              <div>
                <strong className="block text-slate-700 font-bold mb-0.5">Steuerangaben</strong>
                <p>USt-IdNr: {company.tax_id}</p>
                <p>{company.letterhead_footer_line4 || ''}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
