import { Contact, ContactType } from '../types';
import { db } from './db';

/**
 * Utility to parse RFC 4180 CSV content with support for:
 * - Multi-character quoted strings
 * - Escaped double quotes ("")
 * - Embedded newlines and commas/semicolons inside quotes
 * - Auto-detection of delimiter (comma, semicolon, tab)
 */
export function parseCsvRows(text: string): { delimiter: string; rows: string[][] } {
  // Determine delimiter from the first line or first 1500 characters
  const sample = text.slice(0, 1500);
  const firstLine = sample.split(/\r?\n/)[0] || '';
  
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      currentVal = '';
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return { delimiter, rows };
}

function cleanVal(v: string | undefined): string {
  if (!v) return '';
  return v.replace(/^["']|["']$/g, '').trim();
}

function findHeaderIndex(headers: string[], patterns: string[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex(h => h === pattern || h.includes(pattern));
    if (idx !== -1) return idx;
  }
  return -1;
}

function findMatchingIndices(headers: string[], patterns: string[]): number[] {
  const matches: number[] = [];
  for (const pattern of patterns) {
    headers.forEach((h, idx) => {
      if ((h === pattern || h.includes(pattern)) && !matches.includes(idx)) {
        matches.push(idx);
      }
    });
  }
  return matches;
}

function extractFirstNonEmpty(cols: string[], indices: number[]): string {
  for (const idx of indices) {
    if (idx !== -1 && cols[idx]) {
      const val = cleanVal(cols[idx]);
      if (val) return val;
    }
  }
  return '';
}

/**
 * Intelligent CSV / Outlook / Google / Apple contacts parser
 */
export function parseContactsCsv(text: string, defaultType: ContactType = 'guest'): Contact[] {
  const { rows } = parseCsvRows(text);
  if (rows.length < 2) return [];

  const headerRow = rows[0];
  const normalizedHeaders = headerRow.map(h => 
    h.toLowerCase()
     .replace(/^["']|["']$/g, '')
     .replace(/[\-_]/g, ' ')
     .trim()
  );

  // Exact & fuzzy column detection
  const firstNameIdx = findHeaderIndex(normalizedHeaders, [
    'first name', 'vorname', 'given name', 'given yomi', 'prénom', 'nombre', 'nome'
  ]);
  const lastNameIdx = findHeaderIndex(normalizedHeaders, [
    'last name', 'nachname', 'family name', 'surname', 'surname yomi', 'nom', 'apellido', 'cognome'
  ]);
  const middleNameIdx = findHeaderIndex(normalizedHeaders, [
    'middle name', 'zweiter vorname', 'segundo nombre'
  ]);
  const fullNameIdx = findHeaderIndex(normalizedHeaders, [
    'display name', 'full name', 'kontaktname', 'anzeigename', 'contact name', 'name', 'kontakt', 'contact'
  ]);

  // Email columns
  const emailIndices = findMatchingIndices(normalizedHeaders, [
    'e-mail address', 'email address', 'e-mail 1 address', 'e-mail 2 address', 'e-mail 3 address',
    'e-mail', 'email', 'e mail', 'mail', 'courriel', 'correo', 'posta elettronica'
  ]);

  // Phone columns (prioritize Mobile/Cell, then Primary, then Business, then Home, then generic)
  const mobilePhoneIndices = findMatchingIndices(normalizedHeaders, [
    'mobile phone', 'cell phone', 'mobiltelefon', 'mobil', 'handy', 'cell', 'cellular', 'mobile'
  ]);
  const primaryPhoneIndices = findMatchingIndices(normalizedHeaders, [
    'primary phone', 'main phone', 'company main phone', 'haupttelefon'
  ]);
  const businessPhoneIndices = findMatchingIndices(normalizedHeaders, [
    'business phone', 'business phone 2', 'work phone', 'telefon geschäftlich', 'geschäftlich'
  ]);
  const homePhoneIndices = findMatchingIndices(normalizedHeaders, [
    'home phone', 'home phone 2', 'telefon privat', 'privattelefon', 'privat'
  ]);
  const generalPhoneIndices = findMatchingIndices(normalizedHeaders, [
    'phone', 'telefon', 'tel', 'telefono', 'téléphone'
  ]);

  const companyIdx = findHeaderIndex(normalizedHeaders, [
    'company', 'firma', 'organization', 'organisation', 'unternehm', 'société', 'empresa', 'azienda', 'org'
  ]);

  const streetIndices = findMatchingIndices(normalizedHeaders, [
    'business street', 'home street', 'other street', 'street', 'strasse', 'straße', 'adresse', 'address', 'calle', 'via'
  ]);
  const cityIndices = findMatchingIndices(normalizedHeaders, [
    'business city', 'home city', 'other city', 'city', 'stadt', 'ort', 'ville', 'ciudad', 'comune', 'località'
  ]);
  const zipIndices = findMatchingIndices(normalizedHeaders, [
    'business postal code', 'home postal code', 'other postal code', 'postal code', 'zip', 'plz', 'postleitzahl', 'code postal', 'código postal', 'cap'
  ]);
  const countryIndices = findMatchingIndices(normalizedHeaders, [
    'business country/region', 'home country/region', 'other country/region', 'country/region', 'country', 'land', 'pays', 'país', 'stato', 'nazione'
  ]);
  const notesIndices = findMatchingIndices(normalizedHeaders, [
    'notes', 'notizen', 'bemerkungen', 'kommentar', 'anmerkungen', 'remarques', 'notas', 'note'
  ]);
  const taxIdIndices = findMatchingIndices(normalizedHeaders, [
    'tax id', 'vat', 'ustid', 'ust-idnr', 'partita iva', 'fiscal code', 'steuernummer', 'cif', 'nif'
  ]);
  const typeIdx = findHeaderIndex(normalizedHeaders, ['typ', 'type', 'kontakt-typ', 'contact type']);

  const parsedContacts: Contact[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length === 0 || cols.every(c => c.length === 0)) continue;

    const firstName = firstNameIdx !== -1 ? cleanVal(cols[firstNameIdx]) : '';
    const middleName = middleNameIdx !== -1 ? cleanVal(cols[middleNameIdx]) : '';
    const lastName = lastNameIdx !== -1 ? cleanVal(cols[lastNameIdx]) : '';
    const fullName = fullNameIdx !== -1 ? cleanVal(cols[fullNameIdx]) : '';
    const company = companyIdx !== -1 ? cleanVal(cols[companyIdx]) : '';

    // Resolve comprehensive contact name
    let resolvedName = '';
    if (firstName && lastName) {
      resolvedName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;
    } else if (firstName) {
      resolvedName = firstName;
    } else if (lastName) {
      resolvedName = lastName;
    } else if (fullName) {
      resolvedName = fullName;
    } else if (company) {
      resolvedName = company;
    } else {
      resolvedName = `Kontakt ${i}`;
    }

    // Resolve email (CRITICAL: NEVER insert dummy/placeholder emails!)
    let resolvedEmail = '';
    for (const idx of emailIndices) {
      const val = cleanVal(cols[idx]);
      if (val && val.includes('@') && !val.includes('@import.local') && !val.includes('@kontakt.local')) {
        resolvedEmail = val;
        break;
      }
    }

    // Resolve phone (check mobile, primary, business, home, general)
    let resolvedPhone = '';
    const prioritizedPhoneIndices = [
      ...mobilePhoneIndices,
      ...primaryPhoneIndices,
      ...businessPhoneIndices,
      ...homePhoneIndices,
      ...generalPhoneIndices
    ];
    for (const idx of prioritizedPhoneIndices) {
      const val = cleanVal(cols[idx]);
      if (val && val.replace(/[^\d+]/g, '').length >= 3) {
        resolvedPhone = val;
        break;
      }
    }

    const street = extractFirstNonEmpty(cols, streetIndices);
    const zip = extractFirstNonEmpty(cols, zipIndices);
    const city = extractFirstNonEmpty(cols, cityIndices);
    const country = extractFirstNonEmpty(cols, countryIndices);
    const notes = extractFirstNonEmpty(cols, notesIndices);
    const taxId = extractFirstNonEmpty(cols, taxIdIndices);

    let resolvedType: ContactType = defaultType;
    if (typeIdx !== -1 && cols[typeIdx]) {
      const tVal = cleanVal(cols[typeIdx]).toLowerCase();
      if (tVal.includes('vendor') || tVal.includes('lieferant')) resolvedType = 'vendor';
      else if (tVal.includes('guest') || tVal.includes('gast') || tVal.includes('buch')) resolvedType = 'guest';
      else if (tVal.includes('both') || tVal.includes('beide') || tVal.includes('partner')) resolvedType = 'both';
      else if (tVal.includes('customer') || tVal.includes('kunde')) resolvedType = 'customer';
    }

    parsedContacts.push({
      name: resolvedName,
      email: resolvedEmail,
      phone: resolvedPhone,
      company,
      type: resolvedType,
      street: street || undefined,
      zip: zip || undefined,
      city: city || undefined,
      country: country || undefined,
      notes: notes || undefined,
      taxId: taxId || undefined,
      createdAt: new Date().toISOString()
    });
  }

  return parsedContacts;
}

/**
 * Intelligent vCard (.vcf / .vcard) parser
 */
export function parseContactsVcard(text: string, defaultType: ContactType = 'guest'): Contact[] {
  const vcards = text.split(/BEGIN:VCARD/i).filter(Boolean);
  const parsedContacts: Contact[] = [];

  for (const card of vcards) {
    const fnMatch = card.match(/FN:(.+)/i);
    const nMatch = card.match(/N:([^;\r\n]*);?([^;\r\n]*)/i);
    const emailMatch = card.match(/EMAIL[^:]*:(.+)/i);
    const orgMatch = card.match(/ORG:(.+)/i);
    const telMatch = card.match(/TEL[^:]*:(.+)/i);
    const adrMatch = card.match(/ADR[^:]*:(.+)/i);
    const noteMatch = card.match(/NOTE:(.+)/i);

    let name = fnMatch ? fnMatch[1].trim() : '';
    if (!name && nMatch) {
      const lastName = nMatch[1]?.trim() || '';
      const firstName = nMatch[2]?.trim() || '';
      name = `${firstName} ${lastName}`.trim();
    }

    const email = emailMatch ? emailMatch[1].trim() : '';
    const cleanEmail = (email.includes('@') && !email.includes('@import.local') && !email.includes('@kontakt.local')) ? email : '';
    const company = orgMatch ? orgMatch[1].replace(/;/g, ' ').trim() : '';
    const phone = telMatch ? telMatch[1].trim() : '';
    const notes = noteMatch ? noteMatch[1].replace(/\\n/g, '\n').trim() : '';

    let city = '';
    let zip = '';
    let street = '';
    let country = '';
    if (adrMatch) {
      const parts = adrMatch[1].split(';');
      street = parts[2]?.trim() || '';
      city = parts[3]?.trim() || '';
      zip = parts[5]?.trim() || '';
      country = parts[6]?.trim() || '';
    }

    if (name || cleanEmail || phone || company) {
      parsedContacts.push({
        name: name || company || 'Unbenannter Kontakt',
        email: cleanEmail,
        phone,
        company,
        street: street || undefined,
        zip: zip || undefined,
        city: city || undefined,
        country: country || undefined,
        notes: notes || undefined,
        type: defaultType,
        createdAt: new Date().toISOString()
      });
    }
  }

  return parsedContacts;
}

/**
 * Universal CSV Exporter with Excel / Outlook UTF-8 BOM
 */
export function exportContactsToCsv(contacts: Contact[], delimiter: ';' | ',' = ';'): string {
  const headers = [
    'Vorname',
    'Nachname',
    'Vollständiger Name',
    'Firma',
    'E-Mail-Adresse',
    'Telefon / Mobiltelefon',
    'Kontakt-Kategorie / Typ',
    'Strasse',
    'Postleitzahl',
    'Stadt',
    'Land',
    'USt-IdNr',
    'Notizen'
  ];

  const rows = contacts.map(c => {
    const parts = (c.name || '').trim().split(' ');
    const lastName = parts.length > 1 ? parts.pop() || '' : '';
    const firstName = parts.join(' ') || (lastName ? '' : c.name || '');

    const typeLabel = 
      c.type === 'guest' ? 'Gästebuch / Privat' :
      c.type === 'customer' ? 'Kunde' :
      c.type === 'vendor' ? 'Lieferant' : 'Partner (Beides)';

    return [
      `"${firstName.replace(/"/g, '""')}"`,
      `"${lastName.replace(/"/g, '""')}"`,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.company || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${typeLabel}"`,
      `"${(c.street || '').replace(/"/g, '""')}"`,
      `"${(c.zip || '').replace(/"/g, '""')}"`,
      `"${(c.city || '').replace(/"/g, '""')}"`,
      `"${(c.country || '').replace(/"/g, '""')}"`,
      `"${(c.taxId || '').replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ].join(delimiter);
  });

  return '\uFEFF' + [headers.join(delimiter), ...rows].join('\r\n');
}

/**
 * Universal vCard 3.0 Exporter (.vcf)
 */
export function exportContactsToVCard(contacts: Contact[]): string {
  return contacts.map(c => {
    const parts = (c.name || '').trim().split(' ');
    const lastName = parts.length > 1 ? parts.pop() || '' : '';
    const firstName = parts.join(' ') || (lastName ? '' : c.name || '');

    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${c.name || c.company || 'Kontakt'}`,
      `N:${lastName};${firstName};;;`
    ];

    if (c.company) lines.push(`ORG:${c.company}`);
    if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${c.email}`);
    if (c.phone) lines.push(`TEL;TYPE=CELL,VOICE:${c.phone}`);
    if (c.street || c.city || c.zip || c.country) {
      lines.push(`ADR;TYPE=HOME,WORK:;;${c.street || ''};${c.city || ''};;${c.zip || ''};${c.country || ''}`);
    }
    if (c.notes) {
      lines.push(`NOTE:${c.notes.replace(/\r?\n/g, '\\n')}`);
    }
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }).join('\r\n\r\n');
}

/**
 * Helper to download content as a file in browser
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
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
 * Cleans up any legacy dummy emails like kontakt_X@import.local from the database
 */
export async function sanitizeLegacyContacts(): Promise<number> {
  try {
    const all = await db.contacts.toArray();
    let cleanedCount = 0;
    for (const c of all) {
      if (c.email && (c.email.includes('@import.local') || c.email.includes('@kontakt.local'))) {
        if (c.id) {
          await db.contacts.update(c.id, { email: '' });
          cleanedCount++;
        }
      }
    }
    return cleanedCount;
  } catch (err) {
    console.error('Failed to sanitize legacy contacts:', err);
    return 0;
  }
}
