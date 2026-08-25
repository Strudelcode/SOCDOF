import { useState, useEffect } from 'react';

export type LanguageCode = 'en' | 'de' | 'fr' | 'es';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  flag: string;
  badge?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English (US/UK)', nativeLabel: 'English', flag: '🇺🇸', badge: 'Default' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' }
];

export const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    // App & Header
    'app.name': 'SOCDOF',
    'app.tagline': "Strudel's Organization, Commerce & Documentation Offline Flow",
    'app.subtitle': '100% Local Windows Desktop ERP Suite',
    'app.welcome': 'Welcome to SOCDOF',
    'app.welcome_desc': 'Your complete local offline ERP Suite with multi-window workspace, DIN 5008 invoices, POS register, CRM, and accounting.',

    // Navigation & Windows
    'nav.start': 'Start',
    'nav.search': 'Search (Ctrl+K)...',
    'nav.search_placeholder': 'Type to search apps, contacts, invoices...',
    'nav.all_apps': 'All Modules',
    'nav.pinned': 'Pinned Apps',
    'nav.recommended': 'Recommended',
    'nav.windows_manager': 'Desktop Manager',
    'nav.sound_effects': 'Sound Effects',
    'nav.dark_mode': 'Dark Mode',
    'nav.light_mode': 'Light Mode',
    'nav.lock': 'Lock Workstation',
    'nav.logout': 'Sign Out',
    'nav.power': 'Power / Restart',
    'nav.studio': 'Studio Editor',
    'nav.web_mode': 'Switch to Classic Web',
    'nav.desktop_mode': 'Switch to Windows Desktop',
    'nav.switch_language': 'Language Settings',
    'nav.quick_actions': 'Quick Actions',
    'nav.tutorial': 'Tutorial & Tour',

    // Modules
    'module.launcher': 'App Launcher',
    'module.dashboard': 'Dashboard',
    'module.invoices': 'Invoices',
    'module.accounting': 'Accounting',
    'module.contacts': 'Contacts',
    'module.products': 'Products',
    'module.stock': 'Inventory',
    'module.purchases': 'Purchases',
    'module.pos': 'POS Register',
    'module.restaurant': 'Restaurant',
    'module.support_services': 'Support',
    'module.ios_billing': 'Fast POS',
    'module.appstore': 'App Store',
    'module.docs': 'Documentation',
    'module.settings': 'Settings',

    // Module Subtitles & Descriptions
    'desc.dashboard': 'Live revenue, open invoices, and sales performance',
    'desc.invoices': 'Create DIN 5008 invoices, credit notes, and PDFs',
    'desc.accounting': 'Income statement, VAT return, open receivables, Z-Report',
    'desc.contacts': 'Manage customers, suppliers, and address imports',
    'desc.products': 'Article catalog, barcodes, prices, and stock levels',
    'desc.stock': 'Transfers, incoming goods, and inventory management',
    'desc.purchases': 'Supplier orders, RFQs, and purchase bills',
    'desc.pos': 'Touchscreen cash register with barcode scanner & receipts',
    'desc.restaurant': 'Digital menu, table management, and kitchen display',
    'desc.support_services': 'Log customer support tasks, track time, and assign tickets',
    'desc.ios_billing': 'Quick order & cash register flow',
    'desc.appstore': 'Activate, pin, and configure system modules',
    'desc.docs': 'Complete user guide and workflow documentation',
    'desc.settings': 'Company data, letterhead, colors, and JSON backups',

    // Common Actions & Buttons
    'action.save': 'Save Changes',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.create': 'Create New',
    'action.new_invoice': '+ New Invoice',
    'action.new_contact': '+ New Contact',
    'action.new_product': '+ New Product',
    'action.new_purchase': '+ New Purchase Order',
    'action.new_stock_move': '+ New Stock Transfer',
    'action.print': 'Print / PDF',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.filter': 'Filter',
    'action.search': 'Search',
    'action.refresh': 'Refresh',
    'action.reset': 'Reset',
    'action.confirm': 'Confirm',
    'action.close': 'Close',
    'action.minimize': 'Minimize',
    'action.maximize': 'Maximize',
    'action.restore': 'Restore',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.finish': 'Finish',
    'action.skip': 'Skip',
    'action.default_english': 'Default: English',
    'action.continue': 'Continue',
    'action.select_language': 'Select Language',
    'action.apply': 'Apply',
    'action.open': 'Open',
    'action.download': 'Download',
    'action.upload': 'Upload',
    'action.switch': 'Switch',
    'action.enable': 'Enable',
    'action.mute': 'Mute',

    // Language Modal Specific
    'lang_modal.title': 'Choose Your Language',
    'lang_modal.subtitle': 'Select your preferred language for the SOCDOF Desktop Suite. You can change this anytime in Language Settings.',
    'lang_modal.skip_hint': 'You can skip and continue with English.',
    'lang_modal.english_default_badge': 'Standard / Default',
    'lang_modal.current_selected': 'Active Selection',
    'lang_modal.auto_saved': 'Saved automatically to local database',
    'lang_modal.sample_hint': 'Quick Start & Interactive Demo available in top bar',

    // Settings Sections
    'settings.title': 'SOCDOF Settings',
    'settings.home': 'Overview',
    'settings.general': 'General & Master Data',
    'settings.personalization': 'Personalization & Colors',
    'settings.language': 'Language Settings & Region',
    'settings.connections': 'Connections & Google Calendar',
    'settings.letterhead': 'Letterhead & DIN 5008',
    'settings.storage': 'Storage & Backup',
    'settings.audio': 'Sound & Audio',
    'settings.windows': 'Windows Desktop App',
    'settings.danger': 'System Reset & Danger Zone',

    // Personalization & Appearance
    'settings.personalization_title': 'Personalization & Color Scheme (Windows Style)',
    'settings.personalization_desc': 'Customize appearance, system accent colors, and desktop window effects.',
    'settings.theme_mode': 'Select Theme Mode',
    'settings.light_mode': 'Light Mode',
    'settings.light_mode_desc': 'Crisp, high-contrast light background',
    'settings.dark_mode': 'Dark Mode',
    'settings.dark_mode_desc': 'Eye-friendly Windows dark aesthetic',
    'settings.mica_title': 'Windows Mica / Acrylic Glass Overlay',
    'settings.mica_desc': 'Subtle blur and translucent titlebars for a native desktop feel.',
    'settings.accent_system_title': 'System Accent Color & Color Picasso',
    'settings.accent_system_desc': 'Instantly applied across window headers, buttons, badges, and the taskbar.',
    'settings.active_badge': 'Active',
    'settings.picasso_title': 'Color Picasso Palette Picker',
    'settings.picasso_desc': 'Freely choose and customize any system accent color',
    'settings.random_color': 'Random',
    'settings.taskbar_title': 'Taskbar Color & Style (Bottom Bar)',
    'settings.taskbar_desc': 'Choose the appearance and style of the bottom taskbar.',
    'settings.taskbar_default': 'Standard Windows 11',
    'settings.taskbar_default_desc': 'Neutral light / dark style',
    'settings.taskbar_accent': 'Accent Tinted',
    'settings.taskbar_accent_desc': 'Adapts selected system color',
    'settings.taskbar_glass': 'Acrylic Glass',
    'settings.taskbar_glass_desc': 'Semi-transparent with blur',
    'settings.taskbar_dark': 'Deep Dark',
    'settings.taskbar_dark_desc': 'Classic dark bar',
    'settings.live_preview_title': 'Live Color Preview:',
    'settings.live_preview_desc': 'Text, buttons, borders & badges',
    'settings.font_scale_title': 'Font Size & Scaling (Zoom)',
    'settings.font_scale_desc': 'Adjust the system font size smoothly (90% to 130%).',
    'settings.font_scale_reset': '100% Reset',
    'settings.wallpaper_title': 'Desktop Wallpaper Background',
    'settings.wallpaper_desc': 'Choose a custom background image for your workspace or use the default gradient.',
    'settings.wallpaper_upload': 'Upload Image',
    'settings.wallpaper_remove': 'Remove Wallpaper',
    'settings.wallpaper_default': 'Default',
    'settings.save_now': 'Save Settings Now',
    'settings.save_success': 'Settings successfully saved!',

    // General & Master Data
    'settings.company_data_title': 'Company & Master Data',
    'settings.company_data_desc': 'Manage company name, address, tax ID, and contact information for invoices.',
    'settings.company_name': 'Company Name',
    'settings.owner_name': 'Managing Director / Owner',
    'settings.street': 'Street & House Number',
    'settings.city_zip': 'City & Postal Code',
    'settings.country': 'Country',
    'settings.tax_id': 'Tax Number / VAT ID',
    'settings.bank_name': 'Bank Name',
    'settings.iban': 'IBAN',
    'settings.bic': 'BIC / Swift',
    'settings.email': 'Email Address',
    'settings.phone': 'Phone Number',
    'settings.website': 'Website',

    // Language & Region
    'settings.lang_region_title': 'Language Settings, Currency & Regional Formats',
    'settings.lang_region_desc': 'Choose your display language, date format, and currency.',
    'settings.display_language': 'System Language',
    'settings.currency_symbol': 'Currency Symbol',
    'settings.date_format_label': 'Date Format',
    'settings.timezone_label': 'Timezone',

    // System Status Card
    'status.system_title': 'System Status',
    'status.local_active': 'Local Active',
    'status.storage_label': 'Storage:',
    'status.records_label': 'records',
    'status.version_label': 'Version:',
    'status.github_repo': 'GitHub Repository',
    'status.discord_help': 'Help on Discord',

    // Accent Colors & Color Picasso
    'accent.label': 'System Accent Color',
    'accent.applied': 'System accent color successfully applied!',
    'accent.desc': 'Changes the theme colors across buttons, badges, window headers, and taskbar highlights.',
    'accent.picasso_title': 'Color Picasso Palette Picker',
    'accent.picasso_desc': 'Freely choose and customize any system accent color',
    'accent.random': 'Random',

    // Dashboard & Metrics
    'dash.revenue': 'Total Invoiced Revenue',
    'dash.open_invoices': 'Open Invoices',
    'dash.paid_invoices': 'Paid Invoices',
    'dash.inventory_value': 'Warehouse Inventory Value',
    'dash.low_stock': 'Low Stock Warnings',
    'dash.quick_actions': 'Quick Actions',
    'dash.recent_invoices': 'Recent Invoices',
    'dash.recent_moves': 'Recent Stock Movements',
    'dash.filter_all': 'All Time',
    'dash.filter_month': 'This Month',
    'dash.filter_today': 'Today',

    // Statuses
    'status.draft': 'Draft',
    'status.posted': 'Posted',
    'status.paid': 'Paid',
    'status.cancelled': 'Cancelled',
    'status.ordered': 'Ordered',
    'status.received': 'Received',
    'status.preparing': 'Preparing',
    'status.ready': 'Ready',
    'status.served': 'Served',
    'status.overdue': 'Overdue',

    // Windows Toast
    'toast.settings_saved': 'Settings Saved',
    'toast.settings_saved_desc': 'Saved locally in IndexedDB • Immediately active'
  },

  de: {
    // App & Header
    'app.name': 'SOCDOF',
    'app.tagline': "Strudel's Organization, Commerce & Documentation Offline Flow",
    'app.subtitle': '100% Lokale Windows Desktop ERP Suite',
    'app.welcome': 'Willkommen bei SOCDOF',
    'app.welcome_desc': 'Ihre vollständige lokale Offline-ERP-Suite mit Fenstermanager, DIN 5008 Rechnungen, POS Kasse, CRM und Buchhaltung.',

    // Navigation & Windows
    'nav.start': 'Start',
    'nav.search': 'Suchen (Strg+K)...',
    'nav.search_placeholder': 'Apps, Kontakte, Rechnungen suchen...',
    'nav.all_apps': 'Alle Module',
    'nav.pinned': 'Angeheftete Apps',
    'nav.recommended': 'Empfohlen',
    'nav.windows_manager': 'Fenstermanager',
    'nav.sound_effects': 'Soundeffekte',
    'nav.dark_mode': 'Dunkelmodus',
    'nav.light_mode': 'Hellmodus',
    'nav.lock': 'Arbeitsplatz sperren',
    'nav.logout': 'Abmelden',
    'nav.power': 'Herunterfahren / Neu starten',
    'nav.studio': 'Studio Editor',
    'nav.web_mode': 'Zu klassischem Web wechseln',
    'nav.desktop_mode': 'Zu Windows Desktop wechseln',
    'nav.switch_language': 'Spracheinstellungen',
    'nav.quick_actions': 'Schnellaktionen',
    'nav.tutorial': 'Tutorial & Rundgang',

    // Modules
    'module.launcher': 'App Launcher',
    'module.dashboard': 'Dashboard',
    'module.invoices': 'Rechnungen',
    'module.accounting': 'Abrechnung',
    'module.contacts': 'Kontakte',
    'module.products': 'Produkte',
    'module.stock': 'Lager',
    'module.purchases': 'Einkauf',
    'module.pos': 'POS Kasse',
    'module.restaurant': 'Restaurant',
    'module.support_services': 'Support',
    'module.ios_billing': 'Schnellkasse',
    'module.appstore': 'App Store',
    'module.docs': 'Handbuch',
    'module.settings': 'Einstellungen',

    // Module Subtitles & Descriptions
    'desc.dashboard': 'Echtzeit-Umsätze, offene Rechnungen und Kennzahlen',
    'desc.invoices': 'DIN 5008 Rechnungen, Gutschriften und PDF-Druck',
    'desc.accounting': 'EÜR, BWA, USt-Voranmeldung, Offene Posten und Z-Bon',
    'desc.contacts': 'Kunden, Lieferanten und Adressbuch-Import',
    'desc.products': 'Artikelkatalog, Barcodes, Preise und Lagerbestände',
    'desc.stock': 'Umlagerungen, Wareneingang und Inventur',
    'desc.purchases': 'Lieferantenbestellungen und Einkaufsbelege',
    'desc.pos': 'Touchscreen-Kasse mit Scanner und Bon-Druck',
    'desc.restaurant': 'Speisekarte, Tischverwaltung und Küchen-Monitor',
    'desc.support_services': 'Kunden-Support-Einsätze erfassen, Zeiterfassung & Dokumentation',
    'desc.ios_billing': 'Schnelle Touch-Bestellung und Abrechnung',
    'desc.appstore': 'Module aktivieren, anheften und konfigurieren',
    'desc.docs': 'Vollständiges Benutzerhandbuch und Abläufe',
    'desc.settings': 'Firmendaten, Briefkopf, Farben und JSON-Backups',

    // Common Actions & Buttons
    'action.save': 'Änderungen speichern',
    'action.cancel': 'Abbrechen',
    'action.delete': 'Löschen',
    'action.edit': 'Bearbeiten',
    'action.create': 'Neu erstellen',
    'action.new_invoice': '+ Neue Rechnung',
    'action.new_contact': '+ Neuer Kontakt',
    'action.new_product': '+ Neuer Artikel',
    'action.new_purchase': '+ Neue Bestellung',
    'action.new_stock_move': '+ Neue Umlagerung',
    'action.print': 'Drucken / PDF',
    'action.export': 'Exportieren',
    'action.import': 'Importieren',
    'action.filter': 'Filtern',
    'action.search': 'Suchen',
    'action.refresh': 'Aktualisieren',
    'action.reset': 'Zurücksetzen',
    'action.confirm': 'Bestätigen',
    'action.close': 'Schließen',
    'action.minimize': 'Minimieren',
    'action.maximize': 'Maximieren',
    'action.restore': 'Wiederherstellen',
    'action.back': 'Zurück',
    'action.next': 'Weiter',
    'action.finish': 'Fertigstellen',
    'action.skip': 'Überspringen',
    'action.default_english': 'Standard: Englisch',
    'action.continue': 'Fortfahren',
    'action.select_language': 'Sprache auswählen',
    'action.apply': 'Übernehmen',
    'action.open': 'Öffnen',
    'action.download': 'Herunterladen',
    'action.upload': 'Hochladen',
    'action.switch': 'Wechseln',
    'action.enable': 'Aktivieren',
    'action.mute': 'Stumm',

    // Language Modal Specific
    'lang_modal.title': 'Sprache auswählen / Choose Language',
    'lang_modal.subtitle': 'Wählen Sie Ihre bevorzugte Sprache für die SOCDOF ERP Suite. Sie können diese jederzeit in den Spracheinstellungen ändern.',
    'lang_modal.skip_hint': 'Sie können überspringen und mit Englisch fortfahren.',
    'lang_modal.english_default_badge': 'Standard / Default',
    'lang_modal.current_selected': 'Aktuelle Auswahl',
    'lang_modal.auto_saved': 'Wird automatisch in der lokalen Datenbank gespeichert',
    'lang_modal.sample_hint': 'Schnellstart & Interaktive Demo in der oberen Leiste verfügbar',

    // Settings Sections
    'settings.title': 'SOCDOF Einstellungen',
    'settings.home': 'Startseite',
    'settings.general': 'Allgemein & Stammdaten',
    'settings.personalization': 'Personalisierung & Farben',
    'settings.language': 'Spracheinstellungen & Region',
    'settings.connections': 'Verbindungen & Google Kalender',
    'settings.letterhead': 'Briefkopf & DIN 5008',
    'settings.storage': 'Speicher & Backup',
    'settings.audio': 'Sound & Audio',
    'settings.windows': 'Windows Desktop-App',
    'settings.danger': 'System zurücksetzen',

    // Personalization & Appearance
    'settings.personalization_title': 'Personalisierung & Farbschema (Windows-Stil)',
    'settings.personalization_desc': 'Passen Sie das Erscheinungsbild, Akzentfarben und Fenstereffekte an.',
    'settings.theme_mode': 'Design-Modus auswählen',
    'settings.light_mode': 'Hellmodus (Light)',
    'settings.light_mode_desc': 'Klarer, kontrastreicher Hintergrund',
    'settings.dark_mode': 'Dunkelmodus (Dark)',
    'settings.dark_mode_desc': 'Augenschonender Windows-Dark Look',
    'settings.mica_title': 'Windows Mica / Acryl Glas-Overlay',
    'settings.mica_desc': 'Subtiler Weichzeichner und transparente Titelleisten für ein natives Desktop-Gefühl.',
    'settings.accent_system_title': 'System-Akzentfarbe & Color Picasso',
    'settings.accent_system_desc': 'Wird sofort systemweit auf Fensterleisten, Buttons, Badges und Taskleiste angewendet.',
    'settings.active_badge': 'Aktiv',
    'settings.picasso_title': 'Color Picasso Farbwähler',
    'settings.picasso_desc': 'Eigene Akzentfarbe nach Wunsch frei definieren & speichern',
    'settings.random_color': 'Zufall',
    'settings.taskbar_title': 'Farbe & Stil der unteren Leiste (Taskbar / Bottom Bar)',
    'settings.taskbar_desc': 'Wählen Sie, wie die Leiste am unteren Bildschirmrand gestaltet wird.',
    'settings.taskbar_default': 'Standard Windows 11',
    'settings.taskbar_default_desc': 'Neutrales Hell / Dunkel',
    'settings.taskbar_accent': 'Akzentfarbe getönt',
    'settings.taskbar_accent_desc': 'Übernimmt die gewählte Farbe',
    'settings.taskbar_glass': 'Acryl Glas',
    'settings.taskbar_glass_desc': 'Halbtransparent & Weichzeichner',
    'settings.taskbar_dark': 'Tiefschwarz (Dark)',
    'settings.taskbar_dark_desc': 'Klassisch dunkle Leiste',
    'settings.live_preview_title': 'Live-Vorschau der Farbübernahme:',
    'settings.live_preview_desc': 'Texte, Buttons, Rahmen & Badges',
    'settings.font_scale_title': 'Schriftgröße & Skalierung (Zoom)',
    'settings.font_scale_desc': 'Passen Sie die Gesamt-Schriftgröße des Systems stufenlos an (90% bis 130%).',
    'settings.font_scale_reset': '100% Reset',
    'settings.wallpaper_title': 'Desktop-Hintergrundbild (Wallpaper)',
    'settings.wallpaper_desc': 'Wählen Sie ein eigenes Hintergrundbild für Ihren Arbeitsbereich oder nutzen Sie den Standard-Verlauf.',
    'settings.wallpaper_upload': 'Bild hochladen',
    'settings.wallpaper_remove': 'Hintergrund entfernen',
    'settings.wallpaper_default': 'Standard',
    'settings.save_now': 'Einstellungen jetzt speichern',
    'settings.save_success': 'Einstellungen erfolgreich gespeichert!',

    // General & Master Data
    'settings.company_data_title': 'Firmendaten & Stammdaten',
    'settings.company_data_desc': 'Verwalten Sie Firmenname, Anschrift, Steuernummer und Kontaktdaten für Rechnungen.',
    'settings.company_name': 'Firmenname / Unternehmensbezeichnung',
    'settings.owner_name': 'Geschäftsführer / Inhaber',
    'settings.street': 'Straße & Hausnummer',
    'settings.city_zip': 'Stadt & Postleitzahl',
    'settings.country': 'Land',
    'settings.tax_id': 'Steuernummer / USt-IdNr.',
    'settings.bank_name': 'Bankinstitut',
    'settings.iban': 'IBAN',
    'settings.bic': 'BIC / Swift',
    'settings.email': 'E-Mail-Adresse',
    'settings.phone': 'Telefonnummer',
    'settings.website': 'Webseite',

    // Language & Region
    'settings.lang_region_title': 'Spracheinstellungen, Währung & Regionale Formate',
    'settings.lang_region_desc': 'Wählen Sie Ihre Anzeigesprache, Datumsformate und Währung.',
    'settings.display_language': 'Systemsprache',
    'settings.currency_symbol': 'Währungssymbol',
    'settings.date_format_label': 'Datumsformat',
    'settings.timezone_label': 'Zeitzone',

    // System Status Card
    'status.system_title': 'System-Status',
    'status.local_active': 'Lokal aktiv',
    'status.storage_label': 'Speicher:',
    'status.records_label': 'Datensätze',
    'status.version_label': 'Version:',
    'status.github_repo': 'GitHub Repository',
    'status.discord_help': 'Hilfe auf Discord',

    // Accent Colors & Color Picasso
    'accent.label': 'System-Akzentfarbe',
    'accent.applied': 'Akzentfarbe erfolgreich übernommen!',
    'accent.desc': 'Passt Buttons, Badges, Fenstertitelleisten und Taskleisten-Highlights an.',
    'accent.picasso_title': 'Color Picasso Farbwähler',
    'accent.picasso_desc': 'Eigene Akzentfarbe nach Wunsch frei definieren & speichern',
    'accent.random': 'Zufall',

    // Dashboard & Metrics
    'dash.revenue': 'Gesamter fakturierter Umsatz',
    'dash.open_invoices': 'Offene Rechnungen',
    'dash.paid_invoices': 'Bezahlte Rechnungen',
    'dash.inventory_value': 'Gesamter Lagerwert (Einkauf)',
    'dash.low_stock': 'Artikel mit knappem Bestand',
    'dash.quick_actions': 'Schnellaktionen',
    'dash.recent_invoices': 'Letzte Rechnungen',
    'dash.recent_moves': 'Letzte Lagerbewegungen',
    'dash.filter_all': 'Gesamter Zeitraum',
    'dash.filter_month': 'Diesen Monat',
    'dash.filter_today': 'Heute',

    // Statuses
    'status.draft': 'Entwurf',
    'status.posted': 'Gebucht',
    'status.paid': 'Bezahlt',
    'status.cancelled': 'Storniert',
    'status.ordered': 'Bestellt',
    'status.received': 'Erhalten',
    'status.preparing': 'In Zubereitung',
    'status.ready': 'Fertig',
    'status.served': 'Serviert',
    'status.overdue': 'Überfällig',

    // Windows Toast
    'toast.settings_saved': 'Einstellungen gespeichert',
    'toast.settings_saved_desc': 'Lokal in IndexedDB gesichert • Sofort aktiv'
  },

  fr: {
    // App & Header
    'app.name': 'SOCDOF',
    'app.tagline': "Strudel's Organization, Commerce & Documentation Offline Flow",
    'app.subtitle': 'Suite ERP Windows Desktop 100% Locale',
    'app.welcome': 'Bienvenue sur SOCDOF',
    'app.welcome_desc': 'Votre ERP local complet avec gestion de fenêtres, facturation DIN 5008, caisse tactile, CRM et comptabilité.',

    // Navigation & Windows
    'nav.start': 'Démarrer',
    'nav.search': 'Rechercher (Ctrl+K)...',
    'nav.search_placeholder': 'Rechercher des applications, contacts, factures...',
    'nav.all_apps': 'Tous les modules',
    'nav.pinned': 'Applications épinglées',
    'nav.recommended': 'Recommandé',
    'nav.windows_manager': 'Gestionnaire de bureau',
    'nav.sound_effects': 'Effets sonores',
    'nav.dark_mode': 'Mode sombre',
    'nav.light_mode': 'Mode clair',
    'nav.lock': 'Verrouiller le poste',
    'nav.logout': 'Déconnexion',
    'nav.power': 'Arrêter / Redémarrer',
    'nav.studio': 'Éditeur Studio',
    'nav.web_mode': 'Basculer vers Web classique',
    'nav.desktop_mode': 'Basculer vers Bureau Windows',
    'nav.switch_language': 'Paramètres de langue',
    'nav.quick_actions': 'Actions rapides',
    'nav.tutorial': 'Tutoriel & Visite',

    // Modules
    'module.launcher': 'Lanceur d’apps',
    'module.dashboard': 'Tableau de bord',
    'module.invoices': 'Factures',
    'module.accounting': 'Comptabilité',
    'module.contacts': 'Contacts',
    'module.products': 'Produits',
    'module.stock': 'Stocks',
    'module.purchases': 'Achats',
    'module.pos': 'Caisse POS',
    'module.restaurant': 'Restaurant',
    'module.support_services': 'Support',
    'module.ios_billing': 'Caisse Rapide',
    'module.appstore': 'App Store',
    'module.docs': 'Documentation',
    'module.settings': 'Paramètres',

    // Module Subtitles & Descriptions
    'desc.dashboard': 'Chiffre d’affaires en temps réel, factures ouvertes et indicateurs',
    'desc.invoices': 'Créer factures, avoirs et impressions PDF',
    'desc.accounting': 'Compte de résultat, déclaration TVA et balance',
    'desc.contacts': 'Gérer clients, fournisseurs et carnets d’adresses',
    'desc.products': 'Catalogue produits, codes-barres, prix et niveaux de stock',
    'desc.stock': 'Transferts, réceptions et inventaires de stock',
    'desc.purchases': 'Commandes fournisseurs et factures d’achat',
    'desc.pos': 'Caisse tactile avec lecteur code-barres et reçus',
    'desc.restaurant': 'Menu numérique, gestion des tables et écran cuisine',
    'desc.ios_billing': 'Prise de commande rapide et encaissement',
    'desc.appstore': 'Activer, épingler et configurer les modules',
    'desc.docs': 'Guide d’utilisation complet et processus',
    'desc.settings': 'Données d’entreprise, en-tête, couleurs et sauvegardes JSON',

    // Common Actions & Buttons
    'action.save': 'Enregistrer',
    'action.cancel': 'Annuler',
    'action.delete': 'Supprimer',
    'action.edit': 'Modifier',
    'action.create': 'Créer nouveau',
    'action.new_invoice': '+ Nouvelle facture',
    'action.new_contact': '+ Nouveau contact',
    'action.new_product': '+ Nouvel article',
    'action.new_purchase': '+ Nouvelle commande',
    'action.new_stock_move': '+ Nouveau transfert',
    'action.print': 'Imprimer / PDF',
    'action.export': 'Exporter',
    'action.import': 'Importer',
    'action.filter': 'Filtrer',
    'action.search': 'Rechercher',
    'action.refresh': 'Actualiser',
    'action.reset': 'Réinitialiser',
    'action.confirm': 'Confirmer',
    'action.close': 'Fermer',
    'action.minimize': 'Réduire',
    'action.maximize': 'Agrandir',
    'action.restore': 'Restaurer',
    'action.back': 'Retour',
    'action.next': 'Suivant',
    'action.finish': 'Terminer',
    'action.skip': 'Passer',
    'action.default_english': 'Par défaut: Anglais',
    'action.continue': 'Continuer',
    'action.select_language': 'Choisir la langue',
    'action.apply': 'Appliquer',
    'action.open': 'Ouvrir',
    'action.download': 'Télécharger',
    'action.upload': 'Téléverser',
    'action.switch': 'Basculer',
    'action.enable': 'Activer',
    'action.mute': 'Muet',

    // Language Modal Specific
    'lang_modal.title': 'Choisissez votre langue',
    'lang_modal.subtitle': 'Sélectionnez votre langue pour la suite SOCDOF. Vous pouvez la modifier à tout moment dans les paramètres de langue.',
    'lang_modal.skip_hint': 'Vous pouvez passer et continuer en anglais.',
    'lang_modal.english_default_badge': 'Standard / Défaut',
    'lang_modal.current_selected': 'Sélection actuelle',
    'lang_modal.auto_saved': 'Enregistré automatiquement dans la base locale',
    'lang_modal.sample_hint': 'Démo interactive disponible dans la barre supérieure',

    // Settings Sections
    'settings.title': 'Paramètres SOCDOF',
    'settings.home': 'Vue générale',
    'settings.general': 'Général & Entreprise',
    'settings.personalization': 'Personnalisation & Couleurs',
    'settings.language': 'Paramètres de langue & Région',
    'settings.connections': 'Connexions & Google Agenda',
    'settings.letterhead': 'En-tête de lettre & Format',
    'settings.storage': 'Stockage & Sauvegarde',
    'settings.audio': 'Sons & Audio',
    'settings.windows': 'Application Bureau Windows',
    'settings.danger': 'Réinitialisation du système',

    // Personalization & Appearance
    'settings.personalization_title': 'Personnalisation & Couleurs (Style Windows)',
    'settings.personalization_desc': 'Personnalisez l’apparence, les couleurs d’accentuation et les effets de fenêtre.',
    'settings.theme_mode': 'Sélectionner le thème',
    'settings.light_mode': 'Mode clair (Light)',
    'settings.light_mode_desc': 'Arrière-plan clair et contrasté',
    'settings.dark_mode': 'Mode sombre (Dark)',
    'settings.dark_mode_desc': 'Style sombre Windows agréable pour les yeux',
    'settings.mica_title': 'Windows Mica / Effet de verre acrylique',
    'settings.mica_desc': 'Flou subtil et barres de titre translucides pour un rendu natif.',
    'settings.accent_system_title': 'Couleur d’accentuation & Color Picasso',
    'settings.accent_system_desc': 'Appliqué immédiatement aux fenêtres, boutons, badges et barre des tâches.',
    'settings.active_badge': 'Actif',
    'settings.picasso_title': 'Sélecteur de palette Color Picasso',
    'settings.picasso_desc': 'Définissez et enregistrez librement une couleur d’accentuation personnalisée',
    'settings.random_color': 'Aléatoire',
    'settings.taskbar_title': 'Style & Teinte de la barre des tâches',
    'settings.taskbar_desc': 'Choisissez l’apparence de la barre au bas de l’écran.',
    'settings.taskbar_default': 'Standard Windows 11',
    'settings.taskbar_default_desc': 'Clair / Sombre neutre',
    'settings.taskbar_accent': 'Teinté avec accentuation',
    'settings.taskbar_accent_desc': 'Adopte la couleur choisie',
    'settings.taskbar_glass': 'Verre acrylique',
    'settings.taskbar_glass_desc': 'Semi-transparent et flouté',
    'settings.taskbar_dark': 'Noir profond (Dark)',
    'settings.taskbar_dark_desc': 'Barre sombre classique',
    'settings.live_preview_title': 'Aperçu en direct des couleurs :',
    'settings.live_preview_desc': 'Textes, boutons, bordures et badges',
    'settings.font_scale_title': 'Taille de police & Échelle (Zoom)',
    'settings.font_scale_desc': 'Ajustez la taille de police globale du système (90% à 130%).',
    'settings.font_scale_reset': 'Réinitialiser à 100%',
    'settings.wallpaper_title': 'Fond d’écran du bureau (Wallpaper)',
    'settings.wallpaper_desc': 'Choisissez une image de fond personnalisée ou conservez le dégradé standard.',
    'settings.wallpaper_upload': 'Téléverser image',
    'settings.wallpaper_remove': 'Supprimer fond',
    'settings.wallpaper_default': 'Standard',
    'settings.save_now': 'Enregistrer les paramètres',
    'settings.save_success': 'Paramètres enregistrés avec succès !',

    // General & Master Data
    'settings.company_data_title': 'Données d’entreprise & Coordonnées',
    'settings.company_data_desc': 'Gérez le nom, l’adresse, le numéro fiscal et les coordonnées pour les factures.',
    'settings.company_name': 'Nom de l’entreprise',
    'settings.owner_name': 'Gérant / Propriétaire',
    'settings.street': 'Rue & Numéro',
    'settings.city_zip': 'Ville & Code postal',
    'settings.country': 'Pays',
    'settings.tax_id': 'Numéro TVA / Fiscal',
    'settings.bank_name': 'Banque',
    'settings.iban': 'IBAN',
    'settings.bic': 'BIC / Swift',
    'settings.email': 'Adresse e-mail',
    'settings.phone': 'Téléphone',
    'settings.website': 'Site Web',

    // Language & Region
    'settings.lang_region_title': 'Paramètres linguistiques, Devise & Formats régionaux',
    'settings.lang_region_desc': 'Choisissez votre langue d’affichage, format de date et devise.',
    'settings.display_language': 'Langue du système',
    'settings.currency_symbol': 'Symbole monétaire',
    'settings.date_format_label': 'Format de date',
    'settings.timezone_label': 'Fuseau horaire',

    // System Status Card
    'status.system_title': 'État du système',
    'status.local_active': 'Actif localement',
    'status.storage_label': 'Stockage:',
    'status.records_label': 'enregistrements',
    'status.version_label': 'Version:',
    'status.github_repo': 'Dépôt GitHub',
    'status.discord_help': 'Aide sur Discord',

    // Accent Colors & Color Picasso
    'accent.label': 'Couleur d’accentuation',
    'accent.applied': 'Couleur d’accentuation appliquée avec succès !',
    'accent.desc': 'Modifie les couleurs des boutons, badges et bordures.',
    'accent.picasso_title': 'Sélecteur de palette Color Picasso',
    'accent.picasso_desc': 'Définissez librement votre propre couleur d’accentuation personnalisée',
    'accent.random': 'Aléatoire',

    // Dashboard & Metrics
    'dash.revenue': 'Chiffre d’affaires total facturé',
    'dash.open_invoices': 'Factures en attente',
    'dash.paid_invoices': 'Factures réglées',
    'dash.inventory_value': 'Valeur totale du stock',
    'dash.low_stock': 'Alertes stock faible',
    'dash.quick_actions': 'Actions rapides',
    'dash.recent_invoices': 'Factures récentes',
    'dash.recent_moves': 'Mouvements récents de stock',
    'dash.filter_all': 'Toute la période',
    'dash.filter_month': 'Ce mois-ci',
    'dash.filter_today': 'Aujourd’hui',

    // Statuses
    'status.draft': 'Brouillon',
    'status.posted': 'Comptabilisé',
    'status.paid': 'Payé',
    'status.cancelled': 'Annulé',
    'status.ordered': 'Commandé',
    'status.received': 'Reçu',
    'status.preparing': 'En préparation',
    'status.ready': 'Prêt',
    'status.served': 'Servi',
    'status.overdue': 'En retard',

    // Windows Toast
    'toast.settings_saved': 'Paramètres enregistrés',
    'toast.settings_saved_desc': 'Sauvegardé localement dans IndexedDB • Immédiatement actif'
  },

  es: {
    // App & Header
    'app.name': 'SOCDOF',
    'app.tagline': "Strudel's Organization, Commerce & Documentation Offline Flow",
    'app.subtitle': 'Suite ERP de Escritorio 100% Local',
    'app.welcome': 'Bienvenido a SOCDOF',
    'app.welcome_desc': 'Su suite ERP local completa con ventanas múltiples, facturación DIN 5008, TPV táctil, CRM y contabilidad.',

    // Navigation & Windows
    'nav.start': 'Inicio',
    'nav.search': 'Buscar (Ctrl+K)...',
    'nav.search_placeholder': 'Escriba para buscar apps, contactos, facturas...',
    'nav.all_apps': 'Todos los módulos',
    'nav.pinned': 'Apps fijadas',
    'nav.recommended': 'Recomendado',
    'nav.windows_manager': 'Gestor de escritorio',
    'nav.sound_effects': 'Efectos de sonido',
    'nav.dark_mode': 'Modo oscuro',
    'nav.light_mode': 'Modo claro',
    'nav.lock': 'Bloquear estación',
    'nav.logout': 'Cerrar sesión',
    'nav.power': 'Apagar / Reiniciar',
    'nav.studio': 'Editor Studio',
    'nav.web_mode': 'Cambiar a Web clásico',
    'nav.desktop_mode': 'Cambiar a Escritorio Windows',
    'nav.switch_language': 'Configuración de idioma',
    'nav.quick_actions': 'Acciones rápidas',
    'nav.tutorial': 'Tutorial y recorrido',

    // Modules
    'module.launcher': 'Lanzador',
    'module.dashboard': 'Panel de control',
    'module.invoices': 'Facturas',
    'module.accounting': 'Contabilidad',
    'module.contacts': 'Contactos',
    'module.products': 'Productos',
    'module.stock': 'Inventario',
    'module.purchases': 'Compras',
    'module.pos': 'TPV Kasse',
    'module.restaurant': 'Restaurante',
    'module.support_services': 'Soporte',
    'module.ios_billing': 'Caja Rápida',
    'module.appstore': 'App Store',
    'module.docs': 'Manual',
    'module.settings': 'Configuración',

    // Module Subtitles & Descriptions
    'desc.dashboard': 'Ingresos en tiempo real, facturas abiertas y métricas',
    'desc.invoices': 'Crear facturas, abonos e impresiones PDF',
    'desc.accounting': 'Pérdidas y ganancias, IVA y balance',
    'desc.contacts': 'Gestionar clientes, proveedores y libreta de direcciones',
    'desc.products': 'Catálogo de artículos, códigos de barras y existencias',
    'desc.stock': 'Transferencias, recepción de mercancías e inventario',
    'desc.purchases': 'Pedidos a proveedores y facturas de compra',
    'desc.pos': 'Caja táctil con escáner de códigos y tickets',
    'desc.restaurant': 'Menú digital, gestión de mesas y monitor de cocina',
    'desc.ios_billing': 'Pedidos rápidos y cobro táctil',
    'desc.appstore': 'Activar, anclar y configurar módulos del sistema',
    'desc.docs': 'Guía de usuario completa y flujos de trabajo',
    'desc.settings': 'Datos de empresa, membrete, colores y copias de seguridad',

    // Common Actions & Buttons
    'action.save': 'Guardar cambios',
    'action.cancel': 'Cancelar',
    'action.delete': 'Eliminar',
    'action.edit': 'Editar',
    'action.create': 'Crear nuevo',
    'action.new_invoice': '+ Nueva factura',
    'action.new_contact': '+ Nuevo contacto',
    'action.new_product': '+ Nuevo producto',
    'action.new_purchase': '+ Nuevo pedido',
    'action.new_stock_move': '+ Nueva transferencia',
    'action.print': 'Imprimir / PDF',
    'action.export': 'Exportar',
    'action.import': 'Importar',
    'action.filter': 'Filtrar',
    'action.search': 'Buscar',
    'action.refresh': 'Actualizar',
    'action.reset': 'Restablecer',
    'action.confirm': 'Confirmar',
    'action.close': 'Cerrar',
    'action.minimize': 'Minimizar',
    'action.maximize': 'Maximizar',
    'action.restore': 'Restaurar',
    'action.back': 'Atrás',
    'action.next': 'Siguiente',
    'action.finish': 'Finalizar',
    'action.skip': 'Omitir',
    'action.default_english': 'Predeterminado: Inglés',
    'action.continue': 'Continuar',
    'action.select_language': 'Seleccionar idioma',
    'action.apply': 'Aplicar',
    'action.open': 'Abrir',
    'action.download': 'Descargar',
    'action.upload': 'Subir',
    'action.switch': 'Cambiar',
    'action.enable': 'Activar',
    'action.mute': 'Silenciar',

    // Language Modal Specific
    'lang_modal.title': 'Selecciona tu idioma',
    'lang_modal.subtitle': 'Elige el idioma preferido para la suite SOCDOF. Puedes cambiarlo en cualquier momento en la configuración de idioma.',
    'lang_modal.skip_hint': 'Puedes omitir y continuar en inglés.',
    'lang_modal.english_default_badge': 'Estándar / Por defecto',
    'lang_modal.current_selected': 'Selección activa',
    'lang_modal.auto_saved': 'Guardado automáticamente en la base local',
    'lang_modal.sample_hint': 'Demostración interactiva disponible en la barra superior',

    // Settings Sections
    'settings.title': 'Configuración de SOCDOF',
    'settings.home': 'Vista general',
    'settings.general': 'General & Empresa',
    'settings.personalization': 'Personalización & Colores',
    'settings.language': 'Configuración de idioma y región',
    'settings.connections': 'Conexiones & Google Calendar',
    'settings.letterhead': 'Membrete & Formato',
    'settings.storage': 'Almacenamiento & Respaldo',
    'settings.audio': 'Sonido & Audio',
    'settings.windows': 'Aplicación Escritorio Windows',
    'settings.danger': 'Restablecer sistema',

    // Personalization & Appearance
    'settings.personalization_title': 'Personalización & Esquema de Color (Estilo Windows)',
    'settings.personalization_desc': 'Personalice la apariencia, colores de acento y efectos de ventana.',
    'settings.theme_mode': 'Seleccionar modo de tema',
    'settings.light_mode': 'Modo claro (Light)',
    'settings.light_mode_desc': 'Fondo claro y nítido de alto contraste',
    'settings.dark_mode': 'Modo oscuro (Dark)',
    'settings.dark_mode_desc': 'Aspecto oscuro Windows cómodo para la vista',
    'settings.mica_title': 'Windows Mica / Capa de Cristal Acrílico',
    'settings.mica_desc': 'Desenfoque sutil y barras de título translúcidas para sensación nativa.',
    'settings.accent_system_title': 'Color de Acento del Sistema & Color Picasso',
    'settings.accent_system_desc': 'Aplicado al instante a ventanas, botones, insignias y barra de tareas.',
    'settings.active_badge': 'Activo',
    'settings.picasso_title': 'Selector de Paleta Color Picasso',
    'settings.picasso_desc': 'Defina y guarde libremente cualquier color de acento HEX / RGB',
    'settings.random_color': 'Aleatorio',
    'settings.taskbar_title': 'Color y Estilo de la Barra de Tareas (Taskbar)',
    'settings.taskbar_desc': 'Elija la apariencia de la barra en la parte inferior de la pantalla.',
    'settings.taskbar_default': 'Estándar Windows 11',
    'settings.taskbar_default_desc': 'Estilo neutro claro / oscuro',
    'settings.taskbar_accent': 'Tintado con acento',
    'settings.taskbar_accent_desc': 'Adopta el color seleccionado',
    'settings.taskbar_glass': 'Cristal Acrílico',
    'settings.taskbar_glass_desc': 'Semitransparente y desenfocado',
    'settings.taskbar_dark': 'Oscuro Profundo (Dark)',
    'settings.taskbar_dark_desc': 'Barra oscura clásica',
    'settings.live_preview_title': 'Vista previa de adopción de color:',
    'settings.live_preview_desc': 'Textos, botones, bordes e insignias',
    'settings.font_scale_title': 'Tamaño de Fuente y Escalado (Zoom)',
    'settings.font_scale_desc': 'Ajuste el tamaño global de fuente del sistema (90% a 130%).',
    'settings.font_scale_reset': 'Restablecer 100%',
    'settings.wallpaper_title': 'Fondo de Pantalla del Escritorio (Wallpaper)',
    'settings.wallpaper_desc': 'Suba una imagen de fondo personalizada o use el degradado estándar.',
    'settings.wallpaper_upload': 'Subir imagen',
    'settings.wallpaper_remove': 'Quitar fondo',
    'settings.wallpaper_default': 'Estándar',
    'settings.save_now': 'Guardar configuración ahora',
    'settings.save_success': '¡Configuración guardada con éxito!',

    // General & Master Data
    'settings.company_data_title': 'Datos de la Empresa & Contacto',
    'settings.company_data_desc': 'Gestione el nombre comercial, dirección, NIF / CIF y datos de contacto para facturas.',
    'settings.company_name': 'Nombre de la empresa',
    'settings.owner_name': 'Director / Propietario',
    'settings.street': 'Calle y número',
    'settings.city_zip': 'Ciudad y código postal',
    'settings.country': 'País',
    'settings.tax_id': 'NIF / CIF / IVA',
    'settings.bank_name': 'Entidad bancaria',
    'settings.iban': 'IBAN',
    'settings.bic': 'BIC / Swift',
    'settings.email': 'Correo electrónico',
    'settings.phone': 'Teléfono',
    'settings.website': 'Sitio web',

    // Language & Region
    'settings.lang_region_title': 'Configuración de Idioma, Moneda y Formatos Regionales',
    'settings.lang_region_desc': 'Elija el idioma de la interfaz, formatos de fecha y moneda.',
    'settings.display_language': 'Idioma del sistema',
    'settings.currency_symbol': 'Símbolo de moneda',
    'settings.date_format_label': 'Formato de fecha',
    'settings.timezone_label': 'Zona horaria',

    // System Status Card
    'status.system_title': 'Estado del sistema',
    'status.local_active': 'Activo local',
    'status.storage_label': 'Almacenamiento:',
    'status.records_label': 'registros',
    'status.version_label': 'Versión:',
    'status.github_repo': 'Repositorio GitHub',
    'status.discord_help': 'Ayuda en Discord',

    // Accent Colors & Color Picasso
    'accent.label': 'Color de acento del sistema',
    'accent.applied': '¡Color de acento aplicado con éxito!',
    'accent.desc': 'Cambia los colores de botones, tarjetas, encabezados y barra de tareas.',
    'accent.picasso_title': 'Selector de paleta Color Picasso',
    'accent.picasso_desc': 'Personalice y elija libremente su propio color de acento',
    'accent.random': 'Aleatorio',

    // Dashboard & Metrics
    'dash.revenue': 'Facturación total facturada',
    'dash.open_invoices': 'Facturas pendientes',
    'dash.paid_invoices': 'Facturas pagadas',
    'dash.inventory_value': 'Valor total del almacén',
    'dash.low_stock': 'Alertas de stock bajo',
    'dash.quick_actions': 'Acciones rápidas',
    'dash.recent_invoices': 'Facturas recientes',
    'dash.recent_moves': 'Movimientos de inventario recientes',
    'dash.filter_all': 'Todo el período',
    'dash.filter_month': 'Este mes',
    'dash.filter_today': 'Hoy',

    // Statuses
    'status.draft': 'Borrador',
    'status.posted': 'Contabilizado',
    'status.paid': 'Pagado',
    'status.cancelled': 'Cancelado',
    'status.ordered': 'Pedido',
    'status.received': 'Recibido',
    'status.preparing': 'En preparación',
    'status.ready': 'Listo',
    'status.served': 'Servido',
    'status.overdue': 'Vencido',

    // Windows Toast
    'toast.settings_saved': 'Configuración guardada',
    'toast.settings_saved_desc': 'Guardado localmente en IndexedDB • Activo de inmediato'
  }
};

let currentLang: LanguageCode = 'en';
const listeners = new Set<(lang: LanguageCode) => void>();

export function subscribeLanguageChange(listener: (lang: LanguageCode) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLanguage(lang: LanguageCode) {
  currentLang = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('socdof_language', lang);
    } catch {}
  }
  listeners.forEach(cb => {
    try {
      cb(lang);
    } catch {}
  });
}

export function getLanguage(): LanguageCode {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('socdof_language');
    if (saved && (saved === 'en' || saved === 'de' || saved === 'fr' || saved === 'es')) {
      return saved as LanguageCode;
    }
  }
  return currentLang;
}

export function useLanguage(): LanguageCode {
  const [lang, setLang] = useState<LanguageCode>(getLanguage());

  useEffect(() => {
    const unsubscribe = subscribeLanguageChange((newLang) => {
      setLang(newLang);
    });
    return unsubscribe;
  }, []);

  return lang;
}

export function t(key: string, langOverride?: LanguageCode, fallback?: string): string {
  const active = langOverride || getLanguage();
  const dict = translations[active] || translations.en;
  if (dict && dict[key]) {
    return dict[key];
  }
  if (translations.en && translations.en[key]) {
    return translations.en[key];
  }
  return fallback || key;
}

export function formatSystemDate(dateInput: Date | string | number = new Date(), format: string = 'DD.MM.YYYY'): string {
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (!d || isNaN(d.getTime())) return String(dateInput);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());

    switch (format) {
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD.MM.YYYY':
      default:
        return `${day}.${month}.${year}`;
    }
  } catch {
    return String(dateInput);
  }
}

