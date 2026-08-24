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
    'module.dashboard': 'Dashboard & KPI',
    'module.invoices': 'Invoices & Sales',
    'module.accounting': 'Accounting & BWA',
    'module.contacts': 'CRM & Contacts',
    'module.products': 'Products & Master Data',
    'module.stock': 'Inventory & Stock Moves',
    'module.purchases': 'Purchases & Vendors',
    'module.pos': 'Point of Sale (POS)',
    'module.restaurant': 'Restaurant & Kitchen (KDS)',
    'module.ios_billing': 'Fast Touch POS',
    'module.appstore': 'App Store & Plugins',
    'module.docs': 'Manual & Documentation',
    'module.settings': 'Settings & Backup',

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
    'module.launcher': 'App Übersicht',
    'module.dashboard': 'Dashboard & Kennzahlen',
    'module.invoices': 'Verkauf & Rechnungen',
    'module.accounting': 'Abrechnung & BWA',
    'module.contacts': 'CRM & Kontakte',
    'module.products': 'Artikel & Stammdaten',
    'module.stock': 'Lagerverwaltung & Buchungen',
    'module.purchases': 'Einkauf & Lieferanten',
    'module.pos': 'Point of Sale (POS Kasse)',
    'module.restaurant': 'Restaurant & Küchen-Display',
    'module.ios_billing': 'Schnellkasse Touch',
    'module.appstore': 'Odoo App Store',
    'module.docs': 'Handbuch & Dokumentation',
    'module.settings': 'Einstellungen & Backup',

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
    'module.launcher': 'Lanceur d’applications',
    'module.dashboard': 'Tableau de bord & KPI',
    'module.invoices': 'Ventes & Factures',
    'module.accounting': 'Comptabilité & Bilan',
    'module.contacts': 'CRM & Contacts',
    'module.products': 'Articles & Catalogue',
    'module.stock': 'Gestion des stocks',
    'module.purchases': 'Achats & Fournisseurs',
    'module.pos': 'Point de Vente (Caisse)',
    'module.restaurant': 'Restaurant & Cuisine',
    'module.ios_billing': 'Caisse Tactile Rapide',
    'module.appstore': 'Magasin d’applications',
    'module.docs': 'Manuel & Documentation',
    'module.settings': 'Paramètres & Sauvegarde',

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
    'module.launcher': 'Lanzador de apps',
    'module.dashboard': 'Panel de control & KPI',
    'module.invoices': 'Ventas & Facturas',
    'module.accounting': 'Contabilidad & Informes',
    'module.contacts': 'CRM & Contactos',
    'module.products': 'Productos & Catálogo',
    'module.stock': 'Inventario & Almacén',
    'module.purchases': 'Compras & Proveedores',
    'module.pos': 'Terminal Punto de Venta (TPV)',
    'module.restaurant': 'Restaurante & Cocina',
    'module.ios_billing': 'Caja Rápida Táctil',
    'module.appstore': 'Tienda de aplicaciones',
    'module.docs': 'Manual & Documentación',
    'module.settings': 'Configuración & Copias',

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
