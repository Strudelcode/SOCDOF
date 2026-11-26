//! Labels used by the TS desktop modules that are intentionally kept out of the
//! fixed 1,011-key locale catalogs. Keeping them in one typed table preserves a
//! complete UI in every supported language without changing the public locale
//! key count.

import type { Language } from "./i18n";

export interface ParityText {
  entries: string;
  contactsEmpty: string;
  contactsCreateFirst: string;
  contactBatch: string;
  contactImport: string;
  contactExportOptions: string;
  contactExportAll: string;
  contactExportVcf: string;
  contactExportButton: string;
  invoiceJournal: string;
  invoiceTemplates: string;
  invoiceImport: string;
  invoiceEmpty: string;
  invoiceNew: string;
  invoiceContact: string;
  invoiceDate: string;
  invoiceDue: string;
  invoiceStatus: string;
  invoiceTotal: string;
  invoiceActions: string;
  invoiceNumber: string;
  invoiceSearch: string;
  contactSearch: string;
}

export const PARITY_TEXT: Record<Language, ParityText> = {
  de: {
    entries: "Einträge",
    contactsEmpty: "Keine Kontakte gefunden.",
    contactsCreateFirst: "+ Jetzt ersten Kontakt anlegen",
    contactBatch: "+ Mehrere anlegen",
    contactImport: "CSV / Outlook Import",
    contactExportOptions: "Kontakte exportieren",
    contactExportAll: "Alle Kontakte exportieren",
    contactExportVcf: "Outlook, Apple & Android",
    contactExportButton: "Export",
    invoiceJournal: "Rechnungsjournal",
    invoiceTemplates: "Vorlagen & Layout",
    invoiceImport: "XML / FatturaPA importieren",
    invoiceEmpty: "Keine Rechnungen in diesem Filter vorhanden.",
    invoiceNew: "+ Neue Rechnung",
    invoiceContact: "Kunde / Empfänger",
    invoiceDate: "Datum",
    invoiceDue: "Fälligkeit",
    invoiceStatus: "Status",
    invoiceTotal: "Gesamtbetrag (Brutto)",
    invoiceActions: "Aktionen",
    invoiceNumber: "Rechnungs-Nr.",
    invoiceSearch: "Rechnung oder Kunde suchen...",
    contactSearch: "Kontakt oder Firma suchen...",
  },
  en: {
    entries: "entries",
    contactsEmpty: "No contacts found.",
    contactsCreateFirst: "+ Create First Contact Now",
    contactBatch: "+ Batch Add Multiple",
    contactImport: "CSV / Outlook Import",
    contactExportOptions: "Export contacts",
    contactExportAll: "Export all contacts",
    contactExportVcf: "Outlook, Apple & Android",
    contactExportButton: "Export",
    invoiceJournal: "Invoice Journal",
    invoiceTemplates: "Templates & Layout",
    invoiceImport: "XML / FatturaPA import",
    invoiceEmpty: "No invoices in this filter.",
    invoiceNew: "+ New Invoice",
    invoiceContact: "Customer / Recipient",
    invoiceDate: "Date",
    invoiceDue: "Due Date",
    invoiceStatus: "Status",
    invoiceTotal: "Total (gross)",
    invoiceActions: "Actions",
    invoiceNumber: "Invoice No.",
    invoiceSearch: "Search invoice or customer...",
    contactSearch: "Search contact or company...",
  },
  fr: {
    entries: "entrées",
    contactsEmpty: "Aucun contact trouvé.",
    contactsCreateFirst: "+ Créer le premier contact",
    contactBatch: "+ Création groupée",
    contactImport: "Import CSV / Outlook",
    contactExportOptions: "Exporter les contacts",
    contactExportAll: "Exporter tous les contacts",
    contactExportVcf: "Outlook, Apple & Android",
    contactExportButton: "Export",
    invoiceJournal: "Journal des factures",
    invoiceTemplates: "Modèles & Mise en page",
    invoiceImport: "Importer XML / FatturaPA",
    invoiceEmpty: "Aucune facture dans ce filtre.",
    invoiceNew: "+ Nouvelle facture",
    invoiceContact: "Client / Destinataire",
    invoiceDate: "Date",
    invoiceDue: "Échéance",
    invoiceStatus: "Statut",
    invoiceTotal: "Total (brut)",
    invoiceActions: "Actions",
    invoiceNumber: "N° de facture",
    invoiceSearch: "Rechercher facture ou client...",
    contactSearch: "Rechercher contact ou entreprise...",
  },
  es: {
    entries: "entradas",
    contactsEmpty: "No se encontraron contactos.",
    contactsCreateFirst: "+ Crear primer contacto",
    contactBatch: "+ Creación por lotes",
    contactImport: "Importar CSV / Outlook",
    contactExportOptions: "Exportar contactos",
    contactExportAll: "Exportar todos los contactos",
    contactExportVcf: "Outlook, Apple & Android",
    contactExportButton: "Exportar",
    invoiceJournal: "Diario de facturas",
    invoiceTemplates: "Plantillas y Diseño",
    invoiceImport: "Importar XML / FatturaPA",
    invoiceEmpty: "No hay facturas en este filtro.",
    invoiceNew: "+ Nueva factura",
    invoiceContact: "Cliente / Destinatario",
    invoiceDate: "Fecha",
    invoiceDue: "Vencimiento",
    invoiceStatus: "Estado",
    invoiceTotal: "Total (bruto)",
    invoiceActions: "Acciones",
    invoiceNumber: "N.º de factura",
    invoiceSearch: "Buscar factura o cliente...",
    contactSearch: "Buscar contacto o empresa...",
  },
};
