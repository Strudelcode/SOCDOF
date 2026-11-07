import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Receipt, 
  Calendar, 
  Printer, 
  Mail, 
  FileText, 
  Check, 
  X, 
  Clock, 
  Download,
  Building2,
  Euro,
  DollarSign
} from 'lucide-react';
import { Invoice, CompanyProfile, Contact } from '../types';
import { sounds } from '../lib/sound';
import { t, useLanguage, formatSystemDate } from '../lib/i18n';
import { db } from '../lib/db';

interface DunningModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  company: CompanyProfile;
  contacts?: Contact[];
  onRefresh?: () => void;
  currency?: string;
}

export const DunningModal: React.FC<DunningModalProps> = ({
  isOpen,
  onClose,
  invoice,
  company,
  contacts = [],
  onRefresh,
  currency = '€'
}) => {
  const currentLang = useLanguage();
  const [dunningLevel, setDunningLevel] = useState<1 | 2 | 3>(1);
  const [dunningFee, setDunningFee] = useState<number>(0);
  const [interestFee, setInterestFee] = useState<number>(0);
  const [customDaysDeadline, setCustomDaysDeadline] = useState<number>(7);

  if (!isOpen || !invoice) return null;

  // Calculate overdue days
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date(invoice.date);
  const now = new Date();
  const diffTime = now.getTime() - dueDate.getTime();
  const overdueDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const newDeadlineDate = new Date();
  newDeadlineDate.setDate(newDeadlineDate.getDate() + customDaysDeadline);
  const deadlineDateStr = formatSystemDate(newDeadlineDate.toISOString());

  const totalWithFees = invoice.total + dunningFee + interestFee;

  const handleSelectLevel = (lvl: 1 | 2 | 3) => {
    sounds.playClick();
    setDunningLevel(lvl);
    if (lvl === 1) {
      setDunningFee(0);
      setInterestFee(0);
      setCustomDaysDeadline(7);
    } else if (lvl === 2) {
      setDunningFee(2.50);
      setInterestFee(0);
      setCustomDaysDeadline(7);
    } else if (lvl === 3) {
      setDunningFee(5.00);
      setInterestFee(Number((invoice.total * 0.05).toFixed(2))); // 5% default interest
      setCustomDaysDeadline(5);
    }
  };

  const getDunningTitle = () => {
    if (dunningLevel === 1) return 'Zahlungserinnerung';
    if (dunningLevel === 2) return '1. Mahnung';
    return '2. und letzte Mahnung';
  };

  const getDunningIntroText = () => {
    if (dunningLevel === 1) {
      return `sicherlich ist es Ihrer Aufmerksamkeit entgangen, dass die nachfolgend aufgeführte Rechnung bisher noch nicht bei uns eingegangen ist. Wir bitten Sie höflich, den offenen Betrag bis zum ${deadlineDateStr} zu überweisen.`;
    }
    if (dunningLevel === 2) {
      return `trotz unserer bisherigen Erinnerung konnten wir für die unten genannte Rechnung noch keinen Zahlungseingang feststellen. Bitte begleichen Sie den fälligen Gesamtbetrag inkl. Mahngebühren bis spätestens ${deadlineDateStr}.`;
    }
    return `trotz mehrfacher Mahnungen ist die genannte Forderung weiterhin offen. Sollte der Gesamtbetrag bis zum ${deadlineDateStr} nicht auf unserem Konto gutgeschrieben sein, sehen wir uns gezwungen, das gerichtliche Mahnverfahren einzuleiten.`;
  };

  const handlePrint = () => {
    sounds.playClick();
    window.print();
  };

  const handleDownloadEml = () => {
    sounds.playSuccess();
    const subject = `${getDunningTitle()} zu Rechnung ${invoice.number} - ${company.name || 'Ihr Firmenname'}`;
    const body = `Sehr geehrte Damen und Herren,\n\n${getDunningIntroText()}\n\nRechnungsnummer: ${invoice.number}\nUrsprüngliches Fälligkeitsdatum: ${formatSystemDate(invoice.due_date || invoice.date)}\nOffener Rechnungsbetrag: ${invoice.total.toFixed(2)} ${currency}\nMahngebühr: ${dunningFee.toFixed(2)} ${currency}\nVerzugszinsen: ${interestFee.toFixed(2)} ${currency}\n------------------------------------------\nGesamtforderung: ${totalWithFees.toFixed(2)} ${currency}\nZahlbar bis: ${deadlineDateStr}\n\nBankverbindung:\nIBAN: ${company.iban || 'DE00 0000 0000 0000 0000 00'}\nBIC: ${company.bic || ''}\nBank: ${company.bank_name || ''}\n\nMit freundlichen Grüßen,\n${company.name || 'Geschäftsleitung'}`;

    const eml = `To: ${invoice.contact_email || ''}\r\nSubject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\nX-Unsent: 1\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
    const blob = new Blob([eml], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mahnung_${invoice.number}_Stufe${dunningLevel}.eml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLogChatter = async () => {
    try {
      sounds.playSuccess();
      await db.chatter_messages.add({
        res_model: 'invoice',
        res_id: invoice.id!,
        author: company.name || 'System',
        content: `Mahnstufe ${dunningLevel} (${getDunningTitle()}) generiert. Fälligkeit: ${deadlineDateStr}, Gesamtforderung: ${totalWithFees.toFixed(2)} ${currency}`,
        type: 'activity',
        created_at: new Date().toISOString()
      });
      alert('Mahnung erfolgreich in der Rechnungs-Historie protokolliert!');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[99995] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in text-slate-900 dark:text-white"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-auto max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold">
                {t('dunning.title', currentLang, 'Mahnwesen & Zahlungserinnerung')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rechnung {invoice.number} &bull; {overdueDays} Tage überfällig
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Level Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => handleSelectLevel(1)}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 ${
              dunningLevel === 1 
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>Stufe 1</span>
            <span className="text-[10px] font-normal opacity-80">Zahlungserinnerung</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectLevel(2)}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 ${
              dunningLevel === 2 
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>Stufe 2</span>
            <span className="text-[10px] font-normal opacity-80">1. Mahnung (+2,50 €)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectLevel(3)}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 ${
              dunningLevel === 3 
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <span>Stufe 3</span>
            <span className="text-[10px] font-normal opacity-80">Letzte Mahnung (+Zinsen)</span>
          </button>
        </div>

        {/* Scrollable Letter Preview & Adjustment Box */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Config row */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mahngebühr ({currency})</label>
              <input
                type="number"
                step="0.50"
                value={dunningFee}
                onChange={(e) => setDunningFee(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Verzugszinsen ({currency})</label>
              <input
                type="number"
                step="0.50"
                value={interestFee}
                onChange={(e) => setInterestFee(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Neue Zahlfrist (Tage)</label>
              <input
                type="number"
                value={customDaysDeadline}
                onChange={(e) => setCustomDaysDeadline(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Letter Document Preview */}
          <div className="p-6 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner space-y-4 text-xs font-sans">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-extrabold text-slate-900 dark:text-white block">
                  {company.name || 'Ihr Firmenname'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {company.street}, {company.zip_city}
                </span>
              </div>
              <div className="text-right">
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm block">
                  {getDunningTitle()}
                </span>
                <span className="text-[10px] text-slate-400">
                  Datum: {formatSystemDate(new Date().toISOString())}
                </span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Empfänger: {invoice.contact_name}
              </span>
              {invoice.contact_company && (
                <span className="text-[11px] text-slate-500 block">{invoice.contact_company}</span>
              )}
            </div>

            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
              Sehr geehrte Damen und Herren,<br /><br />
              {getDunningIntroText()}
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Ursprünglicher Rechnungsbetrag:</span>
                <span className="font-mono font-bold">{invoice.total.toFixed(2)} {currency}</span>
              </div>
              {dunningFee > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Mahngebühren:</span>
                  <span className="font-mono font-bold">+{dunningFee.toFixed(2)} {currency}</span>
                </div>
              )}
              {interestFee > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Verzugszinsen:</span>
                  <span className="font-mono font-bold">+{interestFee.toFixed(2)} {currency}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-extrabold text-sm text-slate-900 dark:text-white">
                <span>Gesamtforderung:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">{totalWithFees.toFixed(2)} {currency}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleDownloadEml}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
          >
            <Mail className="w-4 h-4 text-indigo-500" />
            <span>.EML E-Mail Export</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Drucken</span>
            </button>

            <button
              type="button"
              onClick={handleLogChatter}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Mahnung ausführen &amp; protokollieren</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
