import { Contact } from '../types';

/**
 * Escapes characters for vCard text values
 */
function escapeVCard(str: string): string {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates an RFC 2426 vCard 3.0 text payload
 */
export function generateVCardText(contact: Contact): string {
  const parts = contact.name.trim().split(' ');
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
  const firstName = parts[0] || '';

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCard(contact.name)}`,
    `N:${escapeVCard(lastName)};${escapeVCard(firstName)};;;`,
    contact.company ? `ORG:${escapeVCard(contact.company)}` : null,
    contact.email ? `EMAIL;TYPE=INTERNET,PREF:${contact.email}` : null,
    contact.phone ? `TEL;TYPE=WORK,VOICE:${contact.phone}` : null,
    (contact.street || contact.city || contact.zip || contact.country) 
      ? `ADR;TYPE=WORK:;;${escapeVCard(contact.street || '')};${escapeVCard(contact.city || '')};;${escapeVCard(contact.zip || '')};${escapeVCard(contact.country || 'Deutschland')}`
      : null,
    contact.taxId ? `NOTE;CHARSET=UTF-8:USt-IdNr: ${escapeVCard(contact.taxId)} ${contact.notes ? ' | ' + escapeVCard(contact.notes) : ''}` : (contact.notes ? `NOTE;CHARSET=UTF-8:${escapeVCard(contact.notes)}` : null),
    'REV:' + new Date().toISOString(),
    'END:VCARD'
  ].filter(Boolean);

  return lines.join('\r\n');
}

/**
 * Downloads a vCard (.vcf) file for a contact
 */
export function downloadVCard(contact: Contact) {
  const vcard = generateVCardText(contact);
  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(contact.name || 'Kontakt').replace(/[^a-zA-Z0-9_-]/g, '_')}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
