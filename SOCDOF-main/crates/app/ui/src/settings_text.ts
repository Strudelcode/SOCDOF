//! TS-parity labels for the desktop settings page. Kept outside the fixed
//! 1,011-key locale catalogs so all four languages stay complete without
//! changing the public translation key count.

import type { Language } from "./i18n";

interface SettingsText {
  home: string;
  displayGroup: string;
  screens: string;
  companyGroup: string;
  general: string;
  payments: string;
  letterhead: string;
  connections: string;
  systemGroup: string;
  personalization: string;
  language: string;
  shortcuts: string;
  sound: string;
  accountsGroup: string;
  account: string;
  admin: string;
  quickPersonalization: string;
  quickShortcuts: string;
  quickLanguage: string;
  quickCalendar: string;
  quickLetterhead: string;
  quickBank: string;
}

export const SETTINGS_TEXT: Record<Language, SettingsText> = {
  de: {
    home: "Startseite",
    displayGroup: "Anzeige & Bildschirme",
    screens: "Bildschirme & Skalierung",
    companyGroup: "Unternehmen & Workflow",
    general: "Allgemein & Stammdaten",
    payments: "Zahlungsmethoden & Terminals",
    letterhead: "Briefkopf & DIN 5008",
    connections: "Verbindungen & Google Kalender",
    systemGroup: "System & Personalisierung",
    personalization: "Personalisierung & Farben",
    language: "Sprache, Region & Zeit",
    shortcuts: "Tastenkombinationen & Kürzel",
    sound: "Sound & Audio",
    accountsGroup: "Konten & Profile",
    account: "Benutzerkonto & Profil",
    admin: "Admin",
    quickPersonalization: "Personalisierung",
    quickShortcuts: "Schnellnavigation per Tastatur, Meldefenster-Kürzel & Systemaktionen.",
    quickLanguage: "Sprache & Zeit",
    quickCalendar: "Verbindungen",
    quickLetterhead: "Dokumente",
    quickBank: "Unternehmen",
  },
  en: {
    home: "Overview",
    displayGroup: "Displays & Scaling",
    screens: "Screens & Scaling",
    companyGroup: "Company & Workflow",
    general: "General & Master Data",
    payments: "Payment Methods & Terminals",
    letterhead: "Letterhead & DIN 5008",
    connections: "Connections & Google Calendar",
    systemGroup: "System & Personalization",
    personalization: "Personalization & Colors",
    language: "Language, Region & Time",
    shortcuts: "Keyboard Shortcuts & Hotkeys",
    sound: "Sound & Audio",
    accountsGroup: "Accounts & Profiles",
    account: "User Account & Profile",
    admin: "Admin",
    quickPersonalization: "Personalization",
    quickShortcuts: "Keyboard navigation, ticket hotkeys & system actions.",
    quickLanguage: "Language & Time",
    quickCalendar: "Connections",
    quickLetterhead: "Documents",
    quickBank: "Company",
  },
  fr: {
    home: "Vue générale",
    displayGroup: "Affichage & Écrans",
    screens: "Écrans & Mise à l'échelle",
    companyGroup: "Entreprise & Flux de travail",
    general: "Général & Données de base",
    payments: "Modes de paiement & Terminaux",
    letterhead: "En-tête de lettre & DIN 5008",
    connections: "Connexions & Google Agenda",
    systemGroup: "Système & Personnalisation",
    personalization: "Personnalisation & Couleurs",
    language: "Langue, Région & Heure",
    shortcuts: "Raccourcis clavier & touches rapides",
    sound: "Son & Audio",
    accountsGroup: "Comptes & Profils",
    account: "Compte utilisateur & Profil",
    admin: "Admin",
    quickPersonalization: "Personnalisation",
    quickShortcuts: "Navigation au clavier, raccourcis de tickets & actions système.",
    quickLanguage: "Langue & Heure",
    quickCalendar: "Connexions",
    quickLetterhead: "Documents",
    quickBank: "Entreprise",
  },
  es: {
    home: "Vista general",
    displayGroup: "Pantallas y Escala",
    screens: "Pantallas y Escalado",
    companyGroup: "Empresa y Flujo de trabajo",
    general: "General y Datos maestros",
    payments: "Métodos de pago y terminales",
    letterhead: "Membrete y DIN 5008",
    connections: "Conexiones y Google Calendar",
    systemGroup: "Sistema y Personalización",
    personalization: "Personalización y Colores",
    language: "Idioma, Región y Hora",
    shortcuts: "Atajos de teclado y teclas rápidas",
    sound: "Sonido y Audio",
    accountsGroup: "Cuentas y Perfiles",
    account: "Cuenta de usuario y Perfil",
    admin: "Admin",
    quickPersonalization: "Personalización",
    quickShortcuts: "Navegación por teclado, atajos de tickets y acciones del sistema.",
    quickLanguage: "Idioma y Hora",
    quickCalendar: "Conexiones",
    quickLetterhead: "Documentos",
    quickBank: "Empresa",
  },
};
