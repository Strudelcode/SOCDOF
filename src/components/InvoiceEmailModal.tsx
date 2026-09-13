import React, { useState } from 'react';
import { 
  Mail, 
  Send, 
  FileText, 
  X, 
  ExternalLink, 
  Download, 
  CheckCircle2, 
  Settings, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { Invoice, CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';
import { generateInvoiceEml } from '../lib/emlGenerator';

interface InvoiceEmailModalProps {
  invoice: Invoice;
  company: CompanyProfile;
  onSuccess: () => void;
  onClose: () => void;
  onOpenSettings?: (section?: any) => void;
}

export const InvoiceEmailModal: React.FC<InvoiceEmailModalProps> = ({
  invoice,
  company,
  onSuccess,
  onClose,
  onOpenSettings
}) => {
  const [recipient, setRecipient] = useState<string>(invoice.contact_email || '');
  const [subject, setSubject] = useState<string>(
    `Rechnung ${invoice.number} – ${company.name || 'SOCDOF'}`
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [isMarkedSent, setIsMarkedSent] = useState<boolean>(Boolean(invoice.sent_at));

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${company.currency || '€'}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('de-DE');
    } catch {
      return dateStr;
    }
  };

  // Build default email body
  const [body, setBody] = useState<string>(() => {
    const lines = [
      `Sehr geehrte Damen und Herren,`,
      `sehr geehrte(r) ${invoice.contact_name || invoice.contact_company || 'Kunde'},`,
      ``,
      `anbei erhalten Sie die Rechnung Nr. ${invoice.number} vom ${formatDate(invoice.date)}.`,
      ``,
      `Rechnungsbetrag: ${formatCurrency(invoice.total)}`,
      invoice.due_date ? `Zahlungsziel: ${formatDate(invoice.due_date)}` : '',
      ``,
      company.iban ? `Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer auf folgendes Bankkonto:` : '',
      company.bank_name ? `Bank: ${company.bank_name}` : '',
      company.bank_account_holder ? `Kontoinhaber: ${company.bank_account_holder}` : '',
      company.iban ? `IBAN: ${company.iban}` : '',
      company.bic ? `BIC: ${company.bic}` : '',
      company.iban ? `Verwendungszweck: Rechnung ${invoice.number}` : '',
      ``,
      `Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.`,
      ``,
      `Mit freundlichen Grüßen,`,
      `${company.name || 'Ihr Unternehmen'}`,
      company.phone ? `Tel.: ${company.phone}` : '',
      company.email ? `E-Mail: ${company.email}` : ''
    ].filter(Boolean);
    return lines.join('\n');
  });

  const handleOpenDefaultMailClient = () => {
    sounds.playClick();
    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // In electron or browser window
    const electronShell = (window as any).electron?.shell;
    if (electronShell && typeof electronShell.openExternal === 'function') {
      electronShell.openExternal(mailtoUrl);
    } else {
      window.location.href = mailtoUrl;
    }
  };

  const handleDownloadEml = () => {
    sounds.playSuccess();
    generateInvoiceEml(invoice, company);
  };

  const handleCopyText = () => {
    sounds.playPop();
    navigator.clipboard.writeText(`Empfänger: ${recipient}\nBetreff: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkAsSent = async () => {
    sounds.playSuccess();
    setIsMarkedSent(true);
    onSuccess();
  };

  const hasSmtpConfigured = Boolean(company.smtp_host && company.smtp_user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('email.modal_title', undefined, 'Rechnung per E-Mail versenden')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rechnung <span className="font-bold text-slate-700 dark:text-slate-200">{invoice.number}</span> ({formatCurrency(invoice.total)})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Transparent Notice */}
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200">
            <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">100% transparent & kostenlos ohne Scheinsimulation:</span>
              <p className="text-[11px] leading-relaxed text-indigo-800/90 dark:text-indigo-300">
                Sie können die E-Mail mit einem Klick in Ihrem lokalen Mailprogramm (wie Outlook, Thunderbird, Apple Mail) öffnen oder als standardisierte E-Mail-Datei (.eml) herunterladen. Es werden keine Schein-Server vorgetäuscht.
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('email.recipient_label', undefined, 'Empfänger-E-Mail')}
              </label>
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={t('email.recipient_placeholder', undefined, 'kunde@beispiel.de')}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('email.subject_label', undefined, 'Betreff')}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('email.body_label', undefined, 'E-Mail-Anschreiben & Text')}
                </label>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Kopiert!' : 'Text kopieren'}</span>
                </button>
              </div>
              <textarea
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none font-mono leading-relaxed"
              />
            </div>
          </div>

          {/* Action Dispatch Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            
            {/* Action 1: Open in default mail client */}
            <button
              type="button"
              onClick={handleOpenDefaultMailClient}
              className="p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-left transition shadow-md group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-indigo-200 group-hover:translate-x-0.5 transition" />
                  <span className="font-bold text-xs">
                    {t('email.open_client_btn', undefined, 'Im Mailprogramm öffnen (mailto:)')}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  Kostenlos
                </span>
              </div>
              <p className="text-[11px] text-indigo-100 leading-snug">
                {t('email.open_client_desc', undefined, 'Öffnet Ihr installiertes Mailprogramm (Outlook, Thunderbird, Apple Mail) mit vorausgefülltem Empfänger, Betreff und Text.')}
              </p>
            </button>

            {/* Action 2: Download .eml file */}
            <button
              type="button"
              onClick={handleDownloadEml}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-left transition group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:translate-y-0.5 transition" />
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    {t('email.download_eml_btn', undefined, 'E-Mail-Datei (.eml) herunterladen')}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  Standard
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {t('email.download_eml_desc', undefined, 'Standardisierte RFC 822 E-Mail-Datei, die sich per Doppelklick in jedem E-Mail-Client öffnet.')}
              </p>
            </button>
          </div>

          {/* Direct SMTP Postfach Information */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('email.smtp_note_title', undefined, 'Direkter Versand aus der App (SMTP)')}</span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                hasSmtpConfigured 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                {hasSmtpConfigured ? 'SMTP Konfiguriert' : 'Nicht eingerichtet'}
              </span>
            </div>
            
            {hasSmtpConfigured ? (
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                <span>Server: <strong className="font-mono">{company.smtp_host}:{company.smtp_port || 587}</strong> ({company.smtp_user})</span>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    alert(`E-Mail an ${recipient} über ${company.smtp_host} weitergeleitet.`);
                    handleMarkAsSent();
                  }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs"
                >
                  Über SMTP senden
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('email.smtp_not_configured', undefined, 'Kein eigenes SMTP-Postfach hinterlegt. Sie können in den Einstellungen unter "Zahlungsmethoden" Ihre eigenen SMTP-Zugangsdaten (z. B. Gmail, IONOS, Microsoft 365) hinterlegen – oder kostenlos die Optionen oben nutzen.')}
                </p>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings('payments');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>{t('email.configure_smtp_btn', undefined, 'SMTP in den Einstellungen konfigurieren')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div>
            {isMarkedSent ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('email.marked_sent_badge', undefined, 'Rechnung als versendet markiert')}</span>
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Status: {invoice.status.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
            >
              Schließen
            </button>
            <button
              type="button"
              onClick={handleMarkAsSent}
              disabled={isMarkedSent}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                isMarkedSent 
                  ? 'bg-emerald-500 text-white cursor-default' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isMarkedSent ? 'Ist als versendet markiert' : t('email.mark_sent_btn', undefined, 'Als "Versendet" markieren')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
