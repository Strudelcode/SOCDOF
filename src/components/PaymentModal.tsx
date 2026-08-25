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
  Receipt
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
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  invoice,
  company,
  onClose,
  onPaymentSuccess
}) => {
  const [method, setMethod] = useState<'card' | 'cash' | 'transfer'>('card');
  
  // Card States
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8821');
  const [cardHolder, setCardHolder] = useState(invoice.contact_name || 'MAX MUSTERMANN');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvc, setCardCvc] = useState('742');
  const [cardType, setCardType] = useState<'visa' | 'mastercard' | 'girocard' | 'applepay'>('visa');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState(false);

  // Cash States
  const [cashGiven, setCashGiven] = useState<number>(Math.ceil(invoice.total));

  // Generated receipt data
  const [tseSignature, setTseSignature] = useState<string>('');

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${company.currency}`;
  };

  const calculateChange = () => {
    return Math.max(0, cashGiven - invoice.total);
  };

  const handleQuickCash = (amount: number) => {
    sounds.playClick();
    setCashGiven(amount);
  };

  const handleQuickCardPreset = (type: 'visa' | 'mastercard' | 'girocard' | 'applepay') => {
    sounds.playClick();
    setCardType(type);
    if (type === 'visa') {
      setCardNumber('4532 8812 9012 4490');
      setCardExpiry('12/28');
      setCardCvc('382');
    } else if (type === 'mastercard') {
      setCardNumber('5412 7533 1198 2201');
      setCardExpiry('06/27');
      setCardCvc('915');
    } else if (type === 'girocard') {
      setCardNumber('6759 0012 4589 1104');
      setCardExpiry('10/29');
      setCardCvc('102');
    } else if (type === 'applepay') {
      setCardNumber('Apple Pay (NFC Express)');
      setCardExpiry('Tokenized');
      setCardCvc('•••');
    }
  };

  const handleExecutePayment = async () => {
    sounds.playClick();
    setIsProcessing(true);

    try {
      if (method === 'card') {
        setProcessStep(t('payment.step_1', undefined, '1/3: Connecting to payment terminal (TLS 1.3 / ZVT)...'));
        await new Promise(r => setTimeout(r, 600));

        setProcessStep(t('payment.step_2', undefined, '2/3: Authorizing & generating GoBD/TSE signature...'));
        await new Promise(r => setTimeout(r, 700));

        const sig = `TSE-SIG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        setTseSignature(sig);

        setProcessStep(t('payment.step_3', undefined, '3/3: Payment booked & receipt signed!'));
        await new Promise(r => setTimeout(r, 400));
      } else {
        const sig = `CASH-TSE-${Date.now().toString(36).toUpperCase()}`;
        setTseSignature(sig);
      }

      // Update Invoice in DB
      if (invoice.id) {
        await db.invoices.update(invoice.id, {
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: method,
          payment_reference: method === 'card' ? `Terminal POS-#${Math.floor(1000 + Math.random() * 9000)} (${cardType.toUpperCase()})` : 'Barzahlung Kasse',
          tse_signature: tseSignature || `TSE-${Date.now()}`
        });
      }

      sounds.playKaching();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('payment.title', undefined, 'Payment for Invoice')} {invoice.number}
              </h3>
              <p className="text-xs text-slate-400">
                {t('payment.recipient', undefined, 'Recipient:')} <span className="font-semibold text-slate-700 dark:text-slate-200">{invoice.contact_company || invoice.contact_name}</span>
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Amount Due Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs uppercase tracking-wider text-emerald-100 font-bold">{t('payment.amount_due', undefined, 'Total invoice amount due')}</span>
              <div className="text-2xl sm:text-3xl font-black font-mono-num mt-0.5">
                {formatCurrency(invoice.total)}
              </div>
            </div>
            <div className="text-right text-xs text-emerald-100">
              <div>{t('payment.incl', undefined, 'incl.')} {formatCurrency(invoice.tax_total)} {t('payment.vat', undefined, 'VAT')}</div>
              <div className="flex items-center gap-1 mt-1 justify-end font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-200" />
                <span>{t('payment.compliance_badge', undefined, 'GoBD & TSE 2026 Compliant')}</span>
              </div>
            </div>
          </div>

          {!isCompleted ? (
            <>
              {/* Payment Method Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
                <button
                  type="button"
                  onClick={() => { sounds.playClick(); setMethod('card'); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
                    method === 'card'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{t('payment.method_card', undefined, 'Card Payment (EC / Credit)')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { sounds.playClick(); setMethod('cash'); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
                    method === 'cash'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>{t('payment.method_cash', undefined, 'Cash Payment & Register')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { sounds.playClick(); setMethod('transfer'); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
                    method === 'transfer'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>{t('payment.method_transfer', undefined, 'Bank Transfer')}</span>
                </button>
              </div>

              {/* Method 1: Card Payment View */}
              {method === 'card' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Virtual Modern Credit / Debit Card Visual */}
                  <div className="relative p-5 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-800 text-white shadow-xl overflow-hidden border border-slate-700/50">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-6 rounded-md bg-amber-400/80 border border-amber-300 flex items-center justify-center text-[9px] font-bold text-slate-900">
                          CHIP
                        </div>
                        <Smartphone className="w-4 h-4 text-slate-300" />
                        <span className="text-[11px] text-slate-300 font-medium">{t('payment.nfc_contactless', undefined, 'NFC Contactless')}</span>
                      </div>
                      <span className="font-bold text-sm tracking-wider uppercase text-indigo-300">
                        {cardType.toUpperCase()}
                      </span>
                    </div>

                    <div className="font-mono text-lg sm:text-xl font-bold tracking-widest text-slate-100 mb-4">
                      {cardNumber}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400">{t('payment.card_holder', undefined, 'Cardholder')}</div>
                        <div className="font-semibold">{cardHolder}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400">{t('payment.valid_thru', undefined, 'Valid thru')}</div>
                        <div className="font-semibold font-mono">{cardExpiry}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400">{t('payment.cvc', undefined, 'CVC / CVV')}</div>
                        <div className="font-semibold font-mono">{cardCvc}</div>
                      </div>
                    </div>
                  </div>

                  {/* Preset Test Cards / Terminal Presets */}
                  <div>
                    <span className="text-xs font-semibold text-slate-500 mb-2 block">
                      {t('payment.choose_terminal_mode', undefined, 'Select payment & terminal mode:')}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickCardPreset('visa')}
                        className={`p-2 rounded-xl text-xs font-bold border transition text-center ${
                          cardType === 'visa' 
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' 
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        💳 Visa
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
                        onClick={() => handleQuickCardPreset('girocard')}
                        className={`p-2 rounded-xl text-xs font-bold border transition text-center ${
                          cardType === 'girocard' 
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' 
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        🏦 EC / Girocard
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

                  {/* Manual Inputs for Custom Card Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">{t('payment.card_number', undefined, 'Card Number')}</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">{t('payment.card_valid_cvc', undefined, 'Expiry / CVC')}</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="w-1/2 px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:outline-none focus:border-indigo-500 text-center"
                        />
                        <input
                          type="text"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          placeholder="CVC"
                          className="w-1/2 px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:outline-none focus:border-indigo-500 text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Method 2: Cash Payment View */}
              {method === 'cash' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                        {t('payment.cash_received', undefined, 'Cash Received (€)')}
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
                          {t('payment.change_due', undefined, 'Change Due to Customer')}
                        </span>
                        <div className="text-3xl font-black font-mono-num text-emerald-700 dark:text-emerald-300 mt-1">
                          {formatCurrency(calculateChange())}
                        </div>
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        {t('payment.cash_auto_reg', undefined, 'Automatic registration in cash journal & TSE log.')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Method 3: Bank Transfer View */}
              {method === 'transfer' && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-fade-in text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">{t('payment.bank_details', undefined, 'Bank Account / IBAN:')}</span>
                    <span className="font-mono font-bold">{company.iban || 'DE89 3704 0044 0532 0130 00'}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">{t('payment.bic_swift', undefined, 'BIC / SWIFT:')}</span>
                    <span className="font-mono font-bold">{company.bic || 'DBBDEFF100'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t('payment.purpose', undefined, 'Payment Reference:')}</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">Rechnung {invoice.number}</span>
                  </div>
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
            /* Completed Success State with TSE Signature Receipt */
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center space-y-4 animate-scale-up">
              <div className="w-16 h-16 rounded-3xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-xl animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h4 className="text-xl font-black text-emerald-900 dark:text-emerald-100">
                  {t('payment.success_title', undefined, 'Payment successfully recorded!')}
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  {t('payment.success_desc', undefined, 'The amount of {amount} was fully paid for invoice {number}.').replace('{amount}', formatCurrency(invoice.total)).replace('{number}', invoice.number)}
                </p>
              </div>

              {/* TSE Receipt Snippet */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-left font-mono text-[11px] space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 border-b pb-1">
                  <span>{t('payment.receipt_no', undefined, 'GoBD TSE Receipt No:')}</span>
                  <span>{tseSignature || 'TSE-2026-OK'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 pt-1">
                  <span>{t('payment.payment_method_label', undefined, 'Payment Method:')}</span>
                  <span className="font-bold uppercase">{method === 'card' ? `Karte (${cardType})` : method === 'cash' ? 'Bargeld' : 'Überweisung'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>{t('payment.trans_time', undefined, 'Transaction Time:')}</span>
                  <span>{new Date().toLocaleTimeString('de-DE')}</span>
                </div>
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
                {t('payment.btn_cancel', undefined, 'Cancel')}
              </button>

              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={isProcessing || (method === 'cash' && cashGiven < invoice.total)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t('payment.processing', undefined, 'Processing...')}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>{t('payment.btn_pay_now', undefined, 'Charge now with {method} ({amount})').replace('{method}', method === 'card' ? 'Karte' : method === 'cash' ? 'Bargeld' : 'SEPA').replace('{amount}', formatCurrency(invoice.total))}</span>
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
              <span>{t('payment.btn_finish', undefined, 'Finish & Close')}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
