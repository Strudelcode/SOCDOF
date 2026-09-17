import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  CheckCircle2, 
  Clock, 
  User, 
  Building2, 
  Phone, 
  Mail, 
  Calendar, 
  CheckSquare, 
  Copy, 
  Check,
  FileText
} from 'lucide-react';
import { SupportServiceTicket, CompanyProfile, CustomStatusConfig } from '../types';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';

interface SupportTicketPrintModalProps {
  ticket: SupportServiceTicket;
  company: CompanyProfile;
  customStatuses?: Partial<Record<'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed', CustomStatusConfig>>;
  onClose: () => void;
}

export const SupportTicketPrintModal: React.FC<SupportTicketPrintModalProps> = ({
  ticket,
  company,
  customStatuses,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    sounds.playClick();
    window.print();
  };

  const currency = company.currency || '€';

  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return new Date().toLocaleDateString('de-DE');
    try {
      return new Date(isoStr).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return isoStr;
    }
  };

  // Status label resolution
  const getStatusLabel = (status: string) => {
    const custom = customStatuses?.[status as keyof typeof customStatuses];
    if (custom?.label) return custom.label;
    switch (status) {
      case 'new': return t('support.status_new', undefined, 'Neu');
      case 'in_progress': return t('support.status_in_progress', undefined, 'In Bearbeitung');
      case 'waiting': return t('support.status_waiting', undefined, 'Wartend');
      case 'resolved': return t('support.status_resolved', undefined, 'Gelöst');
      case 'closed': return t('support.status_closed', undefined, 'Geschlossen');
      case 'invoiced': return t('support.status_invoiced', undefined, 'Abgerechnet');
      default: return status;
    }
  };

  // Calculations
  const totalWorkHours = (ticket.timesheets || []).reduce((acc, ts) => acc + (Number(ts.hours) || 0), 0);
  const hourlyRate = ticket.hourlyRate !== undefined ? ticket.hourlyRate : (company.default_hourly_rate || 95);
  const hoursAmount = totalWorkHours * hourlyRate;

  const workItems = ticket.workItems || [];
  const workItemsAmount = workItems.reduce((acc, it) => acc + (Number(it.price) || 0), 0);
  const totalSubtotal = hoursAmount + workItemsAmount;
  const taxRate = company.default_tax_rate !== undefined ? company.default_tax_rate : 19;
  const taxAmount = (totalSubtotal * taxRate) / 100;
  const totalGross = totalSubtotal + taxAmount;

  const showFoldMarks = company.letterhead_show_fold_marks ?? true;

  const handleCopyTextReport = () => {
    sounds.playSuccess();
    const titleHeader = t('support.report_doc_type', undefined, 'Servicebericht').toUpperCase();
    const lblDate = t('support.th_date', undefined, 'Datum');
    const lblStatus = t('support.th_status', undefined, 'Status');
    const lblCustomer = t('support.th_customer', undefined, 'Kunde');
    const lblWorkItems = t('support.tab_work_items', undefined, 'Service-Positionen & Arbeitsschritte').toUpperCase();
    const lblTimesheets = t('support.tab_timesheets', undefined, 'Zeiterfassung').toUpperCase();
    const lblWorkHours = t('support.summary_work_hours', undefined, 'Arbeitszeit');
    const lblPositions = t('support.summary_positions_flat_rate', undefined, 'Service-Positionen');
    const lblNet = t('support.summary_net_amount', undefined, 'Nettobetrag');
    const lblGross = t('support.summary_gross_total', undefined, 'Gesamtbetrag');

    let text = `=================================================\n`;
    text += `${titleHeader} / SERVICE REPORT\n`;
    text += `Ticket: ${ticket.ticketNumber}\n`;
    text += `${lblDate}: ${formatDate(ticket.createdAt)}\n`;
    text += `${lblStatus}: ${getStatusLabel(ticket.status)}\n`;
    text += `${lblCustomer}: ${ticket.contact_name || '-'}${ticket.contact_company ? ` (${ticket.contact_company})` : ''}\n`;
    text += `Title: ${ticket.title}\n`;
    text += `=================================================\n\n`;
    if (ticket.description) {
      text += `${t('support.th_description', undefined, 'Beschreibung').toUpperCase()}:\n${ticket.description}\n\n`;
    }
    if (workItems.length > 0) {
      text += `${lblWorkItems}:\n`;
      workItems.forEach((wi, idx) => {
        text += `[${wi.isCompleted ? 'X' : ' '}] ${idx + 1}. ${wi.title}${wi.price ? ` (${formatCurrency(wi.price)})` : ''}\n`;
        if (wi.description) text += `    Details: ${wi.description}\n`;
      });
      text += `\n`;
    }
    if (ticket.timesheets && ticket.timesheets.length > 0) {
      text += `${lblTimesheets}:\n`;
      ticket.timesheets.forEach(ts => {
        text += `- ${formatDate(ts.date)} | ${ts.staff || t('support.th_assignee', undefined, 'Service')}: ${ts.description} (${ts.hours} h)\n`;
      });
      text += `Total: ${totalWorkHours.toFixed(1)} h\n\n`;
    }
    text += `SUMMARY / CALCULATION:\n`;
    text += `${lblWorkHours}: ${totalWorkHours.toFixed(1)} h @ ${formatCurrency(hourlyRate)} = ${formatCurrency(hoursAmount)}\n`;
    if (workItemsAmount > 0) {
      text += `${lblPositions}: ${formatCurrency(workItemsAmount)}\n`;
    }
    text += `${lblNet}: ${formatCurrency(totalSubtotal)}\n`;
    text += `${lblGross} (${t('support.summary_plus_tax', { rate: String(taxRate) }, `+ ${taxRate}% VAT`)}): ${formatCurrency(totalGross)}\n`;
    text += `=================================================\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Modal Top Control Bar (Hidden when printing) */}
        <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span>{t('support.print_modal_title', undefined, 'Servicebericht & Beleg')}</span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400">({ticket.ticketNumber})</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {t('support.print_modal_subtitle', undefined, 'DIN-A4 Kundendienstbericht für Druck oder PDF-Export')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTextReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              title={t('support.copy_report_title', undefined, 'Copy report as plain text')}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t('support.btn_copied', undefined, 'Kopiert!') : t('support.btn_copy_text', undefined, 'Text kopieren')}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('support.btn_print_pdf', undefined, 'Drucken / Als PDF speichern')}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              title={t('action.close', undefined, 'Close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable DIN-A4 Sheet Container */}
        <div className="overflow-y-auto p-4 sm:p-10 bg-slate-100/70 dark:bg-slate-950 flex justify-center print-container">
          <div className="relative bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 shadow-lg rounded-xl print:shadow-none print:p-0 print:m-0 flex flex-col justify-between border border-slate-200/80 print:border-none font-sans text-xs">
            
            {/* DIN 5008 Fold & Punch Marks */}
            {showFoldMarks && (
              <div className="absolute left-0 top-0 bottom-0 pointer-events-none print:block">
                <div className="absolute left-1 top-[105mm] w-3 h-[1px] bg-slate-300" />
                <div className="absolute left-1 top-[148.5mm] w-5 h-[1px] bg-slate-400" />
                <div className="absolute left-1 top-[210mm] w-3 h-[1px] bg-slate-300" />
              </div>
            )}

            <div>
              {/* 1. Header with Company Info & Logo */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                    {company.name || t('support.default_company_service', undefined, 'Customer Support & Service')}
                  </h1>
                  {company.subtitle && (
                    <p className="text-xs text-slate-500 font-medium">{company.subtitle}</p>
                  )}
                  <p className="text-[11px] text-slate-600 mt-1">
                    {[company.address, company.zip && company.city ? `${company.zip} ${company.city}` : company.city]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                  {(company.phone || company.email) && (
                    <p className="text-[10px] text-slate-500">
                      {[company.phone ? `Tel: ${company.phone}` : null, company.email ? `E-Mail: ${company.email}` : null]
                        .filter(Boolean)
                        .join(' | ')}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt="Logo" className="max-h-12 max-w-[140px] object-contain mb-1 ml-auto" />
                  ) : null}
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs rounded uppercase tracking-wider">
                    {t('support.report_doc_type', undefined, 'Servicebericht')}
                  </div>
                  <div className="font-mono text-sm font-black text-slate-900 mt-1">
                    {ticket.ticketNumber}
                  </div>
                </div>
              </div>

              {/* 2. Customer & Metadata Grid */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                    {t('support.th_customer', undefined, 'Kunde / Auftraggeber')}
                  </span>
                  <div className="font-bold text-sm text-slate-900">
                    {ticket.contact_name || t('support.customer_none', undefined, '– Kein Kunde zugeordnet –')}
                  </div>
                  {ticket.contact_company && (
                    <div className="text-xs text-slate-700 font-medium">{ticket.contact_company}</div>
                  )}
                  {ticket.contact_phone && (
                    <div className="text-[11px] text-slate-600 mt-1">Tel: {ticket.contact_phone}</div>
                  )}
                  {ticket.contact_email && (
                    <div className="text-[11px] text-slate-600">E-Mail: {ticket.contact_email}</div>
                  )}
                </div>

                <div className="space-y-1 text-right">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">{t('support.th_date', undefined, 'Datum')}:</span>
                    <span className="font-semibold text-slate-800">{formatDate(ticket.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">{t('support.th_status', undefined, 'Status')}:</span>
                    <span className="font-bold text-slate-900">{getStatusLabel(ticket.status)}</span>
                  </div>
                  {ticket.team && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">{t('support.th_team', undefined, 'Team')}:</span>
                      <span className="text-slate-800 font-medium">{ticket.team}</span>
                    </div>
                  )}
                  {ticket.assignedStaff && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">{t('support.th_assignee', undefined, 'Techniker')}:</span>
                      <span className="text-slate-800 font-medium">{ticket.assignedStaff}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Ticket Title & Problem Description */}
              <div className="mb-6 p-4 rounded-xl border border-slate-200">
                <h2 className="font-bold text-sm text-slate-900 mb-1">
                  {ticket.title}
                </h2>
                {ticket.description ? (
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {ticket.description}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    {t('support.no_description', undefined, 'Keine detaillierte Fehlerbeschreibung hinterlegt.')}
                  </p>
                )}
              </div>

              {/* 4. Service-Positionen & Arbeitsschritte (Work Items) */}
              {workItems.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
                    <span>{t('support.tab_work_items', undefined, 'Service-Positionen & Arbeitsschritte')}</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      {t('support.tasks_completed_count', { completed: String(workItems.filter(w => w.isCompleted).length), total: String(workItems.length) }, `${workItems.filter(w => w.isCompleted).length} of ${workItems.length} completed`)}
                    </span>
                  </h3>
                  <table className="w-full text-left text-xs border-collapse border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 w-8 text-center">✓</th>
                        <th className="py-2 px-3">{t('support.work_item_title', undefined, 'Aufgabe / Position')}</th>
                        <th className="py-2 px-3">{t('support.work_item_notes', undefined, 'Details / Notizen')}</th>
                        <th className="py-2 px-3 text-right w-28">{t('support.work_item_price', undefined, 'Betrag')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {workItems.map((item, idx) => (
                        <tr key={item.id} className={item.isCompleted ? 'bg-slate-50/50' : ''}>
                          <td className="py-2 px-3 text-center">
                            {item.isCompleted ? (
                              <span className="text-emerald-600 font-bold">✓</span>
                            ) : (
                              <span className="text-slate-300 font-bold">○</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {item.title}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {item.description || '–'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {item.price ? formatCurrency(item.price) : '–'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. Zeiterfassung / Timesheets */}
              {ticket.timesheets && ticket.timesheets.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-2">
                    {t('support.tab_timesheets', undefined, 'Erbrachte Arbeitszeit & Leistungen')}
                  </h3>
                  <table className="w-full text-left text-xs border-collapse border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 w-24">{t('support.th_date', undefined, 'Datum')}</th>
                        <th className="py-2 px-3 w-32">{t('support.th_assignee', undefined, 'Mitarbeiter')}</th>
                        <th className="py-2 px-3">{t('support.th_description', undefined, 'Tätigkeit')}</th>
                        <th className="py-2 px-3 text-right w-20">{t('support.th_hours', undefined, 'Dauer')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {ticket.timesheets.map((ts) => (
                        <tr key={ts.id}>
                          <td className="py-2 px-3 text-slate-600">{formatDate(ts.date)}</td>
                          <td className="py-2 px-3 text-slate-800 font-medium">{ts.staff || t('support.th_assignee', undefined, 'Technician')}</td>
                          <td className="py-2 px-3 text-slate-700">{ts.description}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">{ts.hours} h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6. Settlement / Calculation Summary */}
              <div className="flex justify-end mb-8">
                <div className="w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('support.summary_work_hours', undefined, 'Working hours')} ({totalWorkHours.toFixed(1)} h @ {formatCurrency(hourlyRate)}):</span>
                    <span className="font-mono font-medium">{formatCurrency(hoursAmount)}</span>
                  </div>
                  {workItemsAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t('support.summary_positions_flat_rate', undefined, 'Service items / flat-rates')}:</span>
                      <span className="font-mono font-medium">{formatCurrency(workItemsAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 font-semibold">
                    <span className="text-slate-800">{t('support.summary_net_amount', undefined, 'Net amount')}:</span>
                    <span className="font-mono">{formatCurrency(totalSubtotal)}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between text-slate-600 text-[11px]">
                      <span>{t('support.summary_plus_tax', { rate: String(taxRate) }, `plus ${taxRate}% VAT`)}:</span>
                      <span className="font-mono">{formatCurrency(taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t-2 border-slate-900 font-bold text-sm text-slate-900">
                    <span>{t('support.summary_gross_total', undefined, 'Total amount')}:</span>
                    <span className="font-mono text-cyan-700">{formatCurrency(totalGross)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. Bottom Signature Lines & Legal Note */}
            <div className="pt-6 border-t border-slate-200 mt-auto">
              <p className="text-[10px] text-slate-500 mb-6 italic text-center">
                {t('support.report_signature_disclaimer', undefined, 'Die aufgeführten Leistungen und Arbeitszeiten wurden ordnungsgemäß und vollständig erbracht.')}
              </p>

              <div className="grid grid-cols-2 gap-12 pt-4">
                <div>
                  <div className="border-b border-slate-400 h-10 mb-1" />
                  <div className="text-[10px] font-bold text-slate-700 text-center uppercase tracking-wider">
                    {t('support.signature_customer', undefined, 'Datum & Unterschrift Kunde / Auftraggeber')}
                  </div>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-10 mb-1" />
                  <div className="text-[10px] font-bold text-slate-700 text-center uppercase tracking-wider">
                    {t('support.signature_technician', undefined, 'Datum & Unterschrift Servicetechniker')}
                  </div>
                </div>
              </div>

              {/* Legal & Banking Footer */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between text-[9px] text-slate-400">
                <span>{company.name} • {company.city}</span>
                {company.iban && <span>IBAN: {company.iban} {company.bic ? `• BIC: ${company.bic}` : ''}</span>}
                {company.tax_number && <span>{t('support.tax_number_abbr', undefined, 'Tax No.')}: {company.tax_number}</span>}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
