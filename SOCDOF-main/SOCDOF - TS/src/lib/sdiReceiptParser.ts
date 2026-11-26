import { SdIStatus, SdIReceiptType } from '../types';

export interface SdIErrorDetail {
  code: string;
  description: string;
  solutionHint?: string;
}

export interface ParsedSdIReceipt {
  receiptType: SdIReceiptType;
  receiptTypeName: string;
  sdiStatus: SdIStatus;
  identifierSdI: string; // IdentificativoSdI
  fileName: string; // NomeFile (e.g. IT01234567890_00001.xml)
  receiptDate: string; // ISO date/time string
  deliveryDate?: string; // DataOraConsegna
  disposalDate?: string; // DataOraMessaADisposizione (cassetto fiscale)
  recipientCode?: string; // Codice destinatario o canale
  recipientDescription?: string;
  outcome?: 'EC01' | 'EC02' | string; // EC01 = Accettazione, EC02 = Rifiuto
  outcomeDescription?: string;
  errors: SdIErrorDetail[];
  notes?: string;
  rawXml: string;
}

/**
 * Common Italian Agenzia delle Entrate (SdI) Error Code Catalog
 */
export const SDI_ERROR_CATALOG: Record<string, { title: string; hint: string }> = {
  '00200': {
    title: 'Codice Fiscale non valido',
    hint: 'Der angegebene Steuercode (Codice Fiscale) des Empfängers ist ungültig oder nicht bei der Agenzia delle Entrate registriert.'
  },
  '00201': {
    title: 'Partita IVA non valida',
    hint: 'Die angegebene Umsatzsteuer-Identifikationsnummer (P.IVA) ist formal ungültig oder erloschen.'
  },
  '00305': {
    title: 'IdTrasmittente non abilitato',
    hint: 'Der Übermittler ist für das SdI-System nicht registriert oder die MwSt.-ID des Senders ist unvollständig.'
  },
  '00311': {
    title: 'Codice Destinatario non valido',
    hint: 'Der Empfängercode (Codice Destinatario) muss genau 7 Zeichen lang sein (oder 6 für Behörden/PA), z.B. 0000000 oder SUBM70N.'
  },
  '00312': {
    title: 'Codice Destinatario PA non attivo',
    hint: 'Der Behördencode (IPA) der öffentlichen Verwaltung ist inaktiv oder geschlossen.'
  },
  '00313': {
    title: 'PECDestinatario non valido',
    hint: 'Die angegebene PEC-E-Mail-Adresse für die Zustellung ist formal ungültig.'
  },
  '00400': {
    title: 'Aliquota IVA non valida',
    hint: 'Der Steuersatz der Rechnungspositionen stimmt nicht mit den gesetzlichen italienischen MwSt.-Sätzen (22%, 10%, 5%, 4%, 0%) überein.'
  },
  '00404': {
    title: 'Fattura duplicata',
    hint: 'Eine Rechnung mit dieser Rechnungsnummer und diesem Kalenderjahr wurde bereits erfolgreich an das SdI übermittelt.'
  },
  '00418': {
    title: 'Data fattura futura non ammessa',
    hint: 'Das Rechnungsdatum liegt in der Zukunft oder nach dem Sendezeitpunkt.'
  },
  '00425': {
    title: 'Dati Bollo non conformi',
    hint: 'Angaben zur Stempelsteuer (Bollo Virtuale 2,00 €) sind unvollständig oder fehlerhaft angegeben.'
  },
  '00471': {
    title: 'Codice CIG/CUP mancante o non conforme',
    hint: 'Bei Rechnungen an die öffentliche Hand (PA) fehlen die gesetzlich geforderten CIG- oder CUP-Ausschreibungscodes.'
  }
};

/**
 * Checks whether an XML string is an official Italian SdI Receipt or Notification.
 */
export function isSdIReceiptXml(xmlString: string): boolean {
  if (!xmlString) return false;
  const lower = xmlString.toLowerCase();
  return (
    lower.includes('ricevutaconsegna') ||
    lower.includes('notificascarto') ||
    lower.includes('notificamancataconsegna') ||
    lower.includes('notificaesito') ||
    lower.includes('notificadecorrenzatermini') ||
    lower.includes('attestazionetrasmessafattura')
  );
}

/**
 * Parses an Italian SdI XML Notification or Receipt.
 */
export function parseSdIReceiptXml(xmlString: string): ParsedSdIReceipt {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`SdI XML-Parsing Fehler: ${parseError.textContent || 'Ungültige XML-Struktur'}`);
  }

  const getText = (tag: string, context: Element | Document = doc): string => {
    // Try standard selector
    const el = context.querySelector(tag);
    if (el && el.textContent) return el.textContent.trim();

    // Fallback: search by localName ignoring namespace prefix
    const allEls = context.getElementsByTagName('*');
    for (let i = 0; i < allEls.length; i++) {
      if (allEls[i].localName.toLowerCase() === tag.toLowerCase()) {
        return allEls[i].textContent?.trim() || '';
      }
    }
    return '';
  };

  const getElementByLocalName = (tag: string, context: Element | Document = doc): Element | null => {
    const allEls = context.getElementsByTagName('*');
    for (let i = 0; i < allEls.length; i++) {
      if (allEls[i].localName.toLowerCase() === tag.toLowerCase()) {
        return allEls[i];
      }
    }
    return null;
  };

  const rootElement = doc.documentElement;
  const rootTag = rootElement.localName.toLowerCase();

  const identifierSdI = getText('IdentificativoSdI') || getText('IdentificativoSDI');
  const fileName = getText('NomeFile');
  const receiptDate = getText('DataOraRicezione') || new Date().toISOString();
  const note = getText('Note');

  // 1. Ricevuta di Consegna (RC) - Delivered
  if (rootTag.includes('ricevutaconsegna')) {
    const deliveryDate = getText('DataOraConsegna');
    const recipientCode = getText('Codice');
    const recipientDesc = getText('Descrizione');

    return {
      receiptType: 'RC',
      receiptTypeName: 'Ricevuta di Consegna (RC)',
      sdiStatus: 'delivered',
      identifierSdI,
      fileName,
      receiptDate,
      deliveryDate: deliveryDate || receiptDate,
      recipientCode,
      recipientDescription: recipientDesc,
      errors: [],
      notes: note || 'Die Rechnung wurde vom SdI erfolgreich an den Empfänger / PEC zugestellt.',
      rawXml: xmlString
    };
  }

  // 2. Notifica di Scarto (NS) - Rejected
  if (rootTag.includes('notificascarto')) {
    const errors: SdIErrorDetail[] = [];
    const errorNodes = doc.getElementsByTagName('*');
    
    for (let i = 0; i < errorNodes.length; i++) {
      const node = errorNodes[i];
      if (node.localName.toLowerCase() === 'errore') {
        const code = getText('Codice', node);
        const desc = getText('Descrizione', node);
        if (code || desc) {
          const catalogInfo = SDI_ERROR_CATALOG[code];
          errors.push({
            code: code || 'ERR',
            description: desc || catalogInfo?.title || 'Unbekannter SdI-Fehler',
            solutionHint: catalogInfo?.hint
          });
        }
      }
    }

    if (errors.length === 0) {
      const singleCode = getText('Codice');
      const singleDesc = getText('Descrizione');
      if (singleCode || singleDesc) {
        const catalogInfo = SDI_ERROR_CATALOG[singleCode];
        errors.push({
          code: singleCode || 'ERR',
          description: singleDesc || catalogInfo?.title || 'Fehler beim SdI-Prüflauf',
          solutionHint: catalogInfo?.hint
        });
      }
    }

    return {
      receiptType: 'NS',
      receiptTypeName: 'Notifica di Scarto (NS)',
      sdiStatus: 'rejected',
      identifierSdI,
      fileName,
      receiptDate,
      errors,
      notes: note || 'Die Rechnung wurde vom SdI aufgrund von Validierungsfehlern abgewiesen.',
      rawXml: xmlString
    };
  }

  // 3. Notifica di Mancata Consegna (MC) - Impossible Delivery / Placed in Tax Drawer
  if (rootTag.includes('notificamancataconsegna')) {
    const disposalDate = getText('DataOraMessaADisposizione');
    const desc = getText('Descrizione');

    return {
      receiptType: 'MC',
      receiptTypeName: 'Mancata Consegna (MC)',
      sdiStatus: 'failed_delivery',
      identifierSdI,
      fileName,
      receiptDate,
      disposalDate: disposalDate || receiptDate,
      errors: [],
      notes: desc || note || 'Die Rechnung konnte nicht direkt zugestellt werden und liegt im Steuerfach (Cassetto Fiscale) des Empfängers bereit.',
      rawXml: xmlString
    };
  }

  // 4. Notifica Esito Committente (NE) - PA Outcome
  if (rootTag.includes('notificaesito')) {
    const esito = getText('Esito'); // EC01 (Accettazione) or EC02 (Rifiuto)
    const isAccepted = esito === 'EC01';
    const desc = getText('Descrizione');

    return {
      receiptType: 'NE',
      receiptTypeName: isAccepted ? 'Esito Committente: Accettazione (EC01)' : 'Esito Committente: Rifiuto (EC02)',
      sdiStatus: isAccepted ? 'accepted' : 'refused',
      identifierSdI,
      fileName,
      receiptDate,
      outcome: esito,
      outcomeDescription: desc,
      errors: isAccepted ? [] : [{
        code: esito,
        description: desc || 'Die öffentliche Verwaltung hat die Rechnung beanstandet.',
        solutionHint: 'Bitte prüfen Sie die Mitteilung der Behörde und erstellen Sie ggf. eine Korrekturrechnung.'
      }],
      notes: note || (isAccepted ? 'Von der Behörde genehmigt.' : 'Von der Behörde abgelehnt.'),
      rawXml: xmlString
    };
  }

  // 5. Notifica Decorrenza Termini (DT) - 15 Days Passed
  if (rootTag.includes('notificadecorrenzatermini')) {
    return {
      receiptType: 'DT',
      receiptTypeName: 'Decorrenza Termini (DT)',
      sdiStatus: 'accepted',
      identifierSdI,
      fileName,
      receiptDate,
      errors: [],
      notes: '15 Tage nach Zustellung an die Behörde ohne Einwand verstrichen – die Rechnung gilt gesetzlich als angenommen.',
      rawXml: xmlString
    };
  }

  // 6. Attestazione Trasmessa Fattura (AT)
  if (rootTag.includes('attestazionetrasmessafattura')) {
    return {
      receiptType: 'AT',
      receiptTypeName: 'Attestazione di Trasmessa Fattura (AT)',
      sdiStatus: 'failed_delivery',
      identifierSdI,
      fileName,
      receiptDate,
      errors: [],
      notes: 'Bescheinigung über die erfolgte Übermittlung an das SdI.',
      rawXml: xmlString
    };
  }

  // Fallback general receipt
  return {
    receiptType: 'RC',
    receiptTypeName: `SdI Notifica (${rootElement.localName})`,
    sdiStatus: 'sent',
    identifierSdI,
    fileName,
    receiptDate,
    errors: [],
    notes: note || 'SdI Mitteilungsdokument verarbeitet.',
    rawXml: xmlString
  };
}

/**
 * Extracts invoice number hint from standard SdI filenames.
 * E.g. IT01234567890_00001.xml -> progressive 00001 or PA-00001
 */
export function extractInvoiceNumberHintFromFileName(fileName: string): string {
  if (!fileName) return '';
  const clean = fileName.replace(/\.xml(\.p7m)?$/i, '');
  const parts = clean.split('_');
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return clean;
}
