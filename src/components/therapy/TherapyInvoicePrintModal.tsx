import React from 'react';
import { X, Printer, Download, CheckCircle2, Building2 } from 'lucide-react';
import { BillingItem, Client } from './types';
import { useLanguage } from '../../lib/i18n';

interface TherapyInvoicePrintModalProps {
  billing: BillingItem;
  client?: Client;
  currency: string;
  onClose: () => void;
}

export const TherapyInvoicePrintModal: React.FC<TherapyInvoicePrintModalProps> = ({
  billing,
  client,
  currency,
  onClose
}) => {
  const lang = useLanguage();

  const handlePrint = () => {
    window.print();
  };

  const amount = Number(billing.amount) || 0;
  const taxRate = billing.taxRate || 0;
  const taxAmount = (amount * taxRate) / 100;
  const totalAmount = amount + taxAmount;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 print:m-0 print:p-0 print:border-none print:shadow-none">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-sm text-slate-800">
              {lang === 'de' ? 'Druckvorschau Praxisrechnung' : 'Invoice Print Preview'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-sm"
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

        {/* Printable Invoice Body */}
        <div className="p-8 sm:p-12 space-y-8 bg-white" id="printable-invoice">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {lang === 'de' ? 'Praxis für Psychotherapie & Beratung' : 'Practice for Therapy & Consultation'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'de' ? 'Heilpraktische / Psychotherapeutische Leistungen' : 'Therapeutic & Clinical Consultation'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                {lang === 'de' ? 'Rechnung' : 'Invoice'}
              </span>
              <div className="text-sm font-semibold text-slate-800 mt-0.5">
                {billing.invoiceNumber || `PRAXIS-${billing.id.substring(0, 6).toUpperCase()}`}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {lang === 'de' ? 'Datum:' : 'Date:'} {billing.date}
              </div>
            </div>
          </div>

          {/* Client & Recipient Information */}
          <div className="grid grid-cols-2 gap-8 text-xs">
            <div>
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                {lang === 'de' ? 'Rechnungsempfänger' : 'Invoice Recipient'}
              </span>
              <div className="font-bold text-sm text-slate-800">
                {client ? client.name : 'Klient / Patient'}
              </div>
              {client?.address && <div className="text-slate-600 mt-0.5">{client.address}</div>}
              {client && (client.zip || client.city) && (
                <div className="text-slate-600">{client.zip} {client.city}</div>
              )}
              {client?.email && <div className="text-slate-500 mt-1">{client.email}</div>}
            </div>

            <div className="text-right">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                {lang === 'de' ? 'Zahlungsziel' : 'Due Date'}
              </span>
              <div className="text-xs text-slate-700">
                {billing.dueDate || (lang === 'de' ? 'Zahlbar innerhalb von 14 Tagen' : 'Payable within 14 days')}
              </div>
              <div className="mt-2">
                <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-md ${
                  billing.status === 'paid' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {billing.status === 'paid' 
                    ? (lang === 'de' ? 'BEZAHLT' : 'PAID') 
                    : (lang === 'de' ? 'OFFEN' : 'PENDING')}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500">
                  <th className="py-2 font-semibold">{lang === 'de' ? 'Position / Leistung' : 'Item / Service'}</th>
                  <th className="py-2 text-right font-semibold">{lang === 'de' ? 'Leistungsdatum' : 'Date'}</th>
                  <th className="py-2 text-right font-semibold">{lang === 'de' ? 'Betrag' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3">
                    <div className="font-bold text-slate-800">
                      {billing.service || (lang === 'de' ? 'Psychotherapeutische Beratung' : 'Therapy Consultation')}
                    </div>
                    {billing.notes && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{billing.notes}</div>
                    )}
                  </td>
                  <td className="py-3 text-right text-slate-600">{billing.date}</td>
                  <td className="py-3 text-right font-bold text-slate-900">
                    {amount.toFixed(2)} {currency}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Calculation */}
          <div className="border-t border-slate-200 pt-4 flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{lang === 'de' ? 'Nettobetrag:' : 'Subtotal:'}</span>
                <span>{amount.toFixed(2)} {currency}</span>
              </div>
              {taxRate > 0 ? (
                <div className="flex justify-between text-slate-600">
                  <span>{lang === 'de' ? `USt. (${taxRate}%):` : `VAT (${taxRate}%):`}</span>
                  <span>{taxAmount.toFixed(2)} {currency}</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic">
                  {lang === 'de' 
                    ? 'Umsatzsteuerfrei gem. § 4 Nr. 14 UStG (Heilbehandlung)' 
                    : 'VAT exempt therapeutic service'}
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-2">
                <span>{lang === 'de' ? 'Gesamtbetrag:' : 'Total Amount:'}</span>
                <span className="text-blue-600">{totalAmount.toFixed(2)} {currency}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 pt-6 text-[11px] text-slate-400 text-center space-y-1">
            <p>{lang === 'de' ? 'Vielen Dank für das Vertrauen!' : 'Thank you for your trust!'}</p>
            <p>{lang === 'de' ? 'Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer.' : 'Please wire the amount mentioning the invoice number.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
