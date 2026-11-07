import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Mail, 
  Download, 
  Copy, 
  Check, 
  X, 
  AlertCircle, 
  Building2, 
  User, 
  FileText,
  Send
} from 'lucide-react';
import { Contact, CompanyProfile } from '../types';
import { t, useLanguage } from '../lib/i18n';
import { sounds } from '../lib/sound';
import { buildContactEmlPayload, downloadCustomContactEml } from '../lib/emlGenerator';

interface ContactEmailDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  company?: CompanyProfile;
}

export const ContactEmailDraftModal: React.FC<ContactEmailDraftModalProps> = ({
  isOpen,
  onClose,
  contact,
  company
}) => {
  const currentLang = useLanguage();

  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Synchronize initial payload when modal opens or contact changes
  useEffect(() => {
    if (contact && isOpen) {
      const payload = buildContactEmlPayload(contact, company);
      setRecipientEmail(contact.email || '');
      setRecipientName(payload.recipientName);
      setSubject(payload.subject);
      setBody(payload.body);
      setCopied(false);
      setIsDownloaded(false);
    }
  }, [contact, company, isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !contact) return null;

  const senderEmail = company?.email || 'buchhaltung@firma.local';
  const senderName = company?.name || 'SOCDOF ERP';
  const hasNoEmail = !contact.email || contact.email.includes('@import.local') || contact.email.includes('@kontakt.local');

  const handleCopyText = async () => {
    try {
      const fullText = `Betreff: ${subject}\n\n${body}`;
      await navigator.clipboard.writeText(fullText);
      sounds.playSuccess();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      sounds.playError();
    }
  };

  const handleDownload = () => {
    sounds.playSuccess();
    downloadCustomContactEml({
      senderName,
      senderEmail,
      recipientName: recipientName.trim() || contact.name || 'Kunde',
      recipientEmail: recipientEmail.trim() || 'kunde@kontakt.local',
      subject: subject.trim() || 'Mitteilung',
      body
    });
    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 2500);
  };

  const handleMailto = () => {
    sounds.playClick();
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail.trim() || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const electronShell = (window as any).electron?.shell;
    if (electronShell && typeof electronShell.openExternal === 'function') {
      electronShell.openExternal(mailtoUrl);
    } else {
      window.location.href = mailtoUrl;
    }
  };

  return createPortal(
    <div 
      id="contact-email-draft-modal-backdrop"
      className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sounds.playClick();
          onClose();
        }
      }}
    >
      <div 
        id="contact-email-draft-modal-container"
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t('contact.email_draft_preview_title', currentLang, 'E-Mail-Entwurf (Vorschau)')}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold">
                  .eml
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('contact.email_draft_preview_subtitle', currentLang, 'Vorschau der generierten Nachricht vor dem Download')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title={t('contact.btn_close', currentLang, 'Schließen')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-3.5 overflow-y-auto pr-1 flex-1 text-xs">
          {/* Metadata Cards */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
            {/* Sender */}
            <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-[11px] w-20 shrink-0 text-slate-400">
                {t('contact.email_draft_from', currentLang, 'Absender')}:
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200 truncate flex-1 text-right sm:text-left">
                {senderName} &lt;{senderEmail}&gt;
              </span>
            </div>

            {/* Recipient */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
              <span className="font-semibold text-[11px] w-20 shrink-0 text-slate-400">
                {t('contact.email_draft_to', currentLang, 'Empfänger')}:
              </span>
              <div className="flex-1 flex items-center gap-1.5">
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="empfaenger@beispiel.de"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {hasNoEmail && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800/60">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{t('contact.email_draft_no_email_warn', currentLang, 'Keine E-Mail für diesen Kontakt hinterlegt. Sie können oben eine Adresse angeben.')}</span>
              </div>
            )}

            {/* Subject */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="font-semibold text-[11px] w-20 shrink-0 text-slate-400">
                {t('contact.email_draft_subject', currentLang, 'Betreff')}:
              </span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Body Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-semibold text-[11px] text-slate-500 dark:text-slate-400">
                {t('contact.email_draft_body', currentLang, 'Nachrichtentext')}:
              </span>
              <span className="text-[10px] text-slate-400">
                UTF-8 Text/Plain
              </span>
            </div>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-800 dark:text-slate-200 font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* RFC 822 hint */}
          <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100/80 dark:border-indigo-900/30 rounded-xl text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
            <span>
              {t('contact.email_draft_format_info', currentLang, 'RFC 822 .eml Datei. Öffnet sich direkt in Outlook, Thunderbird, Apple Mail oder Windows Mail.')}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700"
              title={t('contact.email_draft_btn_copy', currentLang, 'In Zwischenablage kopieren')}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t('contact.email_draft_copied', currentLang, 'Kopiert!')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('contact.email_draft_btn_copy', currentLang, 'Kopieren')}</span>
                </>
              )}
            </button>

            {recipientEmail && (
              <button
                type="button"
                onClick={handleMailto}
                className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700"
                title="Im Standard E-Mail-Programm öffnen"
              >
                <Send className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Mail-App</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              {t('contact.btn_close', currentLang, 'Schließen')}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                isDownloaded
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isDownloaded ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('contact.email_draft_downloaded', currentLang, 'Heruntergeladen!')}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{t('contact.email_draft_btn_download', currentLang, 'Jetzt downloaden (.eml)')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
