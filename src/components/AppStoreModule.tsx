import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Search, 
  Check, 
  Download, 
  Trash2, 
  Sparkles, 
  Boxes, 
  Receipt, 
  Users, 
  Layers, 
  CreditCard, 
  ShoppingCart, 
  Settings, 
  Calculator, 
  BookOpen, 
  Pin, 
  CheckCircle2, 
  Utensils,
  DollarSign,
  Play,
  Banknote,
  X,
  ShieldCheck,
  Headphones,
  Calendar,
  LayoutGrid,
  FolderPlus,
  PackagePlus,
  GraduationCap,
  Briefcase,
  FolderCheck
} from 'lucide-react';
import { ActiveModule, StoreApp, DesktopFolder } from '../types';
import { sounds } from '../lib/sound';
import { WidgetsIcon } from './WidgetsIcon';
import { useLanguage, t } from '../lib/i18n';

interface AppStoreModuleProps {
  installedModules: ActiveModule[];
  pinnedDesktopModules: ActiveModule[];
  pinnedTaskbarModules: ActiveModule[];
  onToggleInstallModule: (moduleId: ActiveModule) => void;
  onTogglePinDesktop: (moduleId: ActiveModule) => void;
  onTogglePinTaskbar: (moduleId: ActiveModule) => void;
  onLaunchModule: (moduleId: ActiveModule) => void;
  onInstallBundle?: (modules: ActiveModule[]) => void;
  onCreateFolderFromBundle?: (folderName: string, modules: ActiveModule[]) => void;
}

interface StoreBundle {
  id: string;
  titleKey: string;
  titleFallback: string;
  taglineKey: string;
  taglineFallback: string;
  descKey: string;
  descFallback: string;
  badgeKey: string;
  badgeFallback: string;
  folderKey: string;
  folderFallback: string;
  modules: ActiveModule[];
  gradient: string;
  accentBg: string;
  borderClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const AppStoreModule: React.FC<AppStoreModuleProps> = ({
  installedModules,
  pinnedDesktopModules,
  pinnedTaskbarModules: _pinnedTaskbarModules,
  onToggleInstallModule,
  onTogglePinDesktop,
  onTogglePinTaskbar: _onTogglePinTaskbar,
  onLaunchModule,
  onInstallBundle,
  onCreateFolderFromBundle
}) => {
  const currentLang = useLanguage();

  // Primary Tab Navigation: 'apps' or 'bundles'
  const [activeMainTab, setActiveMainTab] = useState<'apps' | 'bundles'>('apps');

  // Apps View State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'uninstalled' | 'financial' | 'desktop'>('all');
  const [showSystemApps, setShowSystemApps] = useState<boolean>(true);
  const [selectedAppDetail, setSelectedAppDetail] = useState<StoreApp | null>(null);

  // Bundle Feedback State (temporarily indicates folder creation)
  const [createdFolderBundleId, setCreatedFolderBundleId] = useState<string | null>(null);

  // Complete List of ERP Modules
  const allStoreApps: StoreApp[] = useMemo(() => [
    {
      id: 'dashboard',
      title: t('module.dashboard', currentLang, 'Übersicht & KPIs'),
      category: 'core',
      description: t('desc.dashboard', currentLang, 'Zentrale Schaltzentrale mit Umsatzdiagrammen, offenen Rechnungen, KPIs und Schnellaktionen.'),
      iconName: 'Boxes',
      author: 'SOCDOF Core',
      version: '22.2.0',
      isInstalled: installedModules.includes('dashboard'),
      isFinancial: false,
      isSystem: true,
      tags: ['Dashboard', 'KPI', 'Analytics', 'System']
    },
    {
      id: 'invoices',
      title: t('module.invoices', currentLang, 'Rechnungen & DIN 5008'),
      category: 'finance',
      description: t('desc.invoices', currentLang, 'Gesetzeskonforme Fakturierung mit Briefkopf-Wasserzeichen, GoBD-Nummernkreis & PDF-Export.'),
      iconName: 'Receipt',
      badge: 'Finanziell aktiv',
      author: 'SOCDOF Finance',
      version: '22.2.0',
      isInstalled: installedModules.includes('invoices'),
      isFinancial: true,
      isSystem: false,
      tags: ['Rechnungen', 'Faktura', 'Finanzen', 'DIN 5008', 'PDF']
    },
    {
      id: 'accounting',
      title: t('module.accounting', currentLang, 'Abrechnungen & BWA'),
      category: 'finance',
      description: t('desc.accounting', currentLang, 'Betriebswirtschaftliche Auswertung, Einnahmen-Überschuss-Rechnung (EÜR), UStVA Voranmeldung & Mahnwesen.'),
      iconName: 'Calculator',
      badge: 'Finanziell aktiv',
      author: 'SOCDOF Finance',
      version: '22.2.0',
      isInstalled: installedModules.includes('accounting'),
      isFinancial: true,
      isSystem: false,
      tags: ['Buchhaltung', 'BWA', 'EÜR', 'USt', 'Finanzen']
    },
    {
      id: 'contacts',
      title: t('module.contacts', currentLang, 'Kontakte & CRM'),
      category: 'sales',
      description: t('desc.contacts', currentLang, 'Kunden- & Lieferantenstamm mit Batch-Erstellung, vCard/CSV-Import und Kontakt-Historie.'),
      iconName: 'Users',
      author: 'SOCDOF Sales',
      version: '22.2.0',
      isInstalled: installedModules.includes('contacts'),
      isFinancial: false,
      isSystem: false,
      tags: ['Kunden', 'Lieferanten', 'CRM', 'Adressbuch']
    },
    {
      id: 'pos',
      title: t('module.pos', currentLang, 'POS Touch-Kasse & Scanner'),
      category: 'sales',
      description: t('desc.pos', currentLang, 'Touchscreen-Kassensystem mit Barcode-Scanner-Anbindung, Wechselgeldrechner & Thermobon-Druck.'),
      iconName: 'CreditCard',
      badge: 'Finanziell aktiv',
      author: 'SOCDOF Retail',
      version: '22.2.0',
      isInstalled: installedModules.includes('pos'),
      isFinancial: true,
      isSystem: false,
      tags: ['POS', 'Kasse', 'Barcode', 'Einzelhandel', 'Finanzen']
    },
    {
      id: 'products',
      title: t('module.products', currentLang, 'Artikel & Preise'),
      category: 'inventory',
      description: t('desc.products', currentLang, 'Produktkatalog mit Preisen, Barcodes, Mindestbeständen und mehrstufiger Kategorisierung.'),
      iconName: 'Package',
      author: 'SOCDOF Inventory',
      version: '22.2.0',
      isInstalled: installedModules.includes('products'),
      isFinancial: false,
      isSystem: false,
      tags: ['Artikel', 'Produkte', 'Preise', 'Katalog']
    },
    {
      id: 'stock',
      title: t('module.stock', currentLang, 'Lager & Bestände'),
      category: 'inventory',
      description: t('desc.stock', currentLang, 'Doppelte Buchführung für Lagerbestände, Inventurverluste und Wareneingänge.'),
      iconName: 'Layers',
      author: 'SOCDOF Inventory',
      version: '22.2.0',
      isInstalled: installedModules.includes('stock'),
      isFinancial: false,
      isSystem: false,
      tags: ['Lager', 'Bestände', 'Inventur', 'Logistik']
    },
    {
      id: 'purchases',
      title: t('module.purchases', currentLang, 'Einkauf & Lieferanten'),
      category: 'inventory',
      description: t('desc.purchases', currentLang, 'Angebotsanfragen (RFQ), Lieferantenbestellungen und Wareneingangs-Verbuchung.'),
      iconName: 'ShoppingCart',
      badge: 'Finanziell aktiv',
      author: 'SOCDOF Logistics',
      version: '22.2.0',
      isInstalled: installedModules.includes('purchases'),
      isFinancial: true,
      isSystem: false,
      tags: ['Einkauf', 'Bestellungen', 'Lieferanten', 'Finanzen']
    },
    {
      id: 'support_services',
      title: t('module.support_services', currentLang, 'Support & Dienstleistungen'),
      category: 'productivity',
      description: t('desc.support_services', currentLang, 'Erfassung, Zeiterfassung und Dokumentation von Kunden-Support-Einsätzen, Servicezeiten und Tag-Verwaltung.'),
      iconName: 'Headphones',
      badge: 'Dienstleistungen',
      author: 'SOCDOF Productivity',
      version: '22.2.0',
      isInstalled: installedModules.includes('support_services'),
      isFinancial: true,
      isSystem: false,
      tags: ['Support', 'Service', 'Kunden', 'Zeiterfassung', 'Tickets']
    },
    {
      id: 'calendar',
      title: t('module.calendar', currentLang, 'Google Kalender & Termine'),
      category: 'productivity',
      description: t('desc.calendar', currentLang, 'Zwei-Wege Live-Synchronisierung mit Google Kalender, Fälligkeiten von Rechnungen und flexibler Monats-, Wochen- & Tagesansicht.'),
      iconName: 'Calendar',
      badge: 'Live-Sync & Termine',
      author: 'Yuri / Strudel',
      version: '22.2.0',
      isInstalled: installedModules.includes('calendar'),
      isFinancial: false,
      isSystem: false,
      tags: ['Kalender', 'Google', 'Sync', 'Termine', 'Stundenplan', 'Fälligkeiten']
    },
    {
      id: 'therapy_practice',
      title: t('module.therapy_practice', currentLang, 'Praxis & Therapie'),
      category: 'productivity',
      description: t('desc.therapy_practice', currentLang, 'Klienten, Sitzungen, Termine, Fahrtenbuch & Abrechnung.'),
      iconName: 'Briefcase',
      author: 'SOCDOF Practice',
      version: '23.2.0',
      isInstalled: installedModules.includes('therapy_practice'),
      isFinancial: true,
      isSystem: false,
      tags: ['Therapie', 'Praxis', 'Klienten', 'Sitzungen', 'Fahrtenbuch', 'Abrechnung']
    },
    {
      id: 'calculator',
      title: t('module.calculator', currentLang, 'Taschenrechner (Schule & Wissenschaft)'),
      category: 'productivity',
      description: t('desc.calculator', currentLang, 'Einfacher und wissenschaftlicher Taschenrechner mit Trigonometrie, Logarithmen, Rechenverlauf und Tastaturunterstützung.'),
      iconName: 'Calculator',
      badge: 'Schule & Studium',
      author: 'Yuri / Strudel',
      version: '22.5.0',
      isInstalled: installedModules.includes('calculator'),
      isFinancial: false,
      isSystem: true,
      tags: ['Taschenrechner', 'Rechner', 'Schule', 'Mathematik', 'Wissenschaftlich', 'Calculator']
    },
    {
      id: 'widgets',
      title: t('module.widgets', currentLang, 'Widgets & Notizen'),
      category: 'productivity',
      description: t('desc.widgets', currentLang, 'Desktop-Widgets (Tagesumsatz, Termine, Uhr) und frei verschiebbare Haftnotizen für den Arbeitsbereich.'),
      iconName: 'LayoutGrid',
      badge: 'Desktop-Widgets',
      author: 'Yuri / Strudel',
      version: '22.2.0',
      isInstalled: installedModules.includes('widgets'),
      isFinancial: false,
      isSystem: false,
      tags: ['Widgets', 'Notizen', 'Haftnotizen', 'Sticky Notes', 'Desktop']
    },
    {
      id: 'ios_billing',
      title: t('module.ios_billing', currentLang, 'iOS Gastro & Speisen-Kasse'),
      category: 'gastro',
      description: t('desc.ios_billing', currentLang, 'Cupertino 1-Screen Gastro-Kasse mit Speisekarte, Beilagen-Optionen (Kartoffelsalat etc.), Schnellbon & Umsatz-Journal.'),
      iconName: 'Utensils',
      badge: 'Gastro-Modul',
      author: 'SOCDOF Hospitality',
      version: '22.2.0',
      isInstalled: installedModules.includes('ios_billing'),
      isFinancial: true,
      isSystem: false,
      tags: ['Gastro', 'Speisekarte', 'Kasse', 'Beilagen', 'Finanzen']
    },
    {
      id: 'restaurant',
      title: t('module.restaurant', currentLang, 'Restaurant, Tische & KDS'),
      category: 'gastro',
      description: t('desc.restaurant', currentLang, 'Gastronomie-Modul mit digitaler Speisekarte, Tischverwaltung, KDS Küchen-Display und TSE Belegen.'),
      iconName: 'Utensils',
      badge: 'Gastro-Modul',
      author: 'SOCDOF Hospitality',
      version: '22.2.0',
      isInstalled: installedModules.includes('restaurant'),
      isFinancial: true,
      isSystem: false,
      tags: ['Restaurant', 'Tische', 'Speisekarte', 'Küche', 'KDS', 'Gastro']
    },
    {
      id: 'docs',
      title: t('module.docs', currentLang, 'Handbuch & Dokumentation'),
      category: 'productivity',
      description: t('desc.docs', currentLang, 'Vollständige interaktive Dokumentation mit Suchfunktion und Tastaturkürzeln.'),
      iconName: 'BookOpen',
      badge: 'System-Basis',
      author: 'SOCDOF Docs',
      version: '22.2.0',
      isInstalled: installedModules.includes('docs'),
      isFinancial: false,
      isSystem: true,
      tags: ['Handbuch', 'Hilfe', 'Lernunterlagen', 'Dokumentation']
    },
    {
      id: 'settings',
      title: t('module.settings', currentLang, 'Einstellungen & System'),
      category: 'core',
      description: t('desc.settings', currentLang, 'Briefkopf-Wasserzeichen, Firmendaten, Backups, Sounds, TSE & Speicherplatz-Monitor.'),
      iconName: 'Settings',
      badge: 'System-Basis',
      author: 'SOCDOF System',
      version: '22.2.0',
      isInstalled: installedModules.includes('settings'),
      isFinancial: false,
      isSystem: true,
      tags: ['Einstellungen', 'Briefkopf', 'Backup', 'System', 'TSE']
    }
  ], [currentLang, installedModules]);

  // Curated Application Bundles
  const storeBundles: StoreBundle[] = useMemo(() => [
    {
      id: 'school_bundle',
      titleKey: 'appstore.bundle_school_title',
      titleFallback: 'Schule & Bildung',
      taglineKey: 'appstore.bundle_school_tagline',
      taglineFallback: 'Stundenplan, Notizen, Wissensbasis & Termine',
      descKey: 'appstore.bundle_school_desc',
      descFallback: 'Das Rundum-Paket für Schule und Studium: Behalte deine Termine und Stundenpläne im Blick, erstelle Haftnotizen und verwalte Lernunterlagen komplett offline.',
      badgeKey: 'appstore.bundle_school_badge',
      badgeFallback: 'Bildung & Schule',
      folderKey: 'appstore.bundle_school_folder',
      folderFallback: 'Schule & Bildung',
      modules: ['calculator', 'calendar', 'widgets', 'docs', 'contacts'],
      icon: GraduationCap,
      gradient: 'from-blue-600 via-indigo-600 to-violet-700',
      accentBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      borderClass: 'border-blue-500/20'
    },
    {
      id: 'business_bundle',
      titleKey: 'appstore.bundle_business_title',
      titleFallback: 'Handel & ERP Starter',
      taglineKey: 'appstore.bundle_business_tagline',
      taglineFallback: 'Rechnungen, Buchhaltung, CRM & Produktkatalog',
      descKey: 'appstore.bundle_business_desc',
      descFallback: 'Das essentielle Starterpaket für Selbstständige, KMU und Händler: DIN 5008 Rechnungen, Einnahmen-Überschuss-Rechnung, Kundenstamm und Inventar.',
      badgeKey: 'appstore.bundle_business_badge',
      badgeFallback: 'Handel & KMU',
      folderKey: 'appstore.bundle_business_folder',
      folderFallback: 'Handel & ERP',
      modules: ['invoices', 'accounting', 'contacts', 'products', 'purchases'],
      icon: Briefcase,
      gradient: 'from-indigo-600 via-purple-600 to-pink-600',
      accentBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      borderClass: 'border-indigo-500/20'
    },
    {
      id: 'gastro_bundle',
      titleKey: 'appstore.bundle_gastro_title',
      titleFallback: 'Gastronomie & Kassensystem',
      taglineKey: 'appstore.bundle_gastro_tagline',
      taglineFallback: 'Touch-Kasse, Speisekarte, Restaurant-Tische & KDS',
      descKey: 'appstore.bundle_gastro_desc',
      descFallback: 'Vollständige Kassen- und Restaurantlösung mit Speisekarte, Barcode-Unterstützung, Küchen-Display, Tischreservierungen und TSE-Belegen.',
      badgeKey: 'appstore.bundle_gastro_badge',
      badgeFallback: 'Gastronomie & POS',
      folderKey: 'appstore.bundle_gastro_folder',
      folderFallback: 'Gastronomie & Kasse',
      modules: ['restaurant', 'ios_billing', 'pos', 'stock'],
      icon: Utensils,
      gradient: 'from-amber-600 via-orange-600 to-rose-600',
      accentBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      borderClass: 'border-amber-500/20'
    },
    {
      id: 'office_bundle',
      titleKey: 'appstore.bundle_office_title',
      titleFallback: 'Office & Organisation',
      taglineKey: 'appstore.bundle_office_tagline',
      taglineFallback: 'Kalender, Haftnotizen, Support & Dokumentation',
      descKey: 'appstore.bundle_office_desc',
      descFallback: 'Fokussiert arbeiten ohne Ablenkung: Termine planen, Google Kalender 2-Wege-Sync, Notizzettel auf dem Desktop und Dokumentationszugriff.',
      badgeKey: 'appstore.bundle_office_badge',
      badgeFallback: 'Produktivität',
      folderKey: 'appstore.bundle_office_folder',
      folderFallback: 'Office & Organisation',
      modules: ['calendar', 'widgets', 'support_services', 'docs'],
      icon: LayoutGrid,
      gradient: 'from-teal-600 via-cyan-600 to-blue-600',
      accentBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      borderClass: 'border-teal-500/20'
    }
  ], []);

  const getAppIcon = (id: ActiveModule) => {
    switch (id) {
      case 'dashboard': return Boxes;
      case 'invoices': return Receipt;
      case 'ios_billing':
      case 'restaurant': return Utensils;
      case 'accounting': 
      case 'calculator': return Calculator;
      case 'therapy_practice': return Briefcase;
      case 'contacts': return Users;
      case 'support_services': return Headphones;
      case 'pos': return CreditCard;
      case 'products': return Package;
      case 'stock': return Layers;
      case 'purchases': return ShoppingCart;
      case 'calendar': return Calendar;
      case 'widgets': return WidgetsIcon;
      case 'docs': return BookOpen;
      case 'settings': return Settings;
      default: return Package;
    }
  };

  const getAppColor = (id: ActiveModule) => {
    switch (id) {
      case 'dashboard': return 'bg-gradient-to-br from-purple-500 to-indigo-600';
      case 'invoices': return 'bg-gradient-to-br from-indigo-500 to-blue-600';
      case 'ios_billing': return 'bg-gradient-to-br from-indigo-600 to-purple-600';
      case 'restaurant': return 'bg-gradient-to-br from-amber-500 to-orange-600';
      case 'accounting': return 'bg-gradient-to-br from-emerald-500 to-teal-600';
      case 'therapy_practice': return 'bg-gradient-to-br from-slate-600 to-indigo-700';
      case 'calculator': return 'bg-gradient-to-br from-emerald-500 to-teal-700';
      case 'contacts': return 'bg-gradient-to-br from-teal-500 to-cyan-600';
      case 'support_services': return 'bg-gradient-to-br from-cyan-500 to-blue-600';
      case 'pos': return 'bg-gradient-to-br from-violet-500 to-indigo-600';
      case 'products': return 'bg-gradient-to-br from-blue-500 to-indigo-600';
      case 'stock': return 'bg-gradient-to-br from-amber-500 to-yellow-600';
      case 'purchases': return 'bg-gradient-to-br from-orange-500 to-amber-600';
      case 'calendar': return 'bg-gradient-to-br from-blue-500 to-sky-600';
      case 'widgets': return 'bg-gradient-to-br from-violet-500 to-purple-600';
      case 'docs': return 'bg-gradient-to-br from-sky-500 to-blue-600';
      case 'settings': return 'bg-gradient-to-br from-slate-600 to-slate-800';
      default: return 'bg-gradient-to-br from-slate-700 to-slate-900';
    }
  };

  // Filtered Apps for the 'apps' tab
  const filteredApps = useMemo(() => {
    return allStoreApps.filter(app => {
      if (!showSystemApps && app.isSystem) return false;

      const matchesCat = selectedCategory === 'all' || app.category === selectedCategory;

      let matchesStatus = true;
      if (statusFilter === 'installed') {
        matchesStatus = app.isInstalled;
      } else if (statusFilter === 'uninstalled') {
        matchesStatus = !app.isInstalled;
      } else if (statusFilter === 'financial') {
        matchesStatus = Boolean(app.isFinancial && app.isInstalled);
      } else if (statusFilter === 'desktop') {
        matchesStatus = pinnedDesktopModules.includes(app.id);
      }

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        app.title.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        app.category.toLowerCase().includes(query) ||
        (app.tags && app.tags.some(tg => tg.toLowerCase().includes(query)));

      return matchesCat && matchesStatus && matchesSearch;
    });
  }, [allStoreApps, showSystemApps, selectedCategory, statusFilter, searchQuery, pinnedDesktopModules]);

  // Statistics
  const totalAppsCount = allStoreApps.length;
  const installedCount = allStoreApps.filter(a => a.isInstalled).length;
  const uninstalledCount = totalAppsCount - installedCount;
  const financialActiveCount = allStoreApps.filter(a => a.isFinancial && a.isInstalled).length;
  const desktopPinnedCount = pinnedDesktopModules.length;

  // Handler to install all uninstalled apps of a bundle
  const handleInstallBundleClick = (bundle: StoreBundle) => {
    sounds.playSuccess();
    if (onInstallBundle) {
      onInstallBundle(bundle.modules);
    } else {
      const toInstall = bundle.modules.filter(m => !installedModules.includes(m));
      toInstall.forEach(m => onToggleInstallModule(m));
    }
  };

  // Handler to create a Desktop Folder containing this bundle's apps
  const handleCreateDesktopFolderClick = (bundle: StoreBundle) => {
    sounds.playSuccess();
    const folderName = t(bundle.folderKey, currentLang, bundle.folderFallback);
    if (onCreateFolderFromBundle) {
      onCreateFolderFromBundle(folderName, bundle.modules);
    } else {
      // Fallback: install and store in localStorage
      const toInstall = bundle.modules.filter(m => !installedModules.includes(m));
      toInstall.forEach(m => onToggleInstallModule(m));
      try {
        const saved = localStorage.getItem('socdof_desktop_folders');
        const folders: DesktopFolder[] = saved ? JSON.parse(saved) : [];
        const newFolder: DesktopFolder = {
          id: `bundle_folder_${Date.now()}`,
          name: folderName,
          modules: [...bundle.modules],
          createdAt: new Date().toISOString()
        };
        folders.push(newFolder);
        localStorage.setItem('socdof_desktop_folders', JSON.stringify(folders));
      } catch {}
    }

    setCreatedFolderBundleId(bundle.id);
    setTimeout(() => {
      setCreatedFolderBundleId(null);
    }, 3000);
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Top Hero Banner with Modern Gradient */}
      <div className="p-6 sm:p-7 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden border border-indigo-900/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>{activeMainTab === 'apps' ? t('appstore.hero_title', currentLang, 'App Store') : t('appstore.bundles_hero_title', currentLang, 'App-Pakete')}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              {activeMainTab === 'apps'
                ? t('appstore.hero_desc', currentLang, 'Entdecken, aktivieren und verwalten Sie alle Anwendungen für Ihren Arbeitsplatz.')
                : t('appstore.bundles_hero_desc', currentLang, 'Installieren Sie abgestimmte Programmpakete für Schule, Handel, Gastronomie und Büro mit einem Klick.')}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[85px] backdrop-blur-md">
              <span className="text-[11px] text-slate-300 block font-medium">Apps</span>
              <span className="text-xl font-black text-white">{totalAppsCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 text-center min-w-[85px] backdrop-blur-md">
              <span className="text-[11px] text-emerald-300 block font-medium">{t('appstore.filter_installed', currentLang, 'Aktiv')}</span>
              <span className="text-xl font-black text-emerald-400">{installedCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 text-center min-w-[85px] backdrop-blur-md">
              <span className="text-[11px] text-indigo-300 block font-medium">{t('appstore.tab_bundles_short', currentLang, 'Pakete')}</span>
              <span className="text-xl font-black text-indigo-400">{storeBundles.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Switcher: Apps vs. Bundles */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
          {/* Tab 1: Apps */}
          <button
            type="button"
            onClick={() => { sounds.playClick(); setActiveMainTab('apps'); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'apps'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{t('appstore.tab_apps', currentLang, 'Alle Apps')}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {totalAppsCount}
            </span>
          </button>

          {/* Tab 2: Bundles */}
          <button
            type="button"
            onClick={() => { sounds.playClick(); setActiveMainTab('bundles'); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
              activeMainTab === 'bundles'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PackagePlus className="w-4 h-4 text-indigo-500" />
            <span>{t('appstore.tab_bundles', currentLang, 'App-Pakete')}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold">
              {storeBundles.length}
            </span>
          </button>
        </div>

        {/* Quick Search on top right */}
        {activeMainTab === 'apps' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('appstore.search_placeholder', currentLang, 'Apps, Schlagwörter, Kategorien suchen...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: BUNDLES & PAKETE                                                  */}
      {/* ========================================================================= */}
      {activeMainTab === 'bundles' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {storeBundles.map(bundle => {
              const BundleIcon = bundle.icon;
              const installedCountInBundle = bundle.modules.filter(m => installedModules.includes(m)).length;
              const totalInBundle = bundle.modules.length;
              const isFullyInstalled = installedCountInBundle === totalInBundle;
              const isFolderCreated = createdFolderBundleId === bundle.id;

              return (
                <div
                  key={bundle.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Bundle Header Bar */}
                    <div className={`p-6 bg-gradient-to-r ${bundle.gradient} text-white relative`}>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-white/20 backdrop-blur-md text-white border border-white/30">
                          {t(bundle.badgeKey, currentLang, bundle.badgeFallback)}
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 text-white text-xs font-semibold backdrop-blur-md">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{installedCountInBundle} / {totalInBundle} {t('appstore.bundle_progress', currentLang, 'installiert')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner shrink-0">
                          <BundleIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white tracking-tight">
                            {t(bundle.titleKey, currentLang, bundle.titleFallback)}
                          </h3>
                          <p className="text-xs text-white/80 font-medium">
                            {t(bundle.taglineKey, currentLang, bundle.taglineFallback)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bundle Body */}
                    <div className="p-6 space-y-5">
                      {/* Description */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {t(bundle.descKey, currentLang, bundle.descFallback)}
                      </p>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>Installationsstatus</span>
                          <span>{Math.round((installedCountInBundle / totalInBundle) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${bundle.gradient}`}
                            style={{ width: `${(installedCountInBundle / totalInBundle) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Included Apps Grid */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Enthaltene Apps ({totalInBundle})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {bundle.modules.map((modId, modIdx) => {
                            const modApp = allStoreApps.find(a => a.id === modId);
                            const isModInstalled = installedModules.includes(modId);
                            const ModIcon = getAppIcon(modId);
                            const modColor = getAppColor(modId);
                            const isOddLast = bundle.modules.length % 2 !== 0 && modIdx === bundle.modules.length - 1;

                            return (
                              <div
                                key={modId}
                                onClick={() => modApp && setSelectedAppDetail(modApp)}
                                className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                                  isOddLast ? 'sm:col-span-2 ' : ''
                                }${
                                  isModInstalled
                                    ? 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                                    : 'bg-white dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-8 h-8 rounded-xl ${modColor} text-white flex items-center justify-center shrink-0 shadow-xs`}>
                                    <ModIcon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                                      {modApp?.title || modId}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block truncate">
                                      {isModInstalled ? t('appstore.filter_installed', currentLang, 'Aktiv') : t('appstore.filter_available', currentLang, 'Verfügbar')}
                                    </span>
                                  </div>
                                </div>

                                {isModInstalled ? (
                                  <span className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <Check className="w-3 h-3" />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleInstallModule(modId);
                                    }}
                                    className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 shrink-0"
                                    title="Einzeln installieren"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bundle Actions Footer: Clean, unified single-line row */}
                  <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                    {isFullyInstalled ? (
                      <div className="flex-1 h-10 px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="truncate">{t('appstore.bundle_installed', currentLang, 'Alle Apps installiert')}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInstallBundleClick(bundle)}
                        className={`flex-1 h-10 px-3.5 rounded-xl text-xs font-bold text-white shadow-xs transition active:scale-[0.98] flex items-center justify-center gap-2 bg-gradient-to-r ${bundle.gradient} hover:opacity-90 cursor-pointer`}
                      >
                        <Download className="w-4 h-4 shrink-0" />
                        <span className="truncate">{t('appstore.bundle_install_all', currentLang, 'Paket installieren')}</span>
                      </button>
                    )}

                    {/* Desktop Folder Button */}
                    <button
                      type="button"
                      onClick={() => handleCreateDesktopFolderClick(bundle)}
                      className={`h-10 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shrink-0 border shadow-xs ${
                        isFolderCreated
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                      title={t('appstore.bundle_create_folder', currentLang, 'Desktop-Ordner')}
                    >
                      {isFolderCreated ? (
                        <>
                          <FolderCheck className="w-4 h-4 text-white shrink-0" />
                          <span>{t('appstore.bundle_folder_created', currentLang, 'Ordner angelegt')}</span>
                        </>
                      ) : (
                        <>
                          <FolderPlus className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span>{t('appstore.bundle_create_folder', currentLang, 'Desktop-Ordner')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: APPS & MODULES LIST                                               */}
      {/* ========================================================================= */}
      {activeMainTab === 'apps' && (
        <div className="space-y-6">
          {/* Filter Bar: Status Filters & Category Chips */}
          <div className="space-y-3">
            {/* Status Segmented Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-semibold overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => { sounds.playClick(); setStatusFilter('all'); }}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <span>{t('appstore.filter_all', currentLang, 'Alle Module')}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300">
                  {totalAppsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { sounds.playClick(); setStatusFilter('installed'); }}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'installed'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('appstore.filter_installed', currentLang, 'Aktiviert')}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === 'installed' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {installedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { sounds.playClick(); setStatusFilter('uninstalled'); }}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'uninstalled'
                    ? 'bg-slate-700 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <span>{t('appstore.filter_available', currentLang, 'Verfügbar')}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300">
                  {uninstalledCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { sounds.playClick(); setStatusFilter('financial'); }}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'financial'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-amber-300" />
                <span>{t('appstore.filter_financial', currentLang, 'Finanziell aktiv')}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  {financialActiveCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { sounds.playClick(); setStatusFilter('desktop'); }}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                  statusFilter === 'desktop'
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{t('appstore.filter_desktop', currentLang, 'Auf Desktop')}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {desktopPinnedCount}
                </span>
              </button>
            </div>

            {/* Category Chips Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {[
                { id: 'all', label: t('appstore.filter_all', currentLang, 'Alle Kategorien') },
                { id: 'finance', label: 'Finanzen & Rechnungen', icon: Calculator },
                { id: 'sales', label: 'Verkauf & CRM', icon: Users },
                { id: 'inventory', label: 'Lager & Einkauf', icon: Layers },
                { id: 'gastro', label: 'Gastronomie', icon: Utensils },
                { id: 'productivity', label: 'Produktivität & Schule', icon: BookOpen },
                { id: 'core', label: 'System & Verwaltung', icon: Settings }
              ].map(tab => {
                const Icon = tab.icon;
                const isSelected = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { sounds.playClick(); setSelectedCategory(tab.id); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-indigo-600 text-white shadow-xs font-bold' 
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Apps Grid */}
          {filteredApps.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 mx-auto flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('appstore.no_apps_found', currentLang, 'Keine Module für diese Filterung gefunden')}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Versuchen Sie andere Suchbegriffe oder setzen Sie den Status- und Kategoriefilter zurück.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setStatusFilter('all');
                  setShowSystemApps(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-500 transition"
              >
                {t('appstore.reset_filters', currentLang, 'Alle Filter zurücksetzen')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApps.map((app) => {
                const Icon = getAppIcon(app.id);
                const colorClass = getAppColor(app.id);
                const isInstalled = app.isInstalled;
                const isPinnedDesktop = pinnedDesktopModules.includes(app.id);

                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedAppDetail(app)}
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between cursor-pointer group ${
                      isInstalled 
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700' 
                        : 'bg-slate-50/60 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-800 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div>
                      {/* Card Header: Icon, Title, Status Badges, Pin Desktop */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl ${colorClass} text-white flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5">
                              <span>{app.title}</span>
                              {app.isFinancial && isInstalled && (
                                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 flex items-center gap-0.5 border border-amber-300/40">
                                  <DollarSign className="w-2.5 h-2.5" />
                                  <span>{t('appstore.filter_financial', currentLang, 'Finanziell')}</span>
                                </span>
                              )}
                            </h4>
                            <p className="text-[11px] text-slate-400">{app.author} • v{app.version}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Desktop Pin Toggle */}
                          {isInstalled && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePinDesktop(app.id);
                              }}
                              className={`p-1.5 rounded-xl transition ${
                                isPinnedDesktop
                                  ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title={isPinnedDesktop ? t('appstore.unpin_desktop', currentLang, 'Vom Desktop lösen') : t('appstore.pin_desktop', currentLang, 'Auf Desktop pinnen')}
                            >
                              <Pin className={`w-3.5 h-3.5 ${isPinnedDesktop ? 'fill-current' : ''}`} />
                            </button>
                          )}

                          {/* Status Pill */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                            isInstalled 
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {isInstalled ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{t('appstore.status_active', currentLang, 'Aktiv')}</span>
                              </>
                            ) : (
                              <span>{t('appstore.status_inactive', currentLang, 'Inaktiv')}</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3 line-clamp-2">
                        {app.description}
                      </p>

                      {/* Tags */}
                      {app.tags && app.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {app.tags.slice(0, 4).map(tg => (
                            <span key={tg} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-md text-[10px] text-slate-500 font-medium">
                              {tg}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions: Launch & Toggle Install */}
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <span className="text-[11px] text-slate-400 font-medium">
                        {isInstalled ? 'Betriebsbereit' : 'Verfügbar'}
                      </span>

                      <div className="flex items-center gap-1.5 ml-auto">
                        {app.isSystem ? (
                          <button
                            type="button"
                            onClick={() => onLaunchModule(app.id)}
                            className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{t('appstore.action_open', currentLang, 'Öffnen')}</span>
                          </button>
                        ) : isInstalled ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onLaunchModule(app.id)}
                              className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>{t('appstore.action_open', currentLang, 'Öffnen')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleInstallModule(app.id)}
                              title={t('appstore.action_deactivate', currentLang, 'Modul deaktivieren')}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold transition flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{t('appstore.action_deactivate', currentLang, 'Deaktivieren')}</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onToggleInstallModule(app.id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{t('appstore.action_activate', currentLang, 'Aktivieren')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* APP DETAIL MODAL / DRAWER                                                 */}
      {/* ========================================================================= */}
      {selectedAppDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
              <div className="flex items-center gap-4">
                {(() => {
                  const Icon = getAppIcon(selectedAppDetail.id);
                  const color = getAppColor(selectedAppDetail.id);
                  return (
                    <div className={`w-14 h-14 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg`}>
                      <Icon className="w-7 h-7" />
                    </div>
                  );
                })()}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedAppDetail.title}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedAppDetail.isInstalled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {selectedAppDetail.isInstalled ? t('appstore.status_active', currentLang, 'Aktiviert') : t('appstore.status_inactive', currentLang, 'Deaktiviert')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedAppDetail.author} • Version {selectedAppDetail.version} • {selectedAppDetail.category.toUpperCase()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { sounds.playClick(); setSelectedAppDetail(null); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Beschreibung</h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedAppDetail.description}
                </p>
              </div>

              {/* Unified Payment & Checkout section for financial/POS apps */}
              {selectedAppDetail.isFinancial && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-500" />
                      <span>{t('appstore.payment_options', currentLang, 'Integrierte Zahlungsoptionen (Kreditkarte & Bargeld)')}</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      Einheitlich
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Dieses Modul unterstützt gleichberechtigt Kartenzahlung (EC/Kredit) und Bargeldabwicklung mit automatischem Belegdruck.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <div className="text-left">
                        <span className="text-xs font-bold block text-slate-900 dark:text-white">Kartenzahlung</span>
                        <span className="text-[10px] text-emerald-500 font-semibold">Aktiv • ZVT / NFC</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <div className="text-left">
                        <span className="text-xs font-bold block text-slate-900 dark:text-white">Bargeld</span>
                        <span className="text-[10px] text-emerald-500 font-semibold">Aktiv • Kassenlade</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedAppDetail.tags && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Funktions-Schlagwörter</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAppDetail.tags.map(tg => (
                      <span key={tg} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
                        {tg}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* System App Notice */}
              {selectedAppDetail.isSystem && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 rounded-2xl flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400 block">{t('appstore.status_system', currentLang, 'Geschützte Systemkomponente')}</span>
                    Dieses Modul ist das Fundament der SOCDOF-Systemarchitektur und kann nicht deaktiviert werden.
                  </div>
                </div>
              )}

              {/* Compliance & Security */}
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block">Vollständig Offline & GoBD-Zertifiziert</span>
                  Alle Daten verbleiben lokal auf Ihrem Gerät ohne externe Cloud-Abhängigkeiten.
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Status: <strong className={selectedAppDetail.isInstalled ? 'text-emerald-600' : 'text-slate-500'}>
                  {selectedAppDetail.isSystem ? 'System-Basis (Dauerhaft aktiv)' : selectedAppDetail.isInstalled ? 'Aktiviert' : 'Deaktiviert'}
                </strong>
              </span>

              <div className="flex items-center gap-2">
                {!selectedAppDetail.isSystem && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleInstallModule(selectedAppDetail.id);
                      setSelectedAppDetail(prev => prev ? { ...prev, isInstalled: !prev.isInstalled } : null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedAppDetail.isInstalled
                        ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {selectedAppDetail.isInstalled ? <Trash2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                    <span>{selectedAppDetail.isInstalled ? t('appstore.action_deactivate', currentLang, 'Deaktivieren') : t('appstore.action_activate', currentLang, 'Aktivieren')}</span>
                  </button>
                )}

                {selectedAppDetail.isInstalled && (
                  <button
                    type="button"
                    onClick={() => {
                      onLaunchModule(selectedAppDetail.id);
                      setSelectedAppDetail(null);
                    }}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{t('appstore.action_open', currentLang, 'App öffnen')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
