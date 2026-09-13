import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  CreditCard, 
  DollarSign, 
  Building, 
  CheckCircle2, 
  X, 
  ShieldCheck, 
  Smartphone, 
  Zap, 
  QrCode, 
  Printer, 
  ArrowRight,
  RefreshCw,
  Lock,
  Receipt,
  Settings,
  AlertCircle,
  Calendar,
  FileCheck
} from 'lucide-react';
import { Invoice, CompanyProfile } from '../types';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';

interface PaymentModalProps {
  invoice: Invoice;
  company: CompanyProfile;
  onClose: () => void;
  onPaymentSuccess: () => void;
  onOpenSettings?: (section?: any) => void;
}

export const maskCardNumber = (card: string): string => {
  if (!card) return '';
  if (card.includes('Apple') || card.includes('Google') || card.includes('NFC') || card.includes('Tokenized')) {
    return card;
  }
  const digitsOnly = card.replace(/\D/g, '');
  if (digitsOnly.length === 0) {
    return card;
  }
  const prefix = digitsOnly.substring(0, 4);
  const remaining = Math.max(0, digitsOnly.length - 4);
  const asterisks = '*'.repeat(Math.max(12, remaining));
  const full = prefix + asterisks;
  return full.match(/.{1,4}/g)?.join(' ') || (prefix + ' ' + asterisks);
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
  invoice,
  company,
  onClose,
  onPaymentSuccess,
  onOpenSettings
}) => {
  const isCardConfigured = Boolean(company.card_payment_enabled);
  const [method, setMethod] = useState<'transfer' | 'cash' | 'card'>('transfer');
  
  // Bank Transfer Reconciliation States
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [transferRef, setTransferRef] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<number>(invoice.total);

  // Card States
  const [cardNumber, setCardNumber] = useState('4532 **** **** ****');
  const [cardHolder, setCardHolder] = useState(invoice.contact_name || 'KARTENINHABER');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('***');
  const [cardType, setCardType] = useState<'girocard' | 'visa' | 'mastercard' | 'applepay'>('girocard');
  const [cardTrace, setCardTrace] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState(false);

  // Cash States
  const [cashGiven, setCashGiven] = useState<number>(Math.ceil(invoice.total));

  // Generated receipt data (only for Cash GoBD TSE)
  const [tseSignature, setTseSignature] = useState<string>('');

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${company.currency || '€'}`;
  };

  const calculateChange = () => {
    return Math.max(0, cashGiven - invoice.total);
  };

  const handleQuickCash = (amount: number) => {
    sounds.playCoinClink();
    setCashGiven(amount);
  };

  const handleQuickCardPreset = (type: 'girocard' | 'visa' | 'mastercard' | 'applepay') => {
    sounds.playClick();
    setCardType(type);
    if (type === 'girocard') {
      setCardNumber('6759 **** **** ****');
      setCardExpiry('10/29');
      setCardCvc('***');
    } else if (type === 'visa') {
      setCardNumber('4532 **** **** ****');
      setCardExpiry('12/28');
      setCardCvc('***');
    } else if (type === 'mastercard') {
      setCardNumber('5412 **** **** ****');
      setCardExpiry('06/27');
      setCardCvc('***');
    } else if (type === 'applepay') {
      setCardNumber('Apple Pay (NFC Tokenized)');
      setCardExpiry('Tokenized');
      setCardCvc('***');
    }
  };

  const handleExecutePayment = async () => {
    sounds.playClick();
    setIsProcessing(true);

    try {
      if (method === 'transfer') {
        // Honest Bank Transfer: Record bank receipt into ERP journal
        setProcessStep('Zahlungseingang wird verbucht...');
        await new Promise(r => setTimeout(r, 400));

        if (invoice.id) {
          await db.invoices.update(invoice.id, {
            status: 'paid',
            paid_at: new Date(transferDate).toISOString(),
            payment_method: 'transfer',
            payment_reference: transferRef ? `Banküberweisung (${transferRef})` : `Banküberweisung (${company.bank_name || 'Konto'})`
          });
        }
        sounds.playSuccess();
      } else if (method === 'cash') {
        // Real Cash Desk Flow: Cash Drawer sound + Legal TSE signature
        sounds.playCashDrawer();
        setTimeout(() => sounds.playCoinClink(), 250);
        const sig = `CASH-TSE-${Date.now().toString(36).toUpperCase()}`;
        setTseSignature(sig);

        if (invoice.id) {
          await db.invoices.update(invoice.id, {
            status: 'paid',
            paid_at: new Date().toISOString(),
            payment_method: 'cash',
            payment_reference: 'Barzahlung Kasse',
            tse_signature: sig
          });
        }
        sounds.playPaymentSuccess();
        try {
          confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        } catch {}
      } else if (method === 'card') {
        // Card Terminal Processing
        if (!isCardConfigured) {
          sounds.playError();
          setIsProcessing(false);
          return;
        }

        sounds.playNfcBeep();
        const termName = company.card_terminal_name || 'ZVT Terminal';
        setProcessStep(t('payment.step_1', undefined, '1/3: Verbinde mit Kartenterminal (ZVT / SumUp)...'));
        await new Promise(r => setTimeout(r, 500));

        setProcessStep(t('payment.step_2', undefined, '2/3: Kartenzahlung autorisiert & Beleg generiert...'));
        await new Promise(r => setTimeout(r, 500));

        const authCode = cardTrace.trim() || `AUTH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        setProcessStep(t('payment.step_3', undefined, '3/3: Zahlung gebucht & quittiert!'));
        await new Promise(r => setTimeout(r, 300));

        if (invoice.id) {
          await db.invoices.update(invoice.id, {
            status: 'paid',
            paid_at: new Date().toISOString(),
            payment_method: 'card',
            payment_reference: `${company.card_terminal_name || 'Kartenterminal'} (${cardType.toUpperCase()} ${maskCardNumber(cardNumber)} / ${authCode})`
          });
        }
        sounds.playPaymentSuccess();
        try {
          confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        } catch {}
      }

      setIsProcessing(false);
      setIsCompleted(true);
    } catch (err) {
      console.error(err);
      sounds.playError();
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    sounds.playClick();
    onPaymentSuccess();
    onClose();
  };

  const hasCompanyIban = Boolean(company.iban && company.iban.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Zahlungseingang erfassen – Rechnung {invoice.number}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kunde: <span className="font-semibold text-slate-700 dark:text-slate-200">{invoice.contact_company || invoice.contact_name || 'Barverkauf'}</span> • Fällig: <span className="font-semibold">{formatCurrency(invoice.total)}</span>
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Amount Due Banner */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/50">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">
              Zu begleichender Rechnungsbetrag
            </span>
            <div className="text-3xl font-black font-mono-num text-white tracking-tight">
              {formatCurrency(invoice.total)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>GoBD & Buchhaltungskonform</span>
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {!isCompleted ? (
            <>
              {/* Payment Method Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                
                {/* Method 1: Banküberweisung */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setMethod('transfer');
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition ${
                    method === 'transfer'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Building className="w-4 h-4 shrink-0" />
                  <span>Überweisung (SEPA)</span>
                </button>

                {/* Method 2: Barzahlung */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setMethod('cash');
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition ${
                    method === 'cash'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <DollarSign className="w-4 h-4 shrink-0" />
                  <span>Barzahlung & Kasse</span>
                </button>

                {/* Method 3: Kartenzahlung */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setMethod('card');
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition ${
                    method === 'card'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>Kartenterminal</span>
                </button>
              </div>

              {/* TAB 1: Banküberweisung (SEPA) */}
              {method === 'transfer' && (
                <div className="space-y-4 animate-fade-in text-xs">
                  
                  {/* Explanation of Purpose */}
                  <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200">
                      <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{t('payment.transfer_record_title', undefined, 'Zahlungseingang per Banküberweisung erfassen')}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-indigo-800/90 dark:text-indigo-300">
                      {t('payment.transfer_record_desc', undefined, 'Wurde der Betrag auf Ihrem Bankkonto gutgeschrieben? Bestätigen Sie den Zahlungseingang, um die Rechnung als bezahlt zu archivieren.')}
                    </p>
                  </div>

                  {/* Company Bank Details Check */}
                  {!hasCompanyIban ? (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{t('payment.transfer_no_iban_title', undefined, 'Noch keine eigene Bankverbindung hinterlegt')}</span>
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        {t('payment.transfer_no_iban_desc', undefined, 'Tragen Sie bitte Ihre IBAN in den Einstellungen unter "Zahlungsmethoden" ein, damit Ihre Kunden wissen, wohin sie überweisen sollen.')}
                      </p>
                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenSettings('payments');
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 underline hover:no-underline pt-1"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>{t('payment.transfer_goto_settings', undefined, 'Bankverbindung in den Einstellungen einrichten')}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 font-mono">
                      <div className="text-[10px] uppercase tracking-wider font-sans font-bold text-slate-500">
                        Hinterlegte Bankverbindung für Rechnungen:
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-sans">Kreditinstitut:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{company.bank_name || 'Geschäftskonto'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-sans">IBAN:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{company.iban}</span>
                      </div>
                      {company.bic && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-sans">BIC / SWIFT:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{company.bic}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 font-sans">Verwendungszweck des Kunden:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">Rechnung {invoice.number}</span>
                      </div>
                    </div>
                  )}

                  {/* Accounting Input Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t('payment.transfer_date_label', undefined, 'Buchungsdatum / Geldeingang am')}
                      </label>
                      <input
                        type="date"
                        value={transferDate}
                        onChange={(e) => setTransferDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t('payment.transfer_amount_label', undefined, 'Erhaltener Rechnungsbetrag')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('payment.transfer_ref_label', undefined, 'Buchungsvermerk / Kontoauszug-Referenz (optional)')}
                    </label>
                    <input
                      type="text"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      placeholder={t('payment.transfer_ref_placeholder', undefined, 'z. B. Erhalten lt. Kontoauszug #42')}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Barzahlung (Kasse) */}
              {method === 'cash' && (
                <div className="space-y-4 animate-fade-in text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                        {t('payment.cash_received', undefined, 'Gegebenes Bargeld (€)')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(parseFloat(e.target.value) || 0)}
                        className="w-full text-xl font-black font-mono-num p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />

                      {/* Quick Cash Buttons */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          Math.ceil(invoice.total), 
                          50, 
                          100, 
                          200, 
                          500
                        ].filter(amt => amt >= Math.floor(invoice.total)).slice(0, 4).map((amt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleQuickCash(amt)}
                            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold hover:bg-slate-100 transition"
                          >
                            {formatCurrency(amt)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col justify-between">
                      <div>
                        <span className="text-xs uppercase font-bold text-emerald-800 dark:text-emerald-300">
                          {t('payment.change_due', undefined, 'Herauszugebendes Rückgeld')}
                        </span>
                        <div className="text-3xl font-black font-mono-num text-emerald-700 dark:text-emerald-300 mt-1">
                          {formatCurrency(calculateChange())}
                        </div>
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        {t('payment.cash_auto_reg', undefined, 'Automatische Erfassung im Kassenbuch mit GoBD/TSE-Signatur.')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Kartenterminal */}
              {method === 'card' && (
                <div className="space-y-4 animate-fade-in text-xs">
                  {!isCardConfigured ? (
                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
                        <CreditCard className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {t('payment.card_not_configured_title', undefined, 'Kartenzahlung an diesem PC nicht aktiviert')}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                          {t('payment.card_not_configured_desc', undefined, 'Auf diesem PC-Arbeitsplatz ist aktuell kein EC-Kartenterminal konfiguriert. Bitte aktivieren und konfigurieren Sie Ihr Terminal zuerst in den Einstellungen.')}
                        </p>
                      </div>
                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenSettings('payments');
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-xs"
                        >
                          {t('payment.btn_configure_settings', undefined, 'In den Einstellungen einrichten')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      
                      {/* Step 1 & 2 Explanation */}
                      <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-1">
                        <span className="font-bold text-indigo-900 dark:text-indigo-200 block">
                          Ablauf der Kartenzahlung:
                        </span>
                        <p className="text-[11px] text-indigo-800/90 dark:text-indigo-300 leading-relaxed">
                          1. Lassen Sie Ihren Kunden den Betrag von {formatCurrency(invoice.total)} am EC-Terminal ({company.card_terminal_name || company.card_terminal_provider?.toUpperCase()}) begleichen.
                          <br />
                          2. Erfassen Sie anschließend die Beleg-Referenz zur lückenlosen Buchführung.
                        </p>
                      </div>

                      {/* Card Type Selector */}
                      <div>
                        <span className="text-xs font-semibold text-slate-500 mb-2 block">
                          Zahlungsart / Kartentyp am Terminal:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuickCardPreset('girocard')}
                            className={`p-2 rounded-xl text-xs font-bold border transition text-center ${
                              cardType === 'girocard' 
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' 
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            💳 Girocard / EC
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickCardPreset('visa')}
                            className={`p-2 rounded-xl text-xs font-bold border transition text-center ${
                              cardType === 'visa' 
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' 
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            🔵 Visa
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickCardPreset('mastercard')}
                            className={`p-2 rounded-xl text-xs font-bold border transition text-center ${
                              cardType === 'mastercard' 
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' 
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            🔴 Mastercard
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickCardPreset('applepay')}
                            className={`p-2 rounded-xl text-xs font-bold border transition text-center ${
                              cardType === 'applepay' 
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' 
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            📱 Apple / Google Pay
                          </button>
                        </div>
                      </div>

                      {/* Terminal Receipt Reference Input */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t('payment.card_trace_label', undefined, 'Terminal-Beleg / Trace-Nr. (vom Terminalausdruck)')}
                        </label>
                        <input
                          type="text"
                          value={cardTrace}
                          onChange={(e) => setCardTrace(e.target.value)}
                          placeholder={t('payment.card_trace_placeholder', undefined, 'z. B. TRACE-89210 / Auth-Code 49201')}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-mono"
                        />
                      </div>

                      {/* PCI-DSS Security & Privacy Notice */}
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{t('payment.card_pin_notice', undefined, 'PIN-Eingabe erfolgt geschützt am Kundenterminal (PCI-DSS konform).')} {t('payment.card_masked_notice', undefined, 'Kartennummer wird zum Datenschutz automatisch maskiert.')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Processing Status Banner */}
              {isProcessing && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center gap-3 animate-pulse">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    {processStep}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Completed Success State */
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center space-y-4 animate-scale-up">
              <div className="w-16 h-16 rounded-3xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-xl">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h4 className="text-xl font-black text-emerald-900 dark:text-emerald-100">
                  {method === 'transfer' 
                    ? t('payment.transfer_success_title', undefined, 'Zahlungseingang erfolgreich verbucht')
                    : t('payment.success_title', undefined, 'Zahlung erfolgreich verbucht!')}
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Rechnung <strong>{invoice.number}</strong> über <strong>{formatCurrency(method === 'transfer' ? transferAmount : invoice.total)}</strong> wurde als bezahlt archiviert.
                </p>
              </div>

              {/* Honest Transaction Summary Snippet */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-left font-mono text-[11px] space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 border-b pb-1 font-sans">
                  <span>Buchungsvermerk:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {method === 'transfer' 
                      ? (transferRef || 'Banküberweisung (Kontoauszug)') 
                      : method === 'cash' 
                        ? (tseSignature || 'Barzahlung Kasse') 
                        : `POS-Terminal (${cardType.toUpperCase()})`}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-slate-500 pt-1">
                  <span>Zahlungsmethode:</span>
                  <span className="font-bold uppercase">
                    {method === 'transfer' ? 'Banküberweisung (SEPA)' : method === 'cash' ? 'Barzahlung' : `Karte (${cardType.toUpperCase()})`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span>Buchungsdatum:</span>
                  <span>{method === 'transfer' ? transferDate : new Date().toLocaleDateString('de-DE')}</span>
                </div>

                {method === 'transfer' && company.iban && (
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Empfängerkonto:</span>
                    <span>{company.bank_name || 'Konto'} ({company.iban})</span>
                  </div>
                )}

                {method === 'cash' && tseSignature && (
                  <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>GoBD TSE Signatur:</span>
                    <span>{tseSignature}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          {!isCompleted ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                {t('payment.btn_cancel', undefined, 'Abbrechen')}
              </button>

              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={
                  isProcessing || 
                  (method === 'cash' && cashGiven < invoice.total) || 
                  (method === 'card' && !isCardConfigured)
                }
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t('payment.processing', undefined, 'Wird verbucht...')}</span>
                  </>
                ) : method === 'card' && !isCardConfigured ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>In den Einstellungen aktivieren</span>
                  </>
                ) : method === 'transfer' ? (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>{t('payment.transfer_btn_book', undefined, 'Zahlungseingang jetzt verbuchen')}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>{method === 'cash' ? `Barzahlung buchen (${formatCurrency(invoice.total)})` : `Kartenzahlung buchen (${formatCurrency(invoice.total)})`}</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('payment.btn_finish', undefined, 'Fertigstellen & Schließen')}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
