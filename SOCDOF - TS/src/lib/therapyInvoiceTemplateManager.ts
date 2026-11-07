import { BillingItem, Client } from '../components/therapy/types';
import { CompanyProfile } from '../types';

export interface TherapyInvoiceTemplate {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  logoUrl?: string;
  showLogo?: boolean;
  clinicName: string;
  clinicSubtitle: string;
  clinicOwner?: string;
  clinicAddress: string;
  clinicZipCity?: string;
  clinicPhone: string;
  clinicEmail: string;
  clinicWebsite?: string;
  clinicTaxId?: string;
  clinicIban: string;
  clinicBic?: string;
  clinicBankName?: string;
  primaryColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  headerTitle: string;
  headerText?: string;
  footerText: string;
  taxNote: string;
  dueDays: number;
  useCustomLayout: boolean;
  customBodyTemplate?: string;
  createdAt: string;
}

const TEMPLATES_STORAGE_KEY = 'socdof_therapy_invoice_templates';
const ACTIVE_TEMPLATE_STORAGE_KEY = 'socdof_therapy_active_template_id';

export interface TemplateVariableInfo {
  key: string;
  label: string;
  category: 'invoice' | 'client' | 'service' | 'practice' | 'totals';
  desc: string;
  example: string;
}

export const AVAILABLE_TEMPLATE_VARIABLES: TemplateVariableInfo[] = [
  // Invoice Metadata
  { key: '{Rechnung}', label: 'Rechnungstitel', category: 'invoice', desc: 'Titel der Rechnung (z.B. Honorarabrechnung oder Rechnung)', example: 'Honorarabrechnung' },
  { key: '{Rechnungsnummer}', label: 'Rechnungsnummer', category: 'invoice', desc: 'Eindeutige Rechnungsnummer', example: 'PRAXIS-2026-084' },
  { key: '{Datum}', label: 'Rechnungsdatum', category: 'invoice', desc: 'Ausstellungsdatum der Rechnung', example: '24.09.2026' },
  { key: '{Faelligkeitsdatum}', label: 'Fälligkeitsdatum', category: 'invoice', desc: 'Zahlungsziel der Rechnung', example: '08.10.2026' },
  { key: '{Zahlungsziel_Tage}', label: 'Zahlungsziel (Tage)', category: 'invoice', desc: 'Tage bis zur Fälligkeit', example: '14' },
  { key: '{Status}', label: 'Zahlungsstatus', category: 'invoice', desc: 'Status der Rechnung (Offen, Bezahlt)', example: 'Offen' },

  // Client Details
  { key: '{Klient_Name}', label: 'Klientenname', category: 'client', desc: 'Vollständiger Name des Klienten/Patienten', example: 'Max Mustermann' },
  { key: '{Klient_Adresse}', label: 'Klienten-Straße', category: 'client', desc: 'Straße und Hausnummer des Klienten', example: 'Musterstraße 12' },
  { key: '{Klient_PLZ_Ort}', label: 'Klienten-PLZ/Ort', category: 'client', desc: 'Postleitzahl und Stadt des Klienten', example: '80331 München' },
  { key: '{Klient_Email}', label: 'Klienten-E-Mail', category: 'client', desc: 'E-Mail-Adresse des Klienten', example: 'max@beispiel.de' },
  { key: '{Klient_Telefon}', label: 'Klienten-Telefon', category: 'client', desc: 'Telefonnummer des Klienten', example: '+49 89 123456' },

  // Service Details
  { key: '{Leistung}', label: 'Leistungsbezeichnung', category: 'service', desc: 'Bezeichnung der Behandlung / Beratung', example: 'Psychotherapeutische Einzelsitzung (60 Min)' },
  { key: '{Leistungsdatum}', label: 'Leistungsdatum', category: 'service', desc: 'Datum der durchgeführten Behandlung', example: '24.09.2026' },
  { key: '{Notizen}', label: 'Rechnungsnotizen', category: 'service', desc: 'Optionale Bemerkungen zur Abrechnung', example: 'Honorarabrechnung für Selbstzahler' },

  // Totals & Taxes
  { key: '{Netto}', label: 'Nettobetrag', category: 'totals', desc: 'Betrag ohne Umsatzsteuer', example: '90,00 €' },
  { key: '{Ust_Satz}', label: 'USt.-Satz', category: 'totals', desc: 'Umsatzsteuersatz in Prozent', example: '0%' },
  { key: '{Ust_Betrag}', label: 'USt.-Betrag', category: 'totals', desc: 'Ausgewiesener Steuerbetrag', example: '0,00 €' },
  { key: '{Gesamtbetrag}', label: 'Gesamtbetrag', category: 'totals', desc: 'Gesamter Rechnungsbetrag inkl. Währung', example: '90,00 €' },
  { key: '{Steuerhinweis}', label: 'Steuerhinweis', category: 'totals', desc: 'Befreiungshinweis (z.B. § 4 Nr. 14 UStG)', example: 'Umsatzsteuerfrei nach § 4 Nr. 14 UStG (Heilbehandlung)' },

  // Practice Details
  { key: '{Praxis_Name}', label: 'Praxisname', category: 'practice', desc: 'Name der Praxis / Einrichtung', example: 'Praxis für Psychotherapie & Beratung' },
  { key: '{Praxis_Untertitel}', label: 'Praxis-Untertitel', category: 'practice', desc: 'Untertitel oder Fachbereich', example: 'Heilpraktische Psychotherapie' },
  { key: '{Praxis_Inhaber}', label: 'Praxis-Inhaber', category: 'practice', desc: 'Name des behandelnden Therapeuten', example: 'Dr. med. / M.Sc. Therapeut' },
  { key: '{Praxis_Adresse}', label: 'Praxis-Adresse', category: 'practice', desc: 'Vollständige Anschrift der Praxis', example: 'Sonnenstraße 15, 80331 München' },
  { key: '{Praxis_Telefon}', label: 'Praxis-Telefon', category: 'practice', desc: 'Telefonnummer der Praxis', example: '+49 89 9876543' },
  { key: '{Praxis_Email}', label: 'Praxis-E-Mail', category: 'practice', desc: 'E-Mail-Adresse der Praxis', example: 'kontakt@praxis-therapie.de' },
  { key: '{Praxis_Website}', label: 'Praxis-Website', category: 'practice', desc: 'Website der Praxis', example: 'www.praxis-therapie.de' },
  { key: '{Praxis_IBAN}', label: 'Praxis-IBAN', category: 'practice', desc: 'Bankverbindung IBAN', example: 'DE89 3704 0044 0532 0130 00' },
  { key: '{Praxis_BIC}', label: 'Praxis-BIC', category: 'practice', desc: 'Bankverbindung BIC', example: 'BYLADEM1001' },
  { key: '{Praxis_Bank}', label: 'Bankname', category: 'practice', desc: 'Name des Kreditinstituts', example: 'Deutsche Bank' },
  { key: '{Praxis_Steuernummer}', label: 'Steuernummer', category: 'practice', desc: 'Steuernummer oder USt-IdNr.', example: '143/123/45678' }
];

export const DEFAULT_THERAPY_TEMPLATES: TherapyInvoiceTemplate[] = [
  {
    id: 'template_standard_din',
    name: 'Standard Praxis (DIN 5008 & § 4 Nr. 14 UStG)',
    description: 'Klassischer Arzt- und Praxiskopf mit formalem Adressfeld, Leistungsübersicht und § 4 Nr. 14 UStG Steuerbefreiung.',
    isDefault: true,
    showLogo: true,
    clinicName: 'Praxis für Psychotherapie & Beratung',
    clinicSubtitle: 'Heilbehandlung nach Heilpraktikergesetz / Psychotherapie',
    clinicOwner: 'Praxisleitung',
    clinicAddress: 'Praxisstraße 10',
    clinicZipCity: '10115 Berlin',
    clinicPhone: '+49 (0) 30 1234567',
    clinicEmail: 'praxis@therapie-beratung.de',
    clinicWebsite: 'www.therapie-beratung.de',
    clinicTaxId: 'DE999999999',
    clinicIban: 'DE02 1001 0010 0123 4567 89',
    clinicBic: 'PBNKDEFFXXX',
    clinicBankName: 'Praxisbank',
    primaryColor: '#0d9488', // Teal
    fontFamily: 'sans',
    headerTitle: 'Honorarabrechnung',
    headerText: 'Für die erbrachten heilkundlich-psychotherapeutischen Leistungen erlaube ich mir folgendes Honorar in Rechnung zu stellen:',
    footerText: 'Bitte überweisen Sie den Gesamtbetrag unter Angabe der Rechnungsnummer innerhalb von {Zahlungsziel_Tage} Tagen auf das angegebene Praxiskonto. Vielen Dank für Ihr Vertrauen!',
    taxNote: 'Heilbehandlung – Umsatzsteuerfrei gem. § 4 Nr. 14 Buchst. a UStG.',
    dueDays: 14,
    useCustomLayout: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_modern_accent',
    name: 'Modern Clean (Akzent-Design mit Box-Layout)',
    description: 'Zeitgemäßes, elegantes Design mit farbigem Akzent-Balken, runden Karten und prominenter Betragsanzeige.',
    isDefault: false,
    showLogo: true,
    clinicName: 'Praxis für Psychotherapie & Coaching',
    clinicSubtitle: 'Individuelle psychologische Begleitung & Coaching',
    clinicOwner: 'Praxisinhaber(in)',
    clinicAddress: 'Am Stadtpark 4',
    clinicZipCity: '80331 München',
    clinicPhone: '+49 (0) 89 7654321',
    clinicEmail: 'kontakt@praxis-achtsamkeit.de',
    clinicIban: 'DE89 7002 0270 0012 3456 78',
    clinicBic: 'HYVEDEMMXXX',
    clinicBankName: 'UniCredit Bank',
    primaryColor: '#4f46e5', // Indigo
    fontFamily: 'sans',
    headerTitle: 'Rechnung / Honorarnote',
    headerText: 'Vielen Dank für Ihren Termin. Anbei erhalten Sie die Rechnung über die durchgeführte Sitzung.',
    footerText: 'Zahlbar rein netto innerhalb von {Zahlungsziel_Tage} Tagen nach Erhalt ohne Abzug.',
    taxNote: 'Gemäß § 4 Nr. 14 UStG ist die therapeutische Leistung von der Umsatzsteuer befreit.',
    dueDays: 14,
    useCustomLayout: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_custom_word',
    name: 'Benutzerdefinierte Vorlage (Word / HTML Style mit {Variablen})',
    description: 'Vollständig anpassbare Fließtext-Vorlage mit automatischer Variablen-Erkennung wie {Rechnung}, {Klient_Name} und {Gesamtbetrag}.',
    isDefault: false,
    showLogo: true,
    clinicName: 'Therapie- und Beratungszentrum',
    clinicSubtitle: 'Praxisgemeinschaft für Seelische Gesundheit',
    clinicOwner: 'Therapeutenteam',
    clinicAddress: 'Heilmannweg 8',
    clinicZipCity: '50667 Köln',
    clinicPhone: '+49 (0) 221 987654',
    clinicEmail: 'info@therapiezentrum.de',
    clinicIban: 'DE44 3705 0198 0001 2345 67',
    clinicBic: 'COBADEFFXXX',
    clinicBankName: 'Commerzbank',
    primaryColor: '#0284c7', // Sky Blue
    fontFamily: 'sans',
    headerTitle: 'Honorarabrechnung',
    footerText: 'Wir danken Ihnen für Ihr Vertrauen und stehen bei Fragen gerne zur Verfügung.',
    taxNote: 'Heilbehandlung – steuerbefreit nach § 4 Nr. 14 UStG.',
    dueDays: 14,
    useCustomLayout: true,
    customBodyTemplate: `<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 10px;">
  <!-- Header: Practice and Document Details -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 18px; margin-bottom: 24px;">
    <div>
      <div style="font-size: 20px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px;">{Praxis_Name}</div>
      <div style="font-size: 13px; color: #64748b; font-weight: 500;">{Praxis_Untertitel}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">{Praxis_Adresse} • Tel: {Praxis_Telefon} • {Praxis_Email}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase;">{Rechnung}</div>
      <div style="font-size: 12px; color: #475569; margin-top: 2px;">Nr.: <strong style="color: #0f172a;">{Rechnungsnummer}</strong></div>
      <div style="font-size: 12px; color: #475569;">Datum: <strong>{Datum}</strong></div>
      <div style="font-size: 12px; color: #0284c7; font-weight: 600;">Fällig am: {Faelligkeitsdatum}</div>
    </div>
  </div>

  <!-- Client Recipient Card -->
  <div style="display: flex; justify-content: space-between; margin-bottom: 28px;">
    <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 18px; border-radius: 8px; width: 55%;">
      <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: bold; margin-bottom: 4px;">Rechnungsempfänger / Patient</div>
      <div style="font-size: 15px; font-weight: bold; color: #0f172a;">{Klient_Name}</div>
      <div style="font-size: 12px; color: #334155; margin-top: 2px;">{Klient_Adresse}</div>
      <div style="font-size: 12px; color: #334155;">{Klient_PLZ_Ort}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">{Klient_Email}</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #64748b; padding-top: 12px;">
      <div>Zahlungsziel: <strong>{Zahlungsziel_Tage} Tage</strong></div>
      <div style="margin-top: 4px;">Status: <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: bold;">{Status}</span></div>
    </div>
  </div>

  <!-- Intro Salutation -->
  <div style="margin-bottom: 20px; font-size: 13px; color: #334155; line-height: 1.5;">
    Sehr geehrte(r) <strong>{Klient_Name}</strong>,<br/>
    für die am <strong>{Leistungsdatum}</strong> in Anspruch genommene Leistung erlaube ich mir folgendes Honorar in Rechnung zu stellen:
  </div>

  <!-- Invoice Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
    <thead>
      <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; color: #334155;">
        <th style="padding: 10px 12px;">Position / Leistungsbeschreibung</th>
        <th style="padding: 10px 12px; text-align: center;">Datum</th>
        <th style="padding: 10px 12px; text-align: right;">Betrag</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 14px 12px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 14px;">{Leistung}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">{Notizen}</div>
        </td>
        <td style="padding: 14px 12px; text-align: center; color: #475569;">{Leistungsdatum}</td>
        <td style="padding: 14px 12px; text-align: right; font-weight: 700; color: #0f172a; font-size: 14px;">{Netto}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals Summary Block -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
    <div style="width: 280px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569;">
        <span>Nettobetrag:</span>
        <span style="font-weight: 600;">{Netto}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #475569;">
        <span>Umsatzsteuer ({Ust_Satz}):</span>
        <span>{Ust_Betrag}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 15px; border-top: 2px solid #cbd5e1; padding-top: 8px; color: #0f172a;">
        <span>Gesamtbetrag:</span>
        <span style="color: #0284c7;">{Gesamtbetrag}</span>
      </div>
    </div>
  </div>

  <!-- Tax Notice -->
  <div style="font-size: 11px; color: #475569; margin-bottom: 24px; padding: 8px 12px; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 6px;">
    <strong>Steuerhinweis:</strong> {Steuerhinweis}
  </div>

  <!-- Payment Wire Instructions -->
  <div style="font-size: 12px; color: #334155; border-top: 1px solid #e2e8f0; padding-top: 16px; background-color: #fafafa; padding: 14px; border-radius: 8px;">
    <div style="font-weight: bold; margin-bottom: 4px; color: #0f172a;">Zahlungshinweis</div>
    <div>Bitte überweisen Sie den fälligen Betrag von <strong>{Gesamtbetrag}</strong> innerhalb von {Zahlungsziel_Tage} Tagen bis zum <strong>{Faelligkeitsdatum}</strong> unter Angabe der Rechnungsnummer <strong>{Rechnungsnummer}</strong>.</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; font-size: 11px; color: #475569;">
      <div>IBAN: <strong>{Praxis_IBAN}</strong></div>
      <div>BIC: <strong>{Praxis_BIC}</strong></div>
      <div>Kreditinstitut: <strong>{Praxis_Bank}</strong></div>
      <div>Kontoinhaber: <strong>{Praxis_Name}</strong></div>
    </div>
  </div>
</div>`,
    createdAt: new Date().toISOString()
  }
];

export function getStoredTemplates(): TherapyInvoiceTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_THERAPY_TEMPLATES;
}

export function saveStoredTemplates(templates: TherapyInvoiceTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Failed to persist therapy invoice templates', err);
  }
}

export function getActiveTemplateId(): string {
  try {
    return localStorage.getItem(ACTIVE_TEMPLATE_STORAGE_KEY) || DEFAULT_THERAPY_TEMPLATES[0].id;
  } catch {
    return DEFAULT_THERAPY_TEMPLATES[0].id;
  }
}

export function setActiveTemplateId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_TEMPLATE_STORAGE_KEY, id);
  } catch {}
}

export function getActiveTemplate(): TherapyInvoiceTemplate {
  const templates = getStoredTemplates();
  const activeId = getActiveTemplateId();
  return templates.find(t => t.id === activeId) || templates[0] || DEFAULT_THERAPY_TEMPLATES[0];
}

/**
 * Extracts all {variable_name} placeholder tokens from any text.
 */
export function extractPlaceholders(templateText: string): string[] {
  if (!templateText) return [];
  const matches = templateText.match(/\{[a-zA-Z0-9_-]+\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

/**
 * Scans template text and categorizes variables into recognized vs unrecognized.
 */
export function scanTemplateVariables(templateText: string): {
  foundTokens: string[];
  validTokens: string[];
  unknownTokens: string[];
} {
  const foundTokens = extractPlaceholders(templateText);
  const knownKeys = new Set(AVAILABLE_TEMPLATE_VARIABLES.map(v => v.key));
  const validTokens: string[] = [];
  const unknownTokens: string[] = [];

  for (const token of foundTokens) {
    if (knownKeys.has(token)) {
      validTokens.push(token);
    } else {
      unknownTokens.push(token);
    }
  }

  return { foundTokens, validTokens, unknownTokens };
}

/**
 * Builds the data dictionary mapping each placeholder key to its real dynamic value.
 */
export function buildTemplateVariablesDictionary(
  template: TherapyInvoiceTemplate,
  billing: BillingItem,
  client?: Client,
  company?: CompanyProfile,
  currency = '€'
): Record<string, string> {
  const amountNum = Number(billing.amount) || 0;
  const taxRateNum = Number(billing.taxRate) || 0;
  const taxAmountNum = (amountNum * taxRateNum) / 100;
  const totalAmountNum = amountNum + taxAmountNum;

  const invoiceNumber = billing.invoiceNumber || `PRAXIS-${billing.id.slice(-6).toUpperCase()}`;
  const invoiceDate = billing.date || new Date().toISOString().slice(0, 10);
  
  // Calculate due date based on template dueDays
  let dueDate = billing.dueDate;
  if (!dueDate && billing.date) {
    try {
      const d = new Date(billing.date);
      d.setDate(d.getDate() + (template.dueDays || 14));
      dueDate = d.toISOString().slice(0, 10);
    } catch {
      dueDate = invoiceDate;
    }
  }

  // Format currencies
  const formatCur = (num: number) => `${num.toFixed(2).replace('.', ',')} ${currency}`;

  // Company / clinic fallbacks
  const clinicName = template.clinicName || company?.name || 'Praxis für Psychotherapie & Beratung';
  const clinicSubtitle = template.clinicSubtitle || 'Heilbehandlung / Psychologische Beratung';
  const clinicOwner = template.clinicOwner || '';
  const clinicAddress = template.clinicAddress || company?.street || 'Praxisstraße 10';
  const clinicZipCity = template.clinicZipCity || company?.zip_city || '10115 Berlin';
  const clinicPhone = template.clinicPhone || company?.phone || '';
  const clinicEmail = template.clinicEmail || company?.email || '';
  const clinicWebsite = template.clinicWebsite || '';
  const clinicTaxId = template.clinicTaxId || company?.tax_id || '';
  const clinicIban = template.clinicIban || company?.iban || '';
  const clinicBic = template.clinicBic || company?.bic || '';
  const clinicBankName = template.clinicBankName || company?.bank_name || '';

  const statusLabel = billing.status === 'paid' ? 'Bezahlt' : billing.status === 'invoiced' ? 'In Rechnung gestellt' : 'Offen';

  return {
    '{Rechnung}': template.headerTitle || 'Honorarabrechnung',
    '{Rechnungstitel}': template.headerTitle || 'Honorarabrechnung',
    '{Rechnungsnummer}': invoiceNumber,
    '{Datum}': invoiceDate,
    '{Faelligkeitsdatum}': dueDate || invoiceDate,
    '{Zahlungsziel_Tage}': String(template.dueDays || 14),
    '{Status}': statusLabel,
    '{Klient_Name}': client?.name || 'Klient / Patient',
    '{Klient_Adresse}': client?.address || '',
    '{Klient_PLZ_Ort}': [client?.zip, client?.city].filter(Boolean).join(' ') || '',
    '{Klient_Email}': client?.email || '',
    '{Klient_Telefon}': client?.phone || '',
    '{Leistung}': billing.service || 'Psychotherapeutische Beratung / Behandlung',
    '{Leistungsdatum}': billing.date || invoiceDate,
    '{Netto}': formatCur(amountNum),
    '{Betrag}': formatCur(amountNum),
    '{Ust_Satz}': `${taxRateNum}%`,
    '{Ust_Betrag}': formatCur(taxAmountNum),
    '{Gesamtbetrag}': formatCur(totalAmountNum),
    '{Steuerhinweis}': template.taxNote || 'Umsatzsteuerfrei nach § 4 Nr. 14 UStG',
    '{Notizen}': billing.notes || '',
    '{Praxis_Name}': clinicName,
    '{Praxis_Untertitel}': clinicSubtitle,
    '{Praxis_Inhaber}': clinicOwner,
    '{Praxis_Adresse}': `${clinicAddress}, ${clinicZipCity}`.replace(/^,\s*/, ''),
    '{Praxis_Telefon}': clinicPhone,
    '{Praxis_Email}': clinicEmail,
    '{Praxis_Website}': clinicWebsite,
    '{Praxis_IBAN}': clinicIban,
    '{Praxis_BIC}': clinicBic,
    '{Praxis_Bank}': clinicBankName,
    '{Praxis_Steuernummer}': clinicTaxId
  };
}

/**
 * Replaces all placeholders inside custom template text with actual evaluated values.
 */
export function renderCustomTemplateText(
  rawText: string,
  variables: Record<string, string>
): string {
  if (!rawText) return '';
  let rendered = rawText;
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = key.replace(/[{}]/g, '\\$&');
    rendered = rendered.replace(new RegExp(escapedKey, 'g'), value || '');
  }
  return rendered;
}

/**
 * Generates formatted HTML ready for printing or Word export.
 */
export function generateTherapyInvoiceHtml(
  template: TherapyInvoiceTemplate,
  billing: BillingItem,
  client?: Client,
  company?: CompanyProfile,
  currency = '€'
): string {
  const vars = buildTemplateVariablesDictionary(template, billing, client, company, currency);

  if (template.useCustomLayout && template.customBodyTemplate) {
    return renderCustomTemplateText(template.customBodyTemplate, vars);
  }

  // Structured DIN / Modern standard layout
  return `
<div style="font-family: ${template.fontFamily === 'serif' ? 'Georgia, serif' : template.fontFamily === 'mono' ? 'monospace' : "'Segoe UI', Arial, sans-serif"}; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 20px;">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${template.primaryColor || '#0d9488'}; padding-bottom: 16px; margin-bottom: 24px;">
    <div>
      ${template.showLogo && template.logoUrl ? `<img src="${template.logoUrl}" style="max-height: 56px; max-width: 180px; object-fit: contain; margin-bottom: 8px;" alt="Logo" />` : ''}
      <div style="font-size: 18px; font-weight: bold; color: #0f172a;">${vars['{Praxis_Name}']}</div>
      <div style="font-size: 12px; color: #64748b;">${vars['{Praxis_Untertitel}']}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${vars['{Praxis_Adresse}']} • ${vars['{Praxis_Telefon}']} • ${vars['{Praxis_Email}']}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 20px; font-weight: 800; color: ${template.primaryColor || '#0d9488'}; text-transform: uppercase;">${vars['{Rechnung}']}</div>
      <div style="font-size: 12px; color: #475569; margin-top: 4px;">Nr.: <strong>${vars['{Rechnungsnummer}']}</strong></div>
      <div style="font-size: 12px; color: #475569;">Datum: ${vars['{Datum}']}</div>
      <div style="font-size: 12px; color: #475569;">Fällig am: <strong>${vars['{Faelligkeitsdatum}']}</strong></div>
    </div>
  </div>

  <!-- Recipient & Meta -->
  <div style="display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 12px;">
    <div>
      <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: bold; margin-bottom: 4px;">Rechnungsempfänger</div>
      <div style="font-size: 14px; font-weight: bold; color: #0f172a;">${vars['{Klient_Name}']}</div>
      <div style="color: #475569;">${vars['{Klient_Adresse}']}</div>
      <div style="color: #475569;">${vars['{Klient_PLZ_Ort}']}</div>
      <div style="color: #64748b; margin-top: 2px;">${vars['{Klient_Email}']}</div>
    </div>
    <div style="text-align: right;">
      <div>Zahlungsziel: <strong>${vars['{Zahlungsziel_Tage}']} Tage</strong></div>
      <div style="margin-top: 4px;">Status: <span style="font-weight: bold;">${vars['{Status}']}</span></div>
    </div>
  </div>

  ${template.headerText ? `<div style="font-size: 12px; color: #334155; margin-bottom: 20px;">${template.headerText}</div>` : ''}

  <!-- Items Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px;">
    <thead>
      <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569;">
        <th style="padding: 8px 10px;">Position / Leistungsbeschreibung</th>
        <th style="padding: 8px 10px; text-align: center;">Datum</th>
        <th style="padding: 8px 10px; text-align: right;">Betrag</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 10px;">
          <div style="font-weight: bold; color: #0f172a;">${vars['{Leistung}']}</div>
          ${vars['{Notizen}'] ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${vars['{Notizen}']}</div>` : ''}
        </td>
        <td style="padding: 12px 10px; text-align: center; color: #64748b;">${vars['{Leistungsdatum}']}</td>
        <td style="padding: 12px 10px; text-align: right; font-weight: bold; color: #0f172a;">${vars['{Netto}']}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
    <div style="width: 260px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
        <span>Nettobetrag:</span>
        <span>${vars['{Netto}']}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569;">
        <span>USt. (${vars['{Ust_Satz}']}):</span>
        <span>${vars['{Ust_Betrag}']}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 1px solid #cbd5e1; padding-top: 6px; color: #0f172a;">
        <span>Gesamtbetrag:</span>
        <span style="color: ${template.primaryColor || '#0d9488'};">${vars['{Gesamtbetrag}']}</span>
      </div>
    </div>
  </div>

  ${vars['{Steuerhinweis}'] ? `
  <div style="font-size: 11px; color: #64748b; margin-bottom: 24px; padding: 8px 12px; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 6px;">
    ${vars['{Steuerhinweis}']}
  </div>` : ''}

  <!-- Footer Bank Info -->
  <div style="font-size: 11px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 14px;">
    <div style="margin-bottom: 8px;">${renderCustomTemplateText(template.footerText || '', vars)}</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: #64748b;">
      <div>IBAN: <strong>${vars['{Praxis_IBAN}']}</strong></div>
      <div>BIC: <strong>${vars['{Praxis_BIC}']}</strong></div>
      <div>Bank: <strong>${vars['{Praxis_Bank}']}</strong></div>
      <div>St.-Nr.: <strong>${vars['{Praxis_Steuernummer}']}</strong></div>
    </div>
  </div>
</div>
  `.trim();
}

/**
 * Exports invoice as a Microsoft Word (.doc) document.
 */
export function exportTherapyInvoiceToWord(
  template: TherapyInvoiceTemplate,
  billing: BillingItem,
  client?: Client,
  company?: CompanyProfile,
  currency = '€'
): void {
  const vars = buildTemplateVariablesDictionary(template, billing, client, company, currency);
  const invoiceHtml = generateTherapyInvoiceHtml(template, billing, client, company, currency);
  const invoiceNumber = vars['{Rechnungsnummer}'] || 'Rechnung';
  const clientName = (client?.name || 'Klient').replace(/[^a-zA-Z0-9_-]/g, '_');

  const fullWordDocument = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${invoiceNumber} - ${client?.name || 'Rechnung'}</title>
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
@page {
  size: A4;
  margin: 2.0cm 2.0cm 2.0cm 2.0cm;
  mso-page-orientation: portrait;
}
body {
  font-family: ${template.fontFamily === 'serif' ? 'Georgia, "Times New Roman", serif' : 'Calibri, "Segoe UI", Arial, sans-serif'};
  font-size: 11pt;
  color: #1e293b;
  line-height: 1.5;
}
table {
  border-collapse: collapse;
  width: 100%;
}
th, td {
  padding: 6pt 8pt;
}
</style>
</head>
<body>
${invoiceHtml}
</body>
</html>
`.trim();

  const blob = new Blob(['\ufeff' + fullWordDocument], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber}_${clientName}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
