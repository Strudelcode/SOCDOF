//! TS-parity palette descriptions and icon colours. The labels themselves are
//! read from the live module navigation so the palette always reflects the
//! modules the Rust desktop actually exposes.

import type { Language } from "./i18n";

export const PALETTE_COLORS: Record<string, string> = {
  dashboard: "#9333ea",
  invoices: "#4f46e5",
  accounting: "#059669",
  contacts: "#0d9488",
  products: "#2563eb",
  stock: "#d97706",
  pos: "#7c3aed",
  calendar: "#2563eb",
  templates: "#7c3aed",
  purchases: "#ea580c",
  reports: "#0891b2",
  fleet: "#0d9488",
  projects: "#4f46e5",
  restaurant: "#d97706",
  documents: "#0284c7",
  docs: "#0284c7",
  users: "#475569",
  settings: "#334155",
};

const DESCRIPTIONS: Record<Language, Record<string, string>> = {
  de: {
    dashboard: "Echtzeit-Umsätze, offene Rechnungen und Kennzahlen",
    invoices: "DIN 5008 Rechnungen, Gutschriften und PDF-Druck",
    accounting: "EÜR, BWA, USt-Voranmeldung, Offene Posten und Z-Bon",
    contacts: "Kunden, Lieferanten und Adressbuch-Import",
    products: "Artikelkatalog, Barcodes, Preise und Lagerbestände",
    stock: "Umlagerungen, Wareneingang und Inventur",
    pos: "Touchscreen-Kasse mit Scanner und Bon-Druck",
    calendar: "Google Kalender, iCal-Sync, Termine & Rechnungserinnerungen",
    templates: "Rechnungsvorlagen, Layouts und Dokumentdesign",
    purchases: "Lieferantenbestellungen und Einkaufsbelege",
    reports: "Auswertungen, Statistiken und Exporte",
    fleet: "Fahrzeuge, Fahrtenbuch und Wartung",
    projects: "Projekte, Aufgaben und Zeiterfassung",
    restaurant: "Tischplan, Bestellungen und Gastronomie",
    documents: "Dokumente, Ablage und Archiv",
    docs: "Handbuch, Showcase und Release-Notizen",
    users: "Benutzerkonten und Berechtigungen",
    settings: "Systemkonfiguration, Backup und Wiederherstellung",
  },
  en: {
    dashboard: "Real-time revenue, open invoices and KPIs",
    invoices: "DIN 5008 invoices, credit notes and PDF printing",
    accounting: "P&L, cash-basis report, VAT return, open items and Z-report",
    contacts: "Customers, suppliers and address-book import",
    products: "Product catalog, barcodes, prices and stock levels",
    stock: "Stock transfers, goods receipt and inventory",
    pos: "Touchscreen register with scanner and receipt printing",
    calendar: "Google Calendar, iCal sync, appointments & invoice reminders",
    templates: "Invoice templates, layouts and document design",
    purchases: "Supplier orders and purchase documents",
    reports: "Analytics, statistics and exports",
    fleet: "Vehicles, logbook and maintenance",
    projects: "Projects, tasks and time tracking",
    restaurant: "Table plan, orders and hospitality",
    documents: "Documents, filing and archive",
    docs: "Manual, showcase and release notes",
    users: "User accounts and permissions",
    settings: "System configuration, backup and restore",
  },
  fr: {
    dashboard: "Chiffre d'affaires en temps réel, factures ouvertes et indicateurs",
    invoices: "Factures DIN 5008, avoirs et impression PDF",
    accounting: "Résultat, TVA, postes ouverts et rapport Z",
    contacts: "Clients, fournisseurs et import de carnet d'adresses",
    products: "Catalogue d'articles, codes-barres, prix et stocks",
    stock: "Transferts de stock, réceptions et inventaire",
    pos: "Caisse tactile avec scanner et impression de tickets",
    calendar: "Google Agenda, synchronisation iCal, rendez-vous et rappels",
    templates: "Modèles de factures, mises en page et design",
    purchases: "Commandes fournisseurs et pièces d'achat",
    reports: "Analyses, statistiques et exports",
    fleet: "Véhicules, carnet de bord et maintenance",
    projects: "Projets, tâches et suivi du temps",
    restaurant: "Plan de salle, commandes et restauration",
    documents: "Documents, classement et archive",
    docs: "Manuel, vitrine et notes de version",
    users: "Comptes utilisateurs et autorisations",
    settings: "Configuration système, sauvegarde et restauration",
  },
  es: {
    dashboard: "Ingresos en tiempo real, facturas abiertas e indicadores",
    invoices: "Facturas DIN 5008, abonos e impresión PDF",
    accounting: "Resultados, IVA, partidas abiertas e informe Z",
    contacts: "Clientes, proveedores e importación de libreta de direcciones",
    products: "Catálogo de artículos, códigos de barras, precios y stock",
    stock: "Transferencias, entradas de mercancía e inventario",
    pos: "Caja táctil con escáner e impresión de tickets",
    calendar: "Google Calendar, sincronización iCal, citas y recordatorios",
    templates: "Plantillas de facturas, diseños y documentos",
    purchases: "Pedidos a proveedores y documentos de compra",
    reports: "Análisis, estadísticas y exportaciones",
    fleet: "Vehículos, libro de ruta y mantenimiento",
    projects: "Proyectos, tareas y registro de tiempo",
    restaurant: "Plano de mesas, pedidos y hostelería",
    documents: "Documentos, archivo y gestión documental",
    docs: "Manual, showcase y notas de versión",
    users: "Cuentas de usuario y permisos",
    settings: "Configuración del sistema, copia de seguridad y restauración",
  },
};

export function paletteDescription(language: Language, view: string): string {
  return DESCRIPTIONS[language][view] ?? "";
}

/// Labels for palette-only modules that have no own webview tab. They mirror the
/// TypeScript Spotlight rows without touching the 1,011-key locale packs.
const LABELS: Record<Language, Record<string, string>> = {
  de: { stock: "Lager", pos: "POS Kasse" },
  en: { stock: "Stock", pos: "POS register" },
  fr: { stock: "Stock", pos: "Caisse POS" },
  es: { stock: "Almacén", pos: "Caja POS" },
};

export function paletteLabel(language: Language, view: string): string {
  return LABELS[language][view] ?? "";
}
