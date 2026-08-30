import { Contact, Invoice, CompanyProfile } from '../types';

/**
 * Encodes text properly for RFC 822 E-Mail headers (MIME Word encoding if non-ASCII)
 */
function encodeMimeHeader(text: string): string {
  // If only ASCII, return as is
  if (/^[\x20-\x7E]*$/.test(text)) {
    return text;
  }
  // Otherwise UTF-8 Base64 MIME word
  const encoded = btoa(unescape(encodeURIComponent(text)));
  return `=?UTF-8?B?${encoded}?=`;
}

/**
 * Downloads a text content as a file in the browser
 */
function downloadFile(content: string, filename: string, mimeType: string = 'message/rfc822') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates an RFC 822 (.eml) draft file for general partner/customer communication
 */
export function generateContactEml(contact: Contact, company?: CompanyProfile) {
  const senderEmail = company?.email || 'buchhaltung@firma.local';
  const senderName = company?.name || 'SOCDOF ERP';
  const recipientEmail = contact.email || 'kunde@kontakt.local';
  const recipientName = contact.name || 'Sehr geehrte Damen und Herren';
  const subject = `Mitteilung von ${company?.name || 'Ihrem Partner'} an ${contact.name}`;
  const now = new Date().toUTCString();

  const body = [
    `Sehr geehrte(r) Frau/Herr ${contact.name},`,
    '',
    `wir freuen uns über den geschäftlichen Austausch mit Ihnen.`,
    '',
    contact.company ? `Unternehmen: ${contact.company}` : '',
    contact.phone ? `Telefon: ${contact.phone}` : '',
    '',
    `Mit freundlichen Grüßen,`,
    `${senderName}`,
    company?.street ? `${company.street}, ${company.zip_city || ''}` : '',
    company?.phone ? `Tel.: ${company.phone}` : '',
    company?.email ? `E-Mail: ${company.email}` : ''
  ].filter(line => line !== undefined).join('\r\n');

  const emlContent = [
    `From: "${encodeMimeHeader(senderName)}" <${senderEmail}>`,
    `To: "${encodeMimeHeader(recipientName)}" <${recipientEmail}>`,
    `Subject: ${encodeMimeHeader(subject)}`,
    `Date: ${now}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8; format=flowed`,
    `Content-Transfer-Encoding: 8bit`,
    `X-Unsent: 1`,
    `X-Mailer: SOCDOF ERP Offline Suite`,
    '',
    body
  ].join('\r\n');

  const safeFilename = `EML_Entwurf_${(contact.name || 'Kontakt').replace(/[^a-zA-Z0-9_-]/g, '_')}.eml`;
  downloadFile(emlContent, safeFilename);
}

/**
 * Generates an RFC 822 (.eml) draft file for an Invoice dispatch with banking & payment info
 */
export function generateInvoiceEml(invoice: Invoice, company?: CompanyProfile) {
  const senderEmail = company?.email || 'rechnung@firma.local';
  const senderName = company?.name || 'Rechnungsabteilung';
  const recipientEmail = invoice.contact_email || 'kunde@kontakt.local';
  const recipientName = invoice.contact_name || invoice.contact_company || 'Kunde';
  const currency = company?.currency || '€';
  const subject = `Rechnung ${invoice.number} – ${company?.name || 'SOCDOF ERP'}`;
  const now = new Date().toUTCString();

  const formattedTotal = `${invoice.total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  const formattedDueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-DE') : 'sofort';

  const itemsList = invoice.items?.map(it => `  • ${it.product_name || 'Artikel'} (${it.qty || 1}x) : ${(it.subtotal || (it.unit_price * (it.qty || 1))).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${currency}`).join('\r\n') || '';

  const body = [
    `Sehr geehrte Damen und Herren,`,
    `sehr geehrte(r) ${recipientName},`,
    '',
    `anbei erhalten Sie die Abrechnung zu Ihrem Auftrag / Ihrer Bestellung.`,
    '',
    `==================================================`,
    `RECHNUNGSDETAILS`,
    `==================================================`,
    `Rechnungsnummer : ${invoice.number}`,
    `Rechnungsdatum  : ${new Date(invoice.date).toLocaleDateString('de-DE')}`,
    `Fälligkeitsdatum: ${formattedDueDate}`,
    `Gesamtbetrag    : ${formattedTotal} (inkl. MwSt.)`,
    '',
    `Positionen:`,
    itemsList,
    '',
    `==================================================`,
    `ZAHLUNGSINFORMATIONEN`,
    `==================================================`,
    company?.bank_name ? `Bankinstitut    : ${company.bank_name}` : '',
    company?.iban ? `IBAN            : ${company.iban}` : '',
    company?.bic ? `BIC / SWIFT     : ${company.bic}` : '',
    `Verwendungszweck: ${invoice.number}`,
    '',
    `Bitte überweisen Sie den fälligen Betrag bis zum ${formattedDueDate} unter Angabe der Rechnungsnummer.`,
    '',
    `Bei Fragen zu dieser Rechnung stehen wir Ihnen jederzeit gerne zur Verfügung.`,
    '',
    `Mit freundlichen Grüßen,`,
    `${senderName}`,
    company?.street ? `${company.street}, ${company.zip_city || ''}` : '',
    company?.tax_id ? `USt-IdNr.: ${company.tax_id}` : '',
    company?.phone ? `Tel.: ${company.phone}` : ''
  ].filter(line => line !== undefined && line !== '').join('\r\n');

  const emlContent = [
    `From: "${encodeMimeHeader(senderName)}" <${senderEmail}>`,
    `To: "${encodeMimeHeader(recipientName)}" <${recipientEmail}>`,
    `Subject: ${encodeMimeHeader(subject)}`,
    `Date: ${now}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8; format=flowed`,
    `Content-Transfer-Encoding: 8bit`,
    `X-Unsent: 1`,
    `X-Mailer: SOCDOF ERP Offline Suite`,
    '',
    body
  ].join('\r\n');

  const safeFilename = `Rechnung_${invoice.number.replace(/[^a-zA-Z0-9_-]/g, '_')}_Entwurf.eml`;
  downloadFile(emlContent, safeFilename);
}
