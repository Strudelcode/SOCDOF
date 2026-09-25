import { Invoice, CompanyProfile, InvoiceItem } from '../types';
import { formatCurrencyDE } from './formatters';

export interface InvoiceTemplate {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  presetType: 'din_5008' | 'modern' | 'corporate' | 'creative' | 'praxis' | 'custom';
  logoUrl?: string;
  showLogo?: boolean;
  logoPosition?: 'left' | 'right' | 'center';
  companyName: string;
  companySubtitle?: string;
  companyOwner?: string;
  companyAddress: string;
  companyZipCity: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyTaxId?: string;
  companyVatId?: string;
  companyIban?: string;
  companyBic?: string;
  companyBankName?: string;
  companyCommercialRegister?: string;
  primaryColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  headerTitle: string;
  headerText?: string;
  footerText: string;
  taxNote?: string;
  dueDays: number;
  useCustomLayout: boolean;
  customBodyTemplate?: string;
  showFoldMarks?: boolean;
  createdAt: string;
}

const TEMPLATES_STORAGE_KEY = 'socdof_erp_invoice_templates_v1';
const ACTIVE_TEMPLATE_STORAGE_KEY = 'socdof_erp_active_template_id_v1';

export interface TemplateVariableInfo {
  key: string;
  label: string;
  category: 'metadata' | 'customer' | 'totals' | 'items' | 'company';
  desc: string;
  example: string;
}

export const AVAILABLE_INVOICE_VARIABLES: TemplateVariableInfo[] = [
  // Rechnungsmetadaten
  { key: '{Rechnung}', label: 'Rechnungstitel', category: 'metadata', desc: 'Titel des Belegs (z.B. Rechnung oder Gutschrift)', example: 'Rechnung' },
  { key: '{Rechnungsnummer}', label: 'Rechnungsnummer', category: 'metadata', desc: 'Eindeutige Rechnungsnummer', example: 'RE-2026-0042' },
  { key: '{Datum}', label: 'Rechnungsdatum', category: 'metadata', desc: 'Ausstellungsdatum des Belegs', example: '25.09.2026' },
  { key: '{Faelligkeitsdatum}', label: 'Fälligkeitsdatum', category: 'metadata', desc: 'Zahlungsziel des Belegs', example: '09.10.2026' },
  { key: '{Zahlungsziel_Tage}', label: 'Zahlungsziel (Tage)', category: 'metadata', desc: 'Anzahl Tage bis zur Fälligkeit', example: '14' },
  { key: '{Status}', label: 'Status', category: 'metadata', desc: 'Aktueller Belegstatus (Entwurf, Offen, Bezahlt)', example: 'Offen' },
  { key: '{Waehrung}', label: 'Währungssymbol', category: 'metadata', desc: 'Eingestelltes Währungssymbol', example: '€' },

  // Kunde / Empfänger
  { key: '{Kunde_Name}', label: 'Kundenname', category: 'customer', desc: 'Vollständiger Name des Kunden / Ansprechpartners', example: 'Max Mustermann' },
  { key: '{Kunde_Firma}', label: 'Kunden-Firma', category: 'customer', desc: 'Firmenname des Kunden', example: 'Musterfirma GmbH & Co. KG' },
  { key: '{Kunde_Adresse}', label: 'Kunden-Straße', category: 'customer', desc: 'Straße und Hausnummer des Kunden', example: 'Industriestraße 45' },
  { key: '{Kunde_PLZ_Ort}', label: 'Kunden-PLZ/Ort', category: 'customer', desc: 'Postleitzahl und Ort des Kunden', example: '80339 München' },
  { key: '{Kunde_Email}', label: 'Kunden-E-Mail', category: 'customer', desc: 'E-Mail-Adresse des Kunden', example: 'rechnung@muster-firma.de' },
  { key: '{Kunde_Telefon}', label: 'Kunden-Telefon', category: 'customer', desc: 'Telefonnummer des Kunden', example: '+49 (0) 89 9876543' },
  { key: '{Kunde_UStId}', label: 'Kunden-USt-IdNr.', category: 'customer', desc: 'Umsatzsteuer-Identifikationsnummer des Kunden', example: 'DE123456789' },

  // Beträge & Summen
  { key: '{Netto}', label: 'Nettobetrag (Zwischensumme)', category: 'totals', desc: 'Betrag vor Steuern', example: '100.000,00 €' },
  { key: '{Ust_Satz}', label: 'USt.-Satz', category: 'totals', desc: 'Umsatzsteuersatz in Prozent', example: '19%' },
  { key: '{Ust_Betrag}', label: 'USt.-Betrag', category: 'totals', desc: 'Ausgewiesener Steuerbetrag', example: '19.000,00 €' },
  { key: '{Gesamtbetrag}', label: 'Gesamtbetrag (Brutto)', category: 'totals', desc: 'Rechnungs-Endbetrag inklusive Steuern', example: '119.000,00 €' },
  { key: '{Steuerhinweis}', label: 'Steuerhinweis', category: 'totals', desc: 'Hinweis auf Steuerbefreiung oder Regelbesteuerung', example: 'Rechnungsbetrag enthält 19% Umsatzsteuer.' },

  // Positionen
  { key: '{Positionen_Tabelle}', label: 'Positionstabelle (HTML)', category: 'items', desc: 'Vollständig formatierte Artikeltabelle mit Mengen, Einzelpreisen und Summen', example: '[Tabelle]' },

  // Firma / Absender
  { key: '{Firma_Name}', label: 'Firmenname', category: 'company', desc: 'Name Ihres Unternehmens', example: 'Mustermann Technologie & Commerce' },
  { key: '{Firma_Zusatz}', label: 'Firmen-Zusatz', category: 'company', desc: 'Untertitel, Branche oder Zusatz', example: 'Handel & digitale Dienstleistungen' },
  { key: '{Firma_Inhaber}', label: 'Geschäftsführung / Inhaber', category: 'company', desc: 'Geschäftsführer oder Inhaber', example: 'Max Mustermann' },
  { key: '{Firma_Adresse}', label: 'Firmen-Straße', category: 'company', desc: 'Straße und Hausnummer Ihres Unternehmens', example: 'Musterstraße 10' },
  { key: '{Firma_PLZ_Ort}', label: 'Firmen-PLZ/Ort', category: 'company', desc: 'Postleitzahl und Ort Ihres Unternehmens', example: '10115 Berlin' },
  { key: '{Firma_Telefon}', label: 'Firmen-Telefon', category: 'company', desc: 'Telefonnummer Ihres Unternehmens', example: '+49 (0) 30 1234567' },
  { key: '{Firma_Email}', label: 'Firmen-E-Mail', category: 'company', desc: 'Offizielle Kontakt-E-Mail', example: 'buchhaltung@firma.de' },
  { key: '{Firma_Website}', label: 'Firmen-Website', category: 'company', desc: 'Internetadresse des Unternehmens', example: 'www.firma.de' },
  { key: '{Firma_Steuernummer}', label: 'Steuernummer', category: 'company', desc: 'Steuernummer beim Finanzamt', example: '143/123/45678' },
  { key: '{Firma_UStId}', label: 'USt-IdNr.', category: 'company', desc: 'Umsatzsteuer-Identifikationsnummer', example: 'DE987654321' },
  { key: '{Firma_IBAN}', label: 'IBAN', category: 'company', desc: 'Bankverbindung IBAN', example: 'DE89 3704 0044 0532 0130 00' },
  { key: '{Firma_BIC}', label: 'BIC', category: 'company', desc: 'Bankverbindung BIC/SWIFT', example: 'BYLADEM1001' },
  { key: '{Firma_Bank}', label: 'Bankname', category: 'company', desc: 'Kreditinstitut', example: 'Deutsche Bank' },
  { key: '{Firma_Handelsregister}', label: 'Handelsregister', category: 'company', desc: 'Amtsgericht & Registernummer', example: 'Amtsgericht Berlin HRB 123456' }
];

export const DEFAULT_INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    id: 'template_din_5008_classic',
    name: 'DIN 5008 Standard (Klassisch & Rechtskonform)',
    description: 'Deutscher Geschäftsstandard mit Faltmarken, präzisem Adressfeld für Fensterkuverts (DIN Lang), detaillierter Steuertabelle und 4-Spalten-Fußzeile.',
    presetType: 'din_5008',
    isDefault: true,
    showLogo: true,
    logoPosition: 'right',
    companyName: 'Mustermann Technologie & Commerce GmbH',
    companySubtitle: 'Handel & professionelle Dienstleistungen',
    companyOwner: 'Max Mustermann',
    companyAddress: 'Hauptstraße 12',
    companyZipCity: '10115 Berlin',
    companyPhone: '+49 (0) 30 1234567',
    companyEmail: 'buchhaltung@mustermann-gmbh.de',
    companyWebsite: 'www.mustermann-gmbh.de',
    companyTaxId: '143/123/45678',
    companyVatId: 'DE123456789',
    companyIban: 'DE89 3704 0044 0532 0130 00',
    companyBic: 'BYLADEM1001',
    companyBankName: 'Deutsche Bank Berlin',
    companyCommercialRegister: 'Amtsgericht Charlottenburg HRB 98765 B',
    primaryColor: '#2563eb',
    fontFamily: 'sans',
    headerTitle: 'Rechnung',
    headerText: 'Wir bedanken uns für das entgegengebrachte Vertrauen und stellen folgende Leistungen in Rechnung:',
    footerText: 'Zahlbar innerhalb von {Zahlungsziel_Tage} Tagen ab Rechnungsdatum ohne Abzug auf unser angegebenes Geschäftskonto.',
    taxNote: 'Rechnungsbetrag enthält die gesetzliche Mehrwertsteuer.',
    dueDays: 14,
    showFoldMarks: true,
    useCustomLayout: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_modern_minimal',
    name: 'Modern Minimalist (Agentur & Freiberufler)',
    description: 'Elegantes, klares Design mit reduziertem Rahmen, modernem Header und prominenter Logo-Platzierung oben links.',
    presetType: 'modern',
    isDefault: false,
    showLogo: true,
    logoPosition: 'left',
    companyName: 'Studio Strudel Design & Development',
    companySubtitle: 'Software Architecture & Brand Identity',
    companyOwner: 'Yuri / Strudel',
    companyAddress: 'Sonnenstraße 44',
    companyZipCity: '39100 Bozen',
    companyPhone: '+39 0471 998877',
    companyEmail: 'hello@strudelcode.com',
    companyWebsite: 'www.strudelcode.com',
    companyTaxId: 'IT01234567890',
    companyVatId: 'IT01234567890',
    companyIban: 'IT60 X054 2811 1010 0000 0123 456',
    companyBic: 'UNCRITM1B02',
    companyBankName: 'Südtiroler Sparkasse',
    primaryColor: '#0f172a',
    fontFamily: 'sans',
    headerTitle: 'Rechnung & Leistungsnachweis',
    headerText: 'Vielen Dank für die angenehme Zusammenarbeit. Anbei finden Sie Ihre detaillierte Abrechnung:',
    footerText: 'Bitte überweisen Sie die Gesamtsumme bis zum {Faelligkeitsdatum} unter Angabe der Rechnungsnummer {Rechnungsnummer}.',
    taxNote: 'Regelbesteuerung gem. UStG.',
    dueDays: 14,
    showFoldMarks: false,
    useCustomLayout: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_corporate_executive',
    name: 'Executive Corporate (GmbH & Industrie)',
    description: 'Solider Industrieauftritt mit markantem Farbheader, Logo-Sockel oben links und strukturierter IBAN/BIC-Box.',
    presetType: 'corporate',
    isDefault: false,
    showLogo: true,
    logoPosition: 'left',
    companyName: 'Apex Industries & Logistics AG',
    companySubtitle: 'Automation, Hardware & System Solutions',
    companyOwner: 'Vorstand: Dr. Walter Richter',
    companyAddress: 'Industriepark Nord 7',
    companyZipCity: '80339 München',
    companyPhone: '+49 (0) 89 55443322',
    companyEmail: 'finance@apex-industries.com',
    companyWebsite: 'www.apex-industries.com',
    companyTaxId: '143/999/88877',
    companyVatId: 'DE889911223',
    companyIban: 'DE44 7001 0080 0012 3456 78',
    companyBic: 'PBNKDEFF',
    companyBankName: 'Postbank München',
    companyCommercialRegister: 'Amtsgericht München HRB 112233',
    primaryColor: '#1e3a8a',
    fontFamily: 'sans',
    headerTitle: 'Handelsrechnung (Commercial Invoice)',
    headerText: 'Gemäß Ihrer Bestellung berechnen wir hiermit folgende Lieferungen und Leistungen:',
    footerText: 'Rechnungsbetrag fällig rein netto innerhalb von {Zahlungsziel_Tage} Tagen. Bei Rückfragen steht Ihnen unsere Buchhaltung zur Verfügung.',
    taxNote: 'Lieferung erfolgt nach Incoterms 2020 DAP.',
    dueDays: 30,
    showFoldMarks: true,
    useCustomLayout: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_creative_studio',
    name: 'Creative Studio (Design, Handwerk & Handel)',
    description: 'Warme, stilsichere Typografie mit dezentem Badge, persönlicher Danksagung und ansprechenden Abständen.',
    presetType: 'creative',
    isDefault: false,
    showLogo: true,
    logoPosition: 'right',
    companyName: 'Atelier Klee Creative Concepts',
    companySubtitle: 'Visuelle Kommunikation & Raumgestaltung',
    companyOwner: 'Clara Klee',
    companyAddress: 'Kunstwerkweg 3',
    companyZipCity: '50667 Köln',
    companyPhone: '+49 (0) 221 887766',
    companyEmail: 'atelier@klee-design.de',
    companyWebsite: 'www.klee-design.de',
    companyTaxId: '214/555/44433',
    companyVatId: 'DE334455667',
    companyIban: 'DE21 3705 0198 0001 2345 67',
    companyBic: 'COLSDE33',
    companyBankName: 'Sparkasse KölnBonn',
    primaryColor: '#c2410c',
    fontFamily: 'serif',
    headerTitle: 'Rechnung & Honorar',
    headerText: 'Wir freuen uns über das gelungene Projekt und stellen die vereinbarten Positionen in Rechnung:',
    footerText: 'Herzlichen Dank für Ihr Vertrauen! Wir freuen uns auf das nächste gemeinsame Projekt.',
    dueDays: 14,
    showFoldMarks: false,
    useCustomLayout: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_praxis_medical',
    name: 'Heilbehandlung & Praxis (§ 4 Nr. 14 UStG)',
    description: 'Offizielle Heilmittel- und Praxisabrechnung für Psychotherapie, Ärzte und Heilpraktiker mit Diagnose-Hinweis und USt-Befreiung.',
    presetType: 'praxis',
    isDefault: false,
    showLogo: true,
    logoPosition: 'left',
    companyName: 'Praxis für Psychotherapie & Beratung',
    companySubtitle: 'Heilbehandlung nach dem Heilpraktikergesetz',
    companyOwner: 'Praxisleitung',
    companyAddress: 'Praxisstraße 15',
    companyZipCity: '10115 Berlin',
    companyPhone: '+49 (0) 30 98765432',
    companyEmail: 'praxis@therapie-berlin.de',
    companyWebsite: 'www.therapie-berlin.de',
    companyTaxId: '143/777/66655',
    companyIban: 'DE89 3704 0044 0532 0130 00',
    companyBic: 'BYLADEM1001',
    companyBankName: 'Berliner Volksbank',
    primaryColor: '#0d9488',
    fontFamily: 'sans',
    headerTitle: 'Honorarabrechnung',
    headerText: 'Für die durchgeführten psychotherapeutischen Sitzungen und Beratungen erlaube ich mir folgendes Honorar in Rechnung zu stellen:',
    footerText: 'Bitte überweisen Sie den Honorarbetrag innerhalb von {Zahlungsziel_Tage} Tagen auf das Praxiskonto.',
    taxNote: 'Umsatzsteuerbefreit nach § 4 Nr. 14 UStG (Heilbehandlung im Bereich der Humanmedizin).',
    dueDays: 14,
    showFoldMarks: true,
    useCustomLayout: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'template_custom_layout',
    name: 'Freies Layout & Variablen-Editor',
    description: 'Vollständig anpassbares HTML-Layout mit Platzhaltern, frei definierbarem Design, Logo-Sockel und CSS.',
    presetType: 'custom',
    isDefault: false,
    showLogo: true,
    logoPosition: 'left',
    companyName: 'Mustermann Freie Vorlage',
    companyAddress: 'Musterstraße 1',
    companyZipCity: '10115 Berlin',
    primaryColor: '#6366f1',
    fontFamily: 'sans',
    headerTitle: 'Rechnung',
    footerText: 'Vielen Dank für Ihre Bestellung!',
    dueDays: 14,
    showFoldMarks: false,
    useCustomLayout: true,
    customBodyTemplate: `<!-- Individuelle Rechnungsvorlage -->
<div style="font-family: inherit; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.5;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid {Primaerfarbe}; padding-bottom: 24px; margin-bottom: 30px;">
    <div>
      <div style="font-size: 24px; font-weight: 800; color: {Primaerfarbe};">{Firma_Name}</div>
      <div style="font-size: 13px; color: #64748b; margin-top: 4px;">{Firma_Zusatz}</div>
      <div style="font-size: 12px; color: #475569; margin-top: 6px;">{Firma_Adresse} • {Firma_PLZ_Ort}</div>
      <div style="font-size: 12px; color: #475569;">E-Mail: {Firma_Email} • Tel: {Firma_Telefon}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a;">{Rechnung}</div>
      <div style="font-size: 14px; font-weight: 700; color: #334155; margin-top: 4px;">Nr. {Rechnungsnummer}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Datum: {Datum}</div>
      <div style="font-size: 12px; color: #64748b;">Fällig am: {Faelligkeitsdatum}</div>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 36px;">
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; flex: 1;">
      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px;">Rechnungsempfänger</div>
      <div style="font-size: 14px; font-weight: 700; color: #0f172a;">{Kunde_Firma}</div>
      <div style="font-size: 13px; color: #334155;">{Kunde_Name}</div>
      <div style="font-size: 12px; color: #475569; margin-top: 4px;">{Kunde_Adresse}</div>
      <div style="font-size: 12px; color: #475569;">{Kunde_PLZ_Ort}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">{Kunde_Email}</div>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; width: 220px;">
      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px;">Zahlungsdetails</div>
      <div style="font-size: 12px; color: #475569;">Zahlungsziel: <strong>{Zahlungsziel_Tage} Tage</strong></div>
      <div style="font-size: 12px; color: #475569; margin-top: 4px;">Status: <span style="font-weight: 700; color: #16a34a;">{Status}</span></div>
      <div style="font-size: 11px; color: #64748b; margin-top: 8px;">IBAN: {Firma_IBAN}</div>
      <div style="font-size: 11px; color: #64748b;">BIC: {Firma_BIC}</div>
    </div>
  </div>

  <div style="margin-bottom: 24px;">
    {Positionen_Tabelle}
  </div>

  <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
    <div style="width: 280px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 6px;">
        <span>Nettobetrag:</span>
        <span style="font-weight: 600;">{Netto}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
        <span>MwSt ({Ust_Satz}):</span>
        <span style="font-weight: 600;">{Ust_Betrag}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #0f172a;">
        <span>Gesamtbetrag:</span>
        <span style="color: {Primaerfarbe};">{Gesamtbetrag}</span>
      </div>
    </div>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; text-align: center;">
    <div>{Fusszeile}</div>
    <div style="margin-top: 4px; font-size: 11px;">{Steuerhinweis}</div>
  </div>
</div>`,
    createdAt: new Date().toISOString()
  }
];

export function getStoredInvoiceTemplates(): InvoiceTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load invoice templates', e);
  }
  return DEFAULT_INVOICE_TEMPLATES;
}

export function saveStoredInvoiceTemplates(templates: InvoiceTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save invoice templates', e);
  }
}

export function getActiveInvoiceTemplateId(): string {
  try {
    const id = localStorage.getItem(ACTIVE_TEMPLATE_STORAGE_KEY);
    if (id) return id;
  } catch {}
  return DEFAULT_INVOICE_TEMPLATES[0].id;
}

export function setActiveInvoiceTemplateId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_TEMPLATE_STORAGE_KEY, id);
  } catch {}
}

export function getActiveInvoiceTemplate(): InvoiceTemplate {
  const templates = getStoredInvoiceTemplates();
  const activeId = getActiveInvoiceTemplateId();
  return templates.find(t => t.id === activeId) || templates[0] || DEFAULT_INVOICE_TEMPLATES[0];
}

/**
 * Scans content for all variables enclosed in `{...}`
 */
export function scanTemplateVariables(content: string): { recognized: string[]; unrecognized: string[] } {
  if (!content) return { recognized: [], unrecognized: [] };
  const matches = content.match(/\{[a-zA-Z0-9_-]+\}/g) || [];
  const unique = Array.from(new Set(matches));

  const knownKeys = new Set(AVAILABLE_INVOICE_VARIABLES.map(v => v.key.toLowerCase()));
  knownKeys.add('{primaerfarbe}');
  knownKeys.add('{fusszeile}');

  const recognized: string[] = [];
  const unrecognized: string[] = [];

  for (const key of unique) {
    if (knownKeys.has(key.toLowerCase())) {
      recognized.push(key);
    } else {
      unrecognized.push(key);
    }
  }

  return { recognized, unrecognized };
}

/**
 * Builds dictionary of replacement values for variables
 */
export function buildInvoiceVariableDictionary(
  template: InvoiceTemplate,
  invoice?: Partial<Invoice> | null,
  company?: CompanyProfile | null,
  currency: string = '€',
  isTestPreview: boolean = false
): Record<string, string> {
  const cur = currency || company?.currency || '€';

  // Realistic sample test values (with 100.000 € test volume as specifically requested by user)
  if (isTestPreview || !invoice) {
    const testNet = 100000;
    const testTax = 19000;
    const testGross = 119000;

    const sampleTableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 10px 12px; font-weight: 700; color: #334155;">Pos.</th>
            <th style="padding: 10px 12px; font-weight: 700; color: #334155;">Bezeichnung / Artikel</th>
            <th style="padding: 10px 12px; font-weight: 700; color: #334155; text-align: right;">Menge</th>
            <th style="padding: 10px 12px; font-weight: 700; color: #334155; text-align: right;">Einzelpreis</th>
            <th style="padding: 10px 12px; font-weight: 700; color: #334155; text-align: right;">MwSt</th>
            <th style="padding: 10px 12px; font-weight: 700; color: #334155; text-align: right;">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; color: #64748b;">01</td>
            <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">ERP-Softwareentwicklung & Desktop-Architektur (SOCDOF Professional Suite)</td>
            <td style="padding: 10px 12px; text-align: right;">1 Stk.</td>
            <td style="padding: 10px 12px; text-align: right;">${formatCurrencyDE(65000, cur)}</td>
            <td style="padding: 10px 12px; text-align: right;">19%</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700;">${formatCurrencyDE(65000, cur)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fafafa;">
            <td style="padding: 10px 12px; color: #64748b;">02</td>
            <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">Consulting, Cloud-Ablösung & Offline-Sicherheitsaudit (100% On-Premise)</td>
            <td style="padding: 10px 12px; text-align: right;">1 Pauschale</td>
            <td style="padding: 10px 12px; text-align: right;">${formatCurrencyDE(35000, cur)}</td>
            <td style="padding: 10px 12px; text-align: right;">19%</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700;">${formatCurrencyDE(35000, cur)}</td>
          </tr>
        </tbody>
      </table>
    `;

    return {
      '{Rechnung}': template.headerTitle || 'Rechnung',
      '{Rechnungsnummer}': 'RE-2026-0042',
      '{Datum}': new Date().toLocaleDateString('de-DE'),
      '{Faelligkeitsdatum}': new Date(Date.now() + (template.dueDays || 14) * 86400000).toLocaleDateString('de-DE'),
      '{Zahlungsziel_Tage}': String(template.dueDays || 14),
      '{Status}': 'Offen (Zur Zahlung fällig)',
      '{Waehrung}': cur,

      '{Kunde_Name}': 'Max Mustermann',
      '{Kunde_Firma}': 'Musterfirma Industrie & Handel GmbH',
      '{Kunde_Adresse}': 'Industriestraße 45',
      '{Kunde_PLZ_Ort}': '80339 München',
      '{Kunde_Email}': 'buchhaltung@muster-firma.de',
      '{Kunde_Telefon}': '+49 (0) 89 9876543',
      '{Kunde_UStId}': 'DE123456789',

      '{Netto}': formatCurrencyDE(testNet, cur),
      '{Ust_Satz}': '19%',
      '{Ust_Betrag}': formatCurrencyDE(testTax, cur),
      '{Gesamtbetrag}': formatCurrencyDE(testGross, cur),
      '{Steuerhinweis}': template.taxNote || 'Rechnungsbetrag enthält 19% Umsatzsteuer.',

      '{Positionen_Tabelle}': sampleTableHtml,

      '{Firma_Name}': template.companyName || company?.name || 'Mustermann Technologie & Commerce',
      '{Firma_Zusatz}': template.companySubtitle || '',
      '{Firma_Inhaber}': template.companyOwner || company?.letterhead_managing_director || 'Geschäftsführung',
      '{Firma_Adresse}': template.companyAddress || company?.street || 'Musterstraße 10',
      '{Firma_PLZ_Ort}': template.companyZipCity || company?.zip_city || '10115 Berlin',
      '{Firma_Telefon}': template.companyPhone || company?.phone || '+49 (0) 30 1234567',
      '{Firma_Email}': template.companyEmail || company?.email || 'buchhaltung@musterfirma.de',
      '{Firma_Website}': template.companyWebsite || 'www.musterfirma.de',
      '{Firma_Steuernummer}': template.companyTaxId || company?.tax_id || '143/123/45678',
      '{Firma_UStId}': template.companyVatId || company?.tax_id || 'DE987654321',
      '{Firma_IBAN}': template.companyIban || company?.iban || 'DE89 3704 0044 0532 0130 00',
      '{Firma_BIC}': template.companyBic || company?.bic || 'BYLADEM1001',
      '{Firma_Bank}': template.companyBankName || company?.bank_name || 'Deutsche Bank Berlin',
      '{Firma_Handelsregister}': template.companyCommercialRegister || company?.letterhead_commercial_register || 'Amtsgericht Charlottenburg HRB 98765 B',
      '{Primaerfarbe}': template.primaryColor || '#2563eb',
      '{Fusszeile}': (template.footerText || '').replace('{Zahlungsziel_Tage}', String(template.dueDays || 14)).replace('{Rechnungsnummer}', 'RE-2026-0042')
    };
  }

  // Real invoice values
  const net = Number(invoice.subtotal) || 0;
  const tax = Number(invoice.tax_total) || 0;
  const gross = Number(invoice.total) || (net + tax);
  const items = invoice.items || [];

  const itemsTableHtml = `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
          <th style="padding: 10px 12px; font-weight: 700; color: #334155;">Pos.</th>
          <th style="padding: 10px 12px; font-weight: 700; color: #334155;">Bezeichnung / Artikel</th>
          <th style="padding: 10px 12px; font-weight: 700; color: #334155; text-align: right;">Menge</th>
          <th style="padding: 10px 12px; font-weight: 700; color: #334155; text-align: right;">Einzelpreis</th>
          <th style="padding: 10px 12px; font-weight: 700; color: #334155; text-align: right;">MwSt</th>
          <th style="padding: 10px 12px; font-weight: 700; color: #334155; text-align: right;">Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${items.length === 0 ? `
          <tr>
            <td colspan="6" style="padding: 14px; text-align: center; color: #94a3b8;">Keine Positionen angegeben.</td>
          </tr>
        ` : items.map((it: InvoiceItem, idx: number) => {
          const qty = it.qty || 1;
          const price = it.unit_price || 0;
          const lineTotal = it.subtotal || (qty * price);
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #fafafa;' : ''}">
              <td style="padding: 10px 12px; color: #64748b;">${String(idx + 1).padStart(2, '0')}</td>
              <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${it.product_name || 'Position'}</td>
              <td style="padding: 10px 12px; text-align: right;">${qty}</td>
              <td style="padding: 10px 12px; text-align: right;">${formatCurrencyDE(price, cur)}</td>
              <td style="padding: 10px 12px; text-align: right;">${it.tax_rate ?? 19}%</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 700;">${formatCurrencyDE(lineTotal, cur)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  return {
    '{Rechnung}': template.headerTitle || 'Rechnung',
    '{Rechnungsnummer}': invoice.number || 'ENTWURF',
    '{Datum}': invoice.date ? new Date(invoice.date).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE'),
    '{Faelligkeitsdatum}': invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE'),
    '{Zahlungsziel_Tage}': String(template.dueDays || 14),
    '{Status}': invoice.status === 'paid' ? 'Bezahlt' : invoice.status === 'posted' ? 'Offen' : 'Entwurf',
    '{Waehrung}': cur,

    '{Kunde_Name}': invoice.contact_name || 'Kunde',
    '{Kunde_Firma}': invoice.contact_company || '',
    '{Kunde_Adresse}': '',
    '{Kunde_PLZ_Ort}': '',
    '{Kunde_Email}': '',
    '{Kunde_Telefon}': '',
    '{Kunde_UStId}': '',

    '{Netto}': formatCurrencyDE(net, cur),
    '{Ust_Satz}': '19%',
    '{Ust_Betrag}': formatCurrencyDE(tax, cur),
    '{Gesamtbetrag}': formatCurrencyDE(gross, cur),
    '{Steuerhinweis}': template.taxNote || 'Rechnungsbetrag enthält gesetzliche Mehrwertsteuer.',

    '{Positionen_Tabelle}': itemsTableHtml,

    '{Firma_Name}': template.companyName || company?.name || 'Ihr Firmenname',
    '{Firma_Zusatz}': template.companySubtitle || '',
    '{Firma_Inhaber}': template.companyOwner || company?.letterhead_managing_director || 'Geschäftsleitung',
    '{Firma_Adresse}': template.companyAddress || company?.street || 'Firmenstraße 1',
    '{Firma_PLZ_Ort}': template.companyZipCity || company?.zip_city || '10115 Berlin',
    '{Firma_Telefon}': template.companyPhone || company?.phone || '',
    '{Firma_Email}': template.companyEmail || company?.email || '',
    '{Firma_Website}': template.companyWebsite || '',
    '{Firma_Steuernummer}': template.companyTaxId || company?.tax_id || '',
    '{Firma_UStId}': template.companyVatId || company?.tax_id || '',
    '{Firma_IBAN}': template.companyIban || company?.iban || '',
    '{Firma_BIC}': template.companyBic || company?.bic || '',
    '{Firma_Bank}': template.companyBankName || company?.bank_name || '',
    '{Firma_Handelsregister}': template.companyCommercialRegister || company?.letterhead_commercial_register || '',
    '{Primaerfarbe}': template.primaryColor || '#2563eb',
    '{Fusszeile}': (template.footerText || '').replace('{Zahlungsziel_Tage}', String(template.dueDays || 14)).replace('{Rechnungsnummer}', invoice.number || 'ENTWURF')
  };
}

/**
 * Generate full HTML representation of invoice using template
 */
export function generateInvoiceHtml(
  template: InvoiceTemplate,
  invoice?: Partial<Invoice> | null,
  company?: CompanyProfile | null,
  currency: string = '€',
  isTestPreview: boolean = false
): string {
  const vars = buildInvoiceVariableDictionary(template, invoice, company, currency, isTestPreview);
  const color = template.primaryColor || '#2563eb';
  const font = template.fontFamily === 'serif' 
    ? 'Georgia, Cambria, "Times New Roman", Times, serif' 
    : template.fontFamily === 'mono' 
    ? '"JetBrains Mono", Consolas, "Courier New", Courier, monospace' 
    : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // 1. If custom body template is used
  if (template.useCustomLayout && template.customBodyTemplate) {
    let html = template.customBodyTemplate;
    for (const [key, value] of Object.entries(vars)) {
      html = html.split(key).join(value);
    }
    return html;
  }

  // 2. Built-in DIN 5008 / Modern / Corporate layout renderer
  const showLogo = template.showLogo && (template.logoUrl || company?.letterhead_photo_url);
  const logoSrc = template.logoUrl || company?.letterhead_photo_url;
  const showFoldMarks = template.showFoldMarks ?? true;

  return `
    <div style="font-family: ${font}; color: #0f172a; max-width: 800px; margin: 0 auto; background: #ffffff; padding: 24px; position: relative; line-height: 1.5; font-size: 13px;">
      
      ${showFoldMarks ? `
        <!-- DIN 5008 Falt- und Lochmarken -->
        <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 20px; pointer-events: none;">
          <div style="position: absolute; left: 4px; top: 105mm; width: 12px; height: 1px; background: #94a3b8;"></div>
          <div style="position: absolute; left: 4px; top: 148.5mm; width: 20px; height: 1.5px; background: #64748b;"></div>
          <div style="position: absolute; left: 4px; top: 210mm; width: 12px; height: 1px; background: #94a3b8;"></div>
        </div>
      ` : ''}

      <!-- Top Header & Branding Section -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${color}; padding-bottom: 20px; margin-bottom: 28px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          ${showLogo ? `
            <div style="max-width: 140px; max-height: 70px;">
              <img src="${logoSrc}" alt="Logo" style="max-width: 100%; max-height: 70px; object-fit: contain;" />
            </div>
          ` : `
            <div style="width: 48px; height: 48px; border-radius: 12px; background: ${color}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              ${(vars['{Firma_Name}'] || 'S').slice(0, 1)}
            </div>
          `}
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">${vars['{Firma_Name}']}</div>
            ${vars['{Firma_Zusatz}'] ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">${vars['{Firma_Zusatz}']}</div>` : ''}
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">${vars['{Firma_Adresse}']} • ${vars['{Firma_PLZ_Ort}']}</div>
          </div>
        </div>

        <div style="text-align: right;">
          <div style="font-size: 26px; font-weight: 900; color: ${color}; letter-spacing: -0.5px;">${vars['{Rechnung}']}</div>
          <div style="font-size: 13px; font-weight: 700; color: #334155; margin-top: 2px;">Nr. ${vars['{Rechnungsnummer}']}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Datum: <strong>${vars['{Datum}']}</strong></div>
          <div style="font-size: 11px; color: #64748b;">Fällig: <strong>${vars['{Faelligkeitsdatum}']}</strong></div>
        </div>
      </div>

      <!-- Sender Line & Recipient Address Box (DIN 5008 Standard) -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 30px; margin-bottom: 30px;">
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; background: #fafafa;">
          <!-- Small sender line above recipient -->
          <div style="font-size: 9px; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; font-weight: 600;">
            ${vars['{Firma_Name}']} • ${vars['{Firma_Adresse}']} • ${vars['{Firma_PLZ_Ort}']}
          </div>

          <!-- Recipient info -->
          ${vars['{Kunde_Firma}'] ? `<div style="font-size: 14px; font-weight: 700; color: #0f172a;">${vars['{Kunde_Firma}']}</div>` : ''}
          <div style="font-size: 13px; font-weight: 600; color: #1e293b;">${vars['{Kunde_Name}']}</div>
          ${vars['{Kunde_Adresse}'] ? `<div style="font-size: 12px; color: #475569; margin-top: 3px;">${vars['{Kunde_Adresse}']}</div>` : ''}
          ${vars['{Kunde_PLZ_Ort}'] ? `<div style="font-size: 12px; color: #475569;">${vars['{Kunde_PLZ_Ort}']}</div>` : ''}
          ${vars['{Kunde_Email}'] ? `<div style="font-size: 11px; color: #64748b; margin-top: 6px;">E-Mail: ${vars['{Kunde_Email}']}</div>` : ''}
        </div>

        <div style="width: 240px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px;">Belegübersicht</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
            <span style="color: #64748b;">Rechnungs-Nr.:</span>
            <strong style="color: #0f172a;">${vars['{Rechnungsnummer}']}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
            <span style="color: #64748b;">Rechnungsdatum:</span>
            <strong style="color: #0f172a;">${vars['{Datum}']}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
            <span style="color: #64748b;">Fälligkeitsdatum:</span>
            <strong style="color: #0f172a;">${vars['{Faelligkeitsdatum}']}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 6px;">
            <span style="color: #64748b;">Zahlungsstatus:</span>
            <span style="font-weight: 700; color: ${vars['{Status}'].includes('Bezahlt') ? '#16a34a' : '#d97706'};">${vars['{Status}']}</span>
          </div>
        </div>
      </div>

      <!-- Subject & Introductory Text -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
          ${template.headerTitle} ${vars['{Rechnungsnummer}']}
        </div>
        ${template.headerText ? `
          <div style="font-size: 12px; color: #475569; line-height: 1.5;">
            ${template.headerText}
          </div>
        ` : ''}
      </div>

      <!-- Positions Table -->
      <div style="margin-bottom: 24px;">
        ${vars['{Positionen_Tabelle}']}
      </div>

      <!-- Totals & Taxes Breakdown -->
      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
        <div style="width: 320px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-bottom: 6px;">
            <span>Nettobetrag (Zwischensumme):</span>
            <span style="font-weight: 600; color: #0f172a;">${vars['{Netto}']}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
            <span>Umsatzsteuer (${vars['{Ust_Satz}']}):</span>
            <span style="font-weight: 600; color: #0f172a;">${vars['{Ust_Betrag}']}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #0f172a;">
            <span>Gesamtbetrag (Brutto):</span>
            <span style="color: ${color};">${vars['{Gesamtbetrag}']}</span>
          </div>
        </div>
      </div>

      <!-- Legal Tax Note & Payment Terms -->
      <div style="background: #fafafa; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 36px; font-size: 12px; color: #334155;">
        <div style="font-weight: 600; margin-bottom: 4px;">Zahlungs- & Steuerhinweis:</div>
        <div>${vars['{Fusszeile}']}</div>
        ${vars['{Steuerhinweis}'] ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">${vars['{Steuerhinweis}']}</div>` : ''}
      </div>

      <!-- 4-Column Legal Footer (DIN 5008 Compliant) -->
      <div style="border-top: 2px solid #e2e8f0; padding-top: 18px; font-size: 10px; color: #64748b; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; line-height: 1.4;">
        <div>
          <strong style="color: #334155; display: block; margin-bottom: 3px;">Anschrift:</strong>
          <div>${vars['{Firma_Name}']}</div>
          <div>${vars['{Firma_Adresse}']}</div>
          <div>${vars['{Firma_PLZ_Ort}']}</div>
        </div>

        <div>
          <strong style="color: #334155; display: block; margin-bottom: 3px;">Kontakt:</strong>
          <div>Tel: ${vars['{Firma_Telefon}'] || '-'}</div>
          <div>E-Mail: ${vars['{Firma_Email}'] || '-'}</div>
          <div>Web: ${vars['{Firma_Website}'] || '-'}</div>
        </div>

        <div>
          <strong style="color: #334155; display: block; margin-bottom: 3px;">Bankverbindung:</strong>
          <div>${vars['{Firma_Bank}'] || 'Hausbank'}</div>
          <div>IBAN: ${vars['{Firma_IBAN}'] || '-'}</div>
          <div>BIC: ${vars['{Firma_BIC}'] || '-'}</div>
        </div>

        <div>
          <strong style="color: #334155; display: block; margin-bottom: 3px;">Rechtliche Angaben:</strong>
          <div>Inhaber: ${vars['{Firma_Inhaber}']}</div>
          <div>St.-Nr.: ${vars['{Firma_Steuernummer}'] || '-'}</div>
          ${vars['{Firma_UStId}'] ? `<div>USt-Id: ${vars['{Firma_UStId}']}</div>` : ''}
          ${vars['{Firma_Handelsregister}'] ? `<div>${vars['{Firma_Handelsregister}']}</div>` : ''}
        </div>
      </div>

    </div>
  `;
}

/**
 * Export invoice as formatted Microsoft Word (.doc) document
 */
export function exportInvoiceToWord(
  template: InvoiceTemplate,
  invoice?: Partial<Invoice> | null,
  company?: CompanyProfile | null,
  currency: string = '€'
): void {
  const invoiceHtml = generateInvoiceHtml(template, invoice, company, currency, false);

  const wordDocumentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Rechnung</title>
        <style>
          @page Section1 {
            size: 595.3pt 841.9pt; /* A4 */
            margin: 20mm 15mm 20mm 15mm;
            mso-header-margin: 35.4pt;
            mso-footer-margin: 35.4pt;
            mso-paper-source: 0;
          }
          div.Section1 { page: Section1; }
          body {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            color: #1e293b;
          }
          table { border-collapse: collapse; width: 100%; }
          th, td { padding: 6pt; border: 1px solid #cbd5e1; }
          th { background-color: #f1f5f9; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${invoiceHtml}
        </div>
      </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', wordDocumentHtml], {
    type: 'application/msword;charset=utf-8'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `${invoice?.number || 'Rechnung'}_Vorlage.doc`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Reads an uploaded template file (.docx / .html / .txt / .json), extracting text and finding variables
 */
export async function readUploadedTemplateFile(file: File): Promise<{ content: string; detectedVariables: string[] }> {
  const filename = file.name.toLowerCase();
  
  if (filename.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const content = typeof parsed === 'string' ? parsed : (parsed.customBodyTemplate || JSON.stringify(parsed, null, 2));
    const { recognized, unrecognized } = scanTemplateVariables(content);
    return { content, detectedVariables: [...recognized, ...unrecognized] };
  }

  // HTML or Text file
  const text = await file.text();
  const { recognized, unrecognized } = scanTemplateVariables(text);
  return {
    content: text,
    detectedVariables: [...recognized, ...unrecognized]
  };
}
