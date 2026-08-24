export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const APP_VERSION = '19.0.0';
export const APP_NAME = 'SOCDOF';
export const APP_FULL_NAME = "Strudel's Organization, Commerce & Documentation Offline Flow";
export const APP_AUTHOR = 'Yuri';
export const APP_LOCATION = 'South Tyrol, Italy';
export const APP_COPYRIGHT = '© Strudel';

export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: '19.0.0',
    date: '2026-08-24',
    title: 'Smart Desktop App Folders, App Store Harmony & Taskbar Streamline',
    highlights: [
      'Smart Desktop App Folders: Drag-and-Drop app grouping creating Android/iOS-style squircle folders with live 2x2 mini icon preview',
      'Interactive Folder Modal: Clean popup view with inline rename, quick app launching, and dissolve folder actions',
      'App Store Typography & Branding: Renamed all instances of "Odoo App Store" to "App Store" with uniform font weights',
      'Taskbar Tray Streamline: Removed redundant local app reminder button for a clean, distraction-free native desktop status bar',
      'Release Versioning & /versions/ documentation: Formally added V19.md, V18.md, V17.md and versioning guidelines',
      'Copyright & Origin: Updated copyright to © Strudel (Yuri, South Tyrol, Italy)'
    ]
  },
  {
    version: '18.3.5',
    date: '2026-08-24',
    title: 'Native Windows Folder Picker & GitHub Pages Base Fix',
    highlights: [
      'Nativer Windows-Ordnerdialog beim Starten: Installationsordner wird beim Ausführen der .cmd/.bat/.ps1 direkt über ein grafisches Windows-Auswahlfenster gewählt',
      'GitHub Pages & Offline Index.html Fix: Relative Basispfade (base: ./) beheben weiße Bildschirme auf strudelcode.github.io/SOCDOF/ und lokalen HTML-Deployments',
      'Vereinfachter Setup-Assistent im Web-Interface: Keine Vorabauswahl im Browser nötig, Direktdownload für .cmd, .bat und .ps1',
      'Automatische Erstellung der Ordnerstruktur (\\Data, \\Backups, \\Exports, \\Config) und Desktop-Verknüpfung'
    ]
  },
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
