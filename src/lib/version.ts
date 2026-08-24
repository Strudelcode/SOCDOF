export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_VERSION = '18.3.4';
export const APP_NAME = 'SOCDOF';
export const APP_FULL_NAME = "Strudel's Organization, Commerce & Documentation Offline Flow";

export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: '18.3.4',
    date: '2026-08-24',
    title: 'Windows Desktop Setup & Local Directory Hierarchy Wizard',
    highlights: [
      'Echter Windows Setup-Assistent (Setup_SOCDOF_Windows.cmd & Install_SOCDOF_Wizard.ps1) mit interaktiver Pfadauswahl',
      'Automatische Erstellung der lokalen Ordnerstruktur (\\Data, \\Backups, \\Exports, \\Config) auf der PC-Festplatte',
      'Vollständig autarke Offline-Ausführung ohne Cloud-URLs (kein Google 403 Forbidden Fehler mehr)',
      'Konfigurierbare Windows-Pfadverwaltung direkt im Einstellungsbereich "Speicher & Datensicherung"',
      'Verknüpfung zu GitHub Releases für vorkompilierte Electron & NSIS .exe Pakete'
    ]
  },
  {
    version: '18.3.3',
    date: '2026-08-24',
    title: 'Pure Windows OS Experience & Enhanced Language Controls',
    highlights: [
      'Vollständiger Fokus auf Windows 11 Desktop-Fensterverwaltung (Web-Vollbildmodus & Banner entfernt)',
      'Optimierter, kontrastreicher Sprachauswahl-Dialog mit Standard-Englisch und Vektorflaggen',
      'Einheitliches Versions- und Status-Widget in den Einstellungen & Dokumentation',
      'Verbindung der Versionsdaten mit README.md, Status.md und System-Status-Karten'
    ]
  },
  {
    version: '18.3.2',
    date: '2026-08-24',
    title: 'Community Integration & Kalender-Status Korrektur',
    highlights: [
      'Kalender-Status zeigt standardmäßig "Nicht verbunden (Inaktiv)" bis zur echten Kopplung',
      'Offizielles GitHub-Repository (https://github.com/Strudelcode/SOCDOF) verknüpft',
      'Support-Verlinkung ausschließlich auf den Discord-Server (https://discord.gg/QW85EaXTgB)',
      'Offizielles SOCDOF Vektor-Logo als Startbutton, Header & PWA-Icon integriert',
      'Standard-Firmenname auf "Strudel\'s Test GmbH" gesetzt'
    ]
  },
  {
    version: '18.3.1',
    date: '2026-08-24',
    title: 'Windows Desktop Launcher & Sound System',
    highlights: [
      'Automatischer Generator für Windows .bat & .ps1 Desktop-Starter',
      'Akustisches Feedback-System mit Stummschalt-Funktion für alle Interaktionen',
      'Windows Dark Mode & DIN-5008 Light Mode mit dynamischen Akzentfarben'
    ]
  },
  {
    version: '18.3.0',
    date: '2026-08-20',
    title: 'Windows 11 Desktop Workspace & Offline ERP Core',
    highlights: [
      'Verschiebbare, skalierbare Mehrfenster-Umgebung mit Aero Snap Andocken',
      'DIN 5008 Rechnungen, Angebote, Lieferscheine & GiroCode QR-Rechnungen',
      'Restaurant & POS-Kassenmodul mit grafischem Tischplan & Bon-Split',
      '100% Offline-Datenbank (Dexie / IndexedDB) mit 1-Klick JSON-Backup'
    ]
  }
];
