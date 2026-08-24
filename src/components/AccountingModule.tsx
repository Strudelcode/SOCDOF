import React, { useState } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  CreditCard, 
  ShoppingCart, 
  Download, 
  Printer, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  FileSpreadsheet, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter
} from 'lucide-react';
import { Invoice, PurchaseOrder, POSOrder, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';

interface AccountingModuleProps {
  invoices: Invoice[];
  purchases: PurchaseOrder[];
  posOrders: POSOrder[];
  company: CompanyProfile;
}

export const AccountingModule: React.FC<AccountingModuleProps> = ({
  invoices,
  purchases,
  posOrders,
  company
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'current_month' | 'current_quarter' | 'current_year'>('all');
  const [activeTab, setActiveTab] = useState<'bwa' | 'ustva' | 'open_items' | 'z_bon'>('bwa');

  const cur = company.currency || 'EUR';

  // Filter calculations based on period
  const filterDate = (dateStr: string) => {
    if (selectedPeriod === 'all') return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (isNaN(d.getTime())) return true;

    if (selectedPeriod === 'current_month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (selectedPeriod === 'current_quarter') {
      const q1 = Math.floor(d.getMonth() / 3);
      const q2 = Math.floor(now.getMonth() / 3);
      return q1 === q2 && d.getFullYear() === now.getFullYear();
    }
    if (selectedPeriod === 'current_year') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Invoices metrics
  const filteredInvoices = invoices.filter(inv => filterDate(inv.date));
  const postedInvoices = filteredInvoices.filter(inv => inv.status === 'posted' || inv.status === 'paid');
  const invoiceRevenueNet = postedInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
  const invoiceTaxTotal = postedInvoices.reduce((sum, inv) => sum + (inv.tax_total || 0), 0);
  const invoiceTotalGross = postedInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

  // POS metrics
  const filteredPOS = posOrders.filter(pos => filterDate(pos.date));
  const posRevenueNet = filteredPOS.reduce((sum, pos) => sum + (pos.subtotal || 0), 0);
  const posTaxTotal = filteredPOS.reduce((sum, pos) => sum + (pos.tax_total || 0), 0);
  const posTotalGross = filteredPOS.reduce((sum, pos) => sum + (pos.total || 0), 0);

  // Total Revenue
  const totalRevenueNet = invoiceRevenueNet + posRevenueNet;
  const totalRevenueGross = invoiceTotalGross + posTotalGross;

  // Purchases / Expenses metrics
  const filteredPurchases = purchases.filter(po => filterDate(po.order_date));
  const validPurchases = filteredPurchases.filter(po => po.status !== 'draft');
  const expenseTotalNet = validPurchases.reduce((sum, po) => sum + (po.subtotal || 0), 0);
  const inputTaxTotal = validPurchases.reduce((sum, po) => sum + (po.tax_total || 0), 0);
  const expenseTotalGross = validPurchases.reduce((sum, po) => sum + (po.total || 0), 0);

  // Profit (Rohertrag / Gewinn)
  const operatingProfitNet = totalRevenueNet - expenseTotalNet;

  // UStVA Tax breakdown (approximate 19% & 7%)
  const tax19Total = postedInvoices.reduce((sum, inv) => {
    const items19 = inv.items.filter(i => (i.tax_rate || 0) === 19);
    return sum + items19.reduce((s, i) => s + (i.subtotal * 0.19), 0);
  }, 0) + filteredPOS.reduce((sum, pos) => {
    const items19 = pos.items.filter(i => (i.tax_rate || 0) === 19);
    return sum + items19.reduce((s, i) => s + (i.subtotal * 0.19), 0);
  }, 0);

  const tax7Total = postedInvoices.reduce((sum, inv) => {
    const items7 = inv.items.filter(i => (i.tax_rate || 0) === 7);
    return sum + items7.reduce((s, i) => s + (i.subtotal * 0.07), 0);
  }, 0) + filteredPOS.reduce((sum, pos) => {
    const items7 = pos.items.filter(i => (i.tax_rate || 0) === 7);
    return sum + items7.reduce((s, i) => s + (i.subtotal * 0.07), 0);
  }, 0);

  const totalVatPayable = invoiceTaxTotal + posTaxTotal;
  const netVatLiability = totalVatPayable - inputTaxTotal;

  // Overdue / Open items
  const openInvoices = invoices.filter(inv => inv.status === 'posted');
  const totalOpenAmount = openInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

  // Export CSV report
  const exportCsvReport = () => {
    sounds.playImport();
    const rows = [
      ['Abrechnung & BWA Bericht', company.name],
      ['Zeitraum', selectedPeriod],
      ['Erstellt am', new Date().toLocaleString('de-DE')],
      [''],
      ['Position', 'Netto (' + cur + ')', 'USt (' + cur + ')', 'Brutto (' + cur + ')'],
      ['Umsatzerlöse Rechnungen', invoiceRevenueNet.toFixed(2), invoiceTaxTotal.toFixed(2), invoiceTotalGross.toFixed(2)],
      ['Umsatzerlöse POS Kasse', posRevenueNet.toFixed(2), posTaxTotal.toFixed(2), posTotalGross.toFixed(2)],
      ['Gesamterlöse (Umsatz)', totalRevenueNet.toFixed(2), totalVatPayable.toFixed(2), totalRevenueGross.toFixed(2)],
      ['Wareneinsatz & Einkäufe', expenseTotalNet.toFixed(2), inputTaxTotal.toFixed(2), expenseTotalGross.toFixed(2)],
      ['Rohertrag / Betriebsergebnis', operatingProfitNet.toFixed(2), '-', '-'],
      ['Umsatzsteuer-Zahllast (USt - Vorsteuer)', '-', '-', netVatLiability.toFixed(2)]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(";")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Abrechnung_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    sounds.playClick();
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Abrechnungen, BWA & Finanzen</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Betriebswirtschaftliche Auswertung, Umsatzsteuer-Voranmeldung & offene Posten
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setSelectedPeriod('all')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${selectedPeriod === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Gesamt
            </button>
            <button
              onClick={() => setSelectedPeriod('current_month')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${selectedPeriod === 'current_month' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Dieser Monat
            </button>
            <button
              onClick={() => setSelectedPeriod('current_quarter')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${selectedPeriod === 'current_quarter' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Quartal
            </button>
            <button
              onClick={() => setSelectedPeriod('current_year')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${selectedPeriod === 'current_year' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Jahr
            </button>
          </div>

          <button
            onClick={exportCsvReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSV Export</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Drucken</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Umsatzerlöse (Netto)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">
            {totalRevenueNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {cur}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Brutto: {totalRevenueGross.toFixed(2)} {cur}</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Aufwand & Einkauf (Netto)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">
            {expenseTotalNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {cur}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span>Vorsteuer: {inputTaxTotal.toFixed(2)} {cur}</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Rohertrag (Gewinn)</span>
            <div className={`w-7 h-7 rounded-lg ${operatingProfitNet >= 0 ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600'} flex items-center justify-center`}>
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-extrabold ${operatingProfitNet >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}`}>
            {operatingProfitNet.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {cur}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span>Marge: {totalRevenueNet > 0 ? ((operatingProfitNet / totalRevenueNet) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>USt-Zahllast</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">
            {netVatLiability.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {cur}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span>USt {totalVatPayable.toFixed(2)} - Vorst. {inputTaxTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold gap-4">
        <button
          onClick={() => { sounds.playClick(); setActiveTab('bwa'); }}
          className={`pb-2.5 transition border-b-2 ${activeTab === 'bwa' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          BWA & EÜR Übersicht
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveTab('ustva'); }}
          className={`pb-2.5 transition border-b-2 ${activeTab === 'ustva' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          Umsatzsteuer-Voranmeldung (UStVA)
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveTab('open_items'); }}
          className={`pb-2.5 transition border-b-2 ${activeTab === 'open_items' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          Offene Posten & Mahnwesen ({openInvoices.length})
        </button>
        <button
          onClick={() => { sounds.playClick(); setActiveTab('z_bon'); }}
          className={`pb-2.5 transition border-b-2 ${activeTab === 'z_bon' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          Tagesabschluss (Z-Bon Kasse)
        </button>
      </div>

      {/* Tab 1: BWA & EÜR */}
      {activeTab === 'bwa' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">
            Betriebswirtschaftliche Auswertung (BWA)
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2.5 flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
              <span>Umsatzerlöse aus Rechnungsfakturierung</span>
              <span>{invoiceRevenueNet.toFixed(2)} {cur}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
              <span>Umsatzerlöse Point of Sale (POS Kasse)</span>
              <span>{posRevenueNet.toFixed(2)} {cur}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 rounded-lg">
              <span>= Gesamtumsatz (Erlöse Netto)</span>
              <span>{totalRevenueNet.toFixed(2)} {cur}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>./. Wareneinsatz / Lieferanten-Einkäufe</span>
              <span className="text-rose-600">-{expenseTotalNet.toFixed(2)} {cur}</span>
            </div>
            <div className="py-3 flex items-center justify-between font-extrabold text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 rounded-xl mt-2">
              <span>= Vorläufiges Betriebsergebnis (Rohertrag)</span>
              <span>{operatingProfitNet.toFixed(2)} {cur}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: UStVA */}
      {activeTab === 'ustva' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Umsatzsteuer-Voranmeldung Aufschlüsselung
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                  <th className="pb-2">Steuersatz</th>
                  <th className="pb-2 text-right">Bemessungsgrundlage (Netto)</th>
                  <th className="pb-2 text-right">Umsatzsteuer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="py-2.5 font-medium">Lieferungen und Leistungen zu 19%</td>
                  <td className="py-2.5 text-right font-mono">{(tax19Total / 0.19 || 0).toFixed(2)} {cur}</td>
                  <td className="py-2.5 text-right font-mono font-bold">{tax19Total.toFixed(2)} {cur}</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium">Lieferungen und Leistungen zu 7%</td>
                  <td className="py-2.5 text-right font-mono">{(tax7Total / 0.07 || 0).toFixed(2)} {cur}</td>
                  <td className="py-2.5 text-right font-mono font-bold">{tax7Total.toFixed(2)} {cur}</td>
                </tr>
                <tr className="font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/50">
                  <td className="py-2.5 px-2">Summe geschuldete Umsatzsteuer</td>
                  <td className="py-2.5 text-right font-mono">{totalRevenueNet.toFixed(2)} {cur}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-indigo-600 dark:text-indigo-400">{totalVatPayable.toFixed(2)} {cur}</td>
                </tr>
                <tr className="text-rose-600">
                  <td className="py-2.5">./. Abziehbare Vorsteuerbeträge aus Einkäufen</td>
                  <td className="py-2.5 text-right font-mono">{expenseTotalNet.toFixed(2)} {cur}</td>
                  <td className="py-2.5 text-right font-mono font-bold">-{inputTaxTotal.toFixed(2)} {cur}</td>
                </tr>
                <tr className="font-extrabold text-sm bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200">
                  <td className="py-3 px-3 rounded-l-xl">Verbleibende Umsatzsteuer-Zahllast</td>
                  <td className="py-3 text-right font-mono">-</td>
                  <td className="py-3 px-3 text-right font-mono rounded-r-xl">{netVatLiability.toFixed(2)} {cur}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Offene Posten & Mahnwesen */}
      {activeTab === 'open_items' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Fällige & offene Kundenforderungen
            </h3>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded-lg">
              Offen: {totalOpenAmount.toFixed(2)} {cur}
            </span>
          </div>

          {openInvoices.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p>Keine offenen Kundenrechnungen vorhanden. Alle Forderungen sind ausgeglichen!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {openInvoices.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{inv.number}</span>
                      <span className="text-slate-400 font-normal">| {inv.contact_name || 'Kunde'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Fällig am: {inv.due_date} (Rechnungsdatum: {inv.date})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {inv.total.toFixed(2)} {cur}
                    </div>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      Offen / Zahlung ausstehend
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Tagesabschluss (Z-Bon) */}
      {activeTab === 'z_bon' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 max-w-lg mx-auto">
          <div className="text-center pb-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">KASSENABSCHLUSS (Z-BON)</h3>
            <p className="text-xs text-slate-500">{company.name}</p>
            <p className="text-[11px] text-slate-400 font-mono mt-1">Datum: {new Date().toLocaleDateString('de-DE')} {new Date().toLocaleTimeString('de-DE')}</p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span>Anzahl Bons / Verkäufe:</span>
              <span className="font-bold">{filteredPOS.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Bar-Umsatz:</span>
              <span>{filteredPOS.filter(p => p.payment_method === 'cash').reduce((s, p) => s + p.total, 0).toFixed(2)} {cur}</span>
            </div>
            <div className="flex justify-between">
              <span>Kartenzahlung (EC/Kredit):</span>
              <span>{filteredPOS.filter(p => p.payment_method === 'card').reduce((s, p) => s + p.total, 0).toFixed(2)} {cur}</span>
            </div>
            <div className="flex justify-between">
              <span>NFC / Mobilzahlung:</span>
              <span>{filteredPOS.filter(p => p.payment_method === 'nfc').reduce((s, p) => s + p.total, 0).toFixed(2)} {cur}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-sm">
              <span>GESAMT-KASSENUMSATZ:</span>
              <span>{posTotalGross.toFixed(2)} {cur}</span>
            </div>
          </div>

          <div className="pt-4 flex justify-center">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-500 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Z-Bon Beleg ausdrucken</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
