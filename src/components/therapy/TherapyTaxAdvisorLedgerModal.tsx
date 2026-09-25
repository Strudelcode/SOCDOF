import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Plus, 
  Trash2, 
  Edit2, 
  Calendar, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Wallet, 
  Landmark, 
  Sliders, 
  Check, 
  Save, 
  RotateCcw,
  Clock,
  Search,
  Filter
} from 'lucide-react';
import { 
  LedgerTransaction, 
  MonthlyLedgerData, 
  getMonthNames,
  buildUnifiedTransactionsList, 
  calculateYearlyLedger, 
  getInitialCarryOver, 
  saveInitialCarryOver, 
  getManualLedgerEntries, 
  saveManualLedgerEntries, 
  downloadTaxAdvisorExcel, 
  downloadMonthlyCsv, 
  formatShortDate 
} from '../../lib/taxAdvisorLedgerManager';
import { getLedgerTexts, getEffectiveQuickTemplates } from '../../lib/ledgerTemplates';
import { formatNumberDE } from '../../lib/formatters';
import { PracticeData, Client } from './types';
import { Invoice, PurchaseOrder, CompanyProfile } from '../../types';
import { useLanguage } from '../../lib/i18n';

interface TherapyTaxAdvisorLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceData?: PracticeData;
  invoices?: Invoice[];
  purchases?: PurchaseOrder[];
  company?: CompanyProfile;
  currency?: string;
}

export const TherapyTaxAdvisorLedgerModal: React.FC<TherapyTaxAdvisorLedgerModalProps> = ({
  isOpen,
  onClose,
  practiceData,
  invoices,
  purchases,
  company,
  currency = '€'
}) => {
  const lang = useLanguage();
  const t = useMemo(() => getLedgerTexts(lang), [lang]);
  const monthNames = useMemo(() => getMonthNames(lang), [lang]);
  const currentYearNow = new Date().getFullYear();
  const currentMonthNow = new Date().getMonth();

  const [selectedYear, setSelectedYear] = useState<number>(currentYearNow);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNow);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'bank'>('all');

  // Owner Name (editable or defaults to practice owner / company owner)
  const [ownerName, setOwnerName] = useState<string>(() => {
    return company?.owner || company?.name || '';
  });
  const [isEditingOwner, setIsEditingOwner] = useState<boolean>(false);
  const displayOwnerName = useMemo(() => {
    if (!ownerName) return '';
    const lower = ownerName.trim().toLowerCase();
    if (lower === 'your company name' || lower === 'firmenname' || lower === 'ihr firmenname') return '';
    return ownerName.trim();
  }, [ownerName]);

  // Initial Carry-Over Modal / State
  const [isCarryOverModalOpen, setIsCarryOverModalOpen] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState<number>(() => getInitialCarryOver(selectedYear).cash);
  const [initialBankInput, setInitialBankInput] = useState<number>(() => getInitialCarryOver(selectedYear).bank);

  // Manual Transaction Modal State
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<LedgerTransaction | null>(null);

  // Refresh trigger for manual entries
  const [manualRefreshKey, setManualRefreshKey] = useState<number>(0);

  // Gather unified transactions
  const allTransactions = useMemo(() => {
    return buildUnifiedTransactionsList(practiceData, invoices, purchases);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceData, invoices, purchases, manualRefreshKey]);

  // Calculate 12-month ledger
  const yearlyLedger = useMemo(() => {
    return calculateYearlyLedger(selectedYear, allTransactions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, allTransactions, manualRefreshKey]);

  const currentMonthData = yearlyLedger[selectedMonth] || yearlyLedger[0];

  // Filtered transactions for the selected month
  const filteredMonthTransactions = useMemo(() => {
    return currentMonthData.transactions.filter(t => {
      const matchesSearch = !searchQuery || 
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.clientName && t.clientName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMethod = methodFilter === 'all' || 
        (methodFilter === 'cash' && t.paymentMethod === 'cash') ||
        (methodFilter === 'bank' && t.paymentMethod === 'bank');

      return matchesSearch && matchesMethod;
    });
  }, [currentMonthData, searchQuery, methodFilter]);

  if (!isOpen) return null;

  // Save Initial Carry-Over
  const handleSaveCarryOver = () => {
    saveInitialCarryOver(selectedYear, {
      cash: Number(initialCashInput) || 0,
      bank: Number(initialBankInput) || 0
    });
    setIsCarryOverModalOpen(false);
    setManualRefreshKey(k => k + 1);
  };

  // Add / Save manual transaction
  const handleSaveManualTransaction = (tx: LedgerTransaction) => {
    const existing = getManualLedgerEntries();
    const idx = existing.findIndex(e => e.id === tx.id);
    let next: LedgerTransaction[];
    if (idx >= 0) {
      next = [...existing];
      next[idx] = tx;
    } else {
      next = [tx, ...existing];
    }
    saveManualLedgerEntries(next);
    setIsTransactionModalOpen(false);
    setEditingTransaction(null);
    setManualRefreshKey(k => k + 1);
  };

  // Delete manual transaction
  const handleDeleteTransaction = (id: string) => {
    const existing = getManualLedgerEntries();
    const next = existing.filter(e => e.id !== id);
    saveManualLedgerEntries(next);
    setManualRefreshKey(k => k + 1);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 pb-16 sm:pb-16 print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[86vh] max-h-[860px] overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none">
        
        {/* Top Header & Actions Toolbar (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0 print:hidden text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1B365D] to-teal-600 text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {t.modalTitle}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#1B365D] dark:bg-blue-950/80 dark:text-blue-300 font-mono">
                  {selectedYear}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold text-xs text-slate-800 dark:text-white shadow-2xs"
            >
              {[2024, 2025, 2026, 2027, 2028].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Starting Balance Setting */}
            <button
              onClick={() => {
                const init = getInitialCarryOver(selectedYear);
                setInitialCashInput(init.cash);
                setInitialBankInput(init.bank);
                setIsCarryOverModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-600 transition shadow-2xs"
              title={t.carryOverModalTitle}
            >
              <Sliders className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{t.btnJanCarryOver}</span>
            </button>

            {/* Add Manual Transaction */}
            <button
              onClick={() => {
                const yearStr = String(selectedYear);
                const monthStr = String(selectedMonth + 1).padStart(2, '0');
                const todayStr = new Date().toISOString().slice(8, 10);
                setEditingTransaction({
                  id: `manual_${Date.now()}`,
                  date: `${yearStr}-${monthStr}-${todayStr}`,
                  type: 'expense',
                  paymentMethod: 'cash',
                  description: '',
                  amount: 0,
                  category: 'Ausgabe / Material',
                  source: 'manual',
                  createdAt: new Date().toISOString()
                });
                setIsTransactionModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.btnAddEntry}</span>
            </button>

            {/* Download Excel (.xls / .xml multi-sheet) */}
            <button
              onClick={() => downloadTaxAdvisorExcel(selectedYear, ownerName, yearlyLedger, lang)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1B365D] hover:bg-[#152a48] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition"
              title={t.btnDownloadExcel}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.btnDownloadExcel}</span>
            </button>

            {/* Print / PDF */}
            <button
              onClick={handlePrint}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition"
              title={t.btnPrint}
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 12 Monthly Tabs Navigation (Excel Style) */}
        <div className="flex items-center gap-1.5 px-6 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0 print:hidden text-xs">
          {monthNames.map((mName, idx) => {
            const isSelected = selectedMonth === idx;
            const mData = yearlyLedger[idx];
            const hasTx = mData && mData.transactions.length > 0;

            return (
              <button
                key={mName}
                onClick={() => setSelectedMonth(idx)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-[#1B365D] dark:bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700'
                }`}
              >
                <span>{mName}</span>
                {hasTx && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {mData.transactions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Document Body (Styled 1:1 like the Excel Sheet) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950">
          <div 
            className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 mx-auto w-full max-w-[960px] h-fit min-h-full p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 print:bg-white print:text-black print:shadow-none print:border-none print:p-0 print:max-w-none font-sans"
            id="printable-tax-advisor-ledger"
          >
            {/* Sheet Title */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#1B365D] dark:text-blue-400 tracking-tight uppercase">
                  {t.sheetTitle}{displayOwnerName ? ` - ${displayOwnerName}` : ''}
                </h1>
                {!isEditingOwner ? (
                  <button
                    onClick={() => setIsEditingOwner(true)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 print:hidden"
                    title={lang === 'de' ? 'Namen anpassen' : 'Edit name'}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1 print:hidden">
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={() => setIsEditingOwner(false)}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Line 3: Zeitraum */}
            <div className="flex items-center gap-4 mb-5 text-sm">
              <span className="font-bold text-slate-700 dark:text-slate-300">{t.period}:</span>
              <span className="font-extrabold text-base text-slate-900 dark:text-white border-b border-slate-400 dark:border-slate-600 pb-0.5 pr-8">
                {currentMonthData.monthName} {selectedYear}
              </span>
            </div>

            {/* Summary Box with Clear Kassa & Bank Column Headers */}
            <div className="mb-6 overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 shadow-xs w-full">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#1B365D] dark:bg-slate-800 text-white font-bold border-b border-[#0F172A] dark:border-slate-700">
                    <th className="py-2.5 px-4">{t.summaryHeader}</th>
                    <th className="py-2.5 px-4 text-right w-24 sm:w-28 border-r border-[#0F172A]/40 dark:border-slate-700/60">{t.cashCol}</th>
                    <th className="py-2.5 px-4 text-right w-24 sm:w-28 border-r border-[#0F172A]/40 dark:border-slate-700/60">{t.bankCol}</th>
                    <th className="py-2.5 px-4 text-right w-24 sm:w-28">{t.totalCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Übertrag Vormonat */}
                  <tr className="bg-[#1B365D] dark:bg-slate-800 text-white font-bold border-b border-[#0F172A] dark:border-slate-700">
                    <td className="py-2.5 px-4 text-xs tracking-wide">
                      {selectedMonth === 0 ? t.carryOverYear : t.carryOverPrev}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono w-24 sm:w-28">
                      {formatNumberDE(currentMonthData.carryOverCash)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono w-24 sm:w-28">
                      {formatNumberDE(currentMonthData.carryOverBank)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono w-24 sm:w-28 bg-[#152a48] dark:bg-slate-950 font-bold text-blue-100 dark:text-blue-300">
                      {formatNumberDE(currentMonthData.carryOverTotal)}
                    </td>
                  </tr>

                  {/* Row 2: Summe Einnahmen */}
                  <tr className="bg-slate-100 dark:bg-slate-850 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-300 dark:border-slate-700">
                    <td className="py-2 px-4 text-emerald-800 dark:text-emerald-400">
                      {t.incomeSum}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {formatNumberDE(currentMonthData.incomeCash)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {formatNumberDE(currentMonthData.incomeBank)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono bg-slate-200 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 font-extrabold">
                      {formatNumberDE(currentMonthData.totalIncome)}
                    </td>
                  </tr>
                  {/* Row 3: Summe Ausgaben */}
                  <tr className="bg-slate-100 dark:bg-slate-850 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-300 dark:border-slate-700">
                    <td className="py-2 px-4 text-rose-800 dark:text-rose-400">
                      {t.expenseSum}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-rose-700 dark:text-rose-400">
                      {formatNumberDE(currentMonthData.expenseCash)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-rose-700 dark:text-rose-400">
                      {formatNumberDE(currentMonthData.expenseBank)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono bg-slate-200 dark:bg-slate-800 text-rose-800 dark:text-rose-300 font-extrabold">
                      {formatNumberDE(currentMonthData.totalExpense)}
                    </td>
                  </tr>

                  {/* Row 4: Aktueller Kassastand */}
                  <tr className="bg-[#1B365D] dark:bg-blue-950 text-white font-black text-sm border-t-2 border-blue-400/30">
                    <td className="py-2.5 px-4">
                      {t.balance}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatNumberDE(currentMonthData.currentBalanceCash)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {formatNumberDE(currentMonthData.currentBalanceBank)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono bg-[#152a48] dark:bg-blue-900 font-black text-white">
                      {formatNumberDE(currentMonthData.currentBalanceTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Quick Filter Bar (Search & Cash/Bank toggle, hidden on Print) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 print:hidden text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="relative w-60">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none focus:border-[#1B365D] dark:focus:border-blue-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
                  <button
                    onClick={() => setMethodFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      methodFilter === 'all' ? 'bg-[#1B365D] dark:bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t.filterAll}
                  </button>
                  <button
                    onClick={() => setMethodFilter('cash')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      methodFilter === 'cash' ? 'bg-[#1B365D] dark:bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t.filterCash}
                  </button>
                  <button
                    onClick={() => setMethodFilter('bank')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      methodFilter === 'bank' ? 'bg-[#1B365D] dark:bg-blue-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {t.filterBank}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                <span>{t.monthSummaryText(filteredMonthTransactions.length)}</span>
                <button
                  onClick={() => downloadMonthlyCsv(currentMonthData, ownerName)}
                  className="text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Main Detailed Transactions Grid (1:1 with Excel format) */}
            <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#1B365D] dark:bg-slate-800 text-white font-bold text-center border-b border-[#0F172A] dark:border-slate-700">
                    <th className="py-2.5 px-3 w-12 border-r border-[#0F172A]/40 dark:border-slate-700">{t.nr}</th>
                    <th className="py-2.5 px-3 w-20 border-r border-[#0F172A]/40 dark:border-slate-700">{t.method}</th>
                    <th className="py-2.5 px-3 w-24 border-r border-[#0F172A]/40 dark:border-slate-700">{t.date}</th>
                    <th className="py-2.5 px-4 text-left border-r border-[#0F172A]/40 dark:border-slate-700">{t.description}</th>
                    <th className="py-2.5 px-4 text-right w-28 border-r border-[#0F172A]/40 dark:border-slate-700">{t.income}</th>
                    <th className="py-2.5 px-4 text-right w-28 border-r border-[#0F172A]/40 dark:border-slate-700">{t.expense}</th>
                    <th className="py-2.5 px-2 w-16 print:hidden">{t.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredMonthTransactions.length === 0 ? (
                    // Render 8 empty rows matching empty excel grid with zebra striping
                    [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <tr key={i} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors h-8">
                        <td className="py-2 px-3 text-center text-slate-400 dark:text-slate-600 font-mono border-r border-slate-200 dark:border-slate-800">{i}</td>
                        <td className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-800"></td>
                        <td className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-800"></td>
                        <td className="py-2 px-4 border-r border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 italic">{i === 1 ? t.noEntriesMonth : ''}</td>
                        <td className="py-2 px-4 text-right border-r border-slate-200 dark:border-slate-800"></td>
                        <td className="py-2 px-4 text-right border-r border-slate-200 dark:border-slate-800"></td>
                        <td className="py-2 px-2 print:hidden"></td>
                      </tr>
                    ))
                  ) : (
                    filteredMonthTransactions.map((tx, idx) => {
                      const nr = idx + 1;
                      const isCash = tx.paymentMethod === 'cash';
                      const methodTag = isCash ? 'K' : 'B';
                      const isManual = tx.source === 'manual';

                      return (
                        <tr key={tx.id} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors h-8">
                          <td className="py-1.5 px-3 text-center font-mono font-medium text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            {nr}
                          </td>
                          <td className="py-1.5 px-3 text-center border-r border-slate-200 dark:border-slate-800">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                              isCash 
                                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300/40 dark:border-amber-700/50' 
                                : 'bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-300 border border-blue-300/40 dark:border-blue-700/50'
                            }`}>
                              {methodTag}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-center font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            {formatShortDate(tx.date)}
                          </td>
                          <td className="py-1.5 px-4 text-slate-900 dark:text-slate-100 font-medium border-r border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <span>{tx.description}</span>
                              {tx.source === 'therapy_billing' && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 rounded font-semibold print:hidden">
                                  Praxis
                                </span>
                              )}
                              {tx.source === 'trip' && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-semibold print:hidden">
                                  Fahrten
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-800">
                            {tx.type === 'income' ? formatNumberDE(tx.amount) : ''}
                          </td>
                          <td className="py-1.5 px-4 text-right font-mono font-bold text-rose-700 dark:text-rose-400 border-r border-slate-200 dark:border-slate-800">
                            {tx.type === 'expense' ? formatNumberDE(tx.amount) : ''}
                          </td>
                          <td className="py-1.5 px-2 text-center print:hidden">
                            {isManual && (
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                                title={lang === 'de' ? 'Manuelle Buchung löschen' : 'Delete entry'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Legend */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div>
                <span>{t.legend}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 shrink-0 print:hidden text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            {t.yearSummaryText(selectedYear, allTransactions.length)}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition"
          >
            {t.btnClose}
          </button>
        </div>

      </div>

      {/* Starting Balance (January Carry-Over) Modal */}
      {isCarryOverModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t.carryOverModalTitle}</span>
              </h3>
              <button onClick={() => setIsCarryOverModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.carryOverNote}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {t.carryOverCashLabel}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={initialCashInput}
                  onChange={(e) => setInitialCashInput(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {t.carryOverBankLabel}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={initialBankInput}
                  onChange={(e) => setInitialBankInput(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCarryOverModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                {t.btnCancel}
              </button>
              <button
                type="button"
                onClick={handleSaveCarryOver}
                className="px-4 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm transition"
              >
                {t.btnSave}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Manual Transaction Modal */}
      {isTransactionModalOpen && editingTransaction && (
        <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t.modalAddTitle}</span>
              </h3>
              <button onClick={() => { setIsTransactionModalOpen(false); setEditingTransaction(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Templates Selection */}
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 text-xs">
                {lang === 'de' ? 'Schnellvorlagen:' : lang === 'en' ? 'Quick Templates:' : lang === 'fr' ? 'Modèles rapides :' : 'Plantillas rápidas:'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {getEffectiveQuickTemplates().map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setEditingTransaction({
                        ...editingTransaction,
                        type: tpl.type,
                        paymentMethod: tpl.paymentMethod,
                        category: tpl.category,
                        description: tpl.defaultDescription[lang] || tpl.defaultDescription.de
                      });
                    }}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 transition"
                  >
                    {tpl.label[lang] || tpl.label.de}
                  </button>
                ))}
              </div>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveManualTransaction(editingTransaction);
              }}
              className="space-y-4 text-xs"
            >
              {/* Type Switcher: Ausgabe vs Einnahme */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTransaction({ ...editingTransaction, type: 'expense' })}
                  className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition ${
                    editingTransaction.type === 'expense'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-500'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>{t.typeExpense}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTransaction({ ...editingTransaction, type: 'income' })}
                  className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition ${
                    editingTransaction.type === 'income'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t.typeIncome}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    {t.fieldDate} *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingTransaction.date}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    {t.fieldMethod}
                  </label>
                  <select
                    value={editingTransaction.paymentMethod}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-semibold"
                  >
                    <option value="cash">{t.cashCol}</option>
                    <option value="bank">{t.bankCol}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {t.fieldDesc} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Büromaterial_Einkauf_Quittung_12 oder Raummiete_Januar"
                  value={editingTransaction.description}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {t.fieldAmount} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingTransaction.amount || ''}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: Number(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-mono text-sm font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsTransactionModalOpen(false); setEditingTransaction(null); }}
                  className="px-3.5 py-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-[#1B365D] hover:bg-[#152a48] dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl shadow-md transition"
                >
                  {t.btnSave}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
