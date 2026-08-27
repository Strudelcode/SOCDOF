import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Receipt, 
  Users, 
  Package, 
  Layers, 
  CreditCard, 
  ShoppingCart, 
  Settings, 
  Calculator, 
  Download, 
  ShieldCheck, 
  Sparkles, 
  Keyboard, 
  HelpCircle, 
  CheckCircle2, 
  FileText, 
  Printer, 
  ChevronRight,
  Info,
  Smartphone,
  ExternalLink,
  MessageSquare,
  Github,
  History,
  Calendar,
  UtensilsCrossed,
  Headphones,
  HardDrive,
  Globe,
  Lock,
  Cpu,
  Monitor,
  LayoutGrid,
  Check,
  ArrowRight,
  Compass
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { APP_VERSION, VERSION_HISTORY } from '../lib/version';
import { useLanguage, t } from '../lib/i18n';
import { GITHUB_RELEASES_URL, GITHUB_REPO_URL, isElectron } from '../lib/platform';

type PortalTab = 'showcase' | 'manual' | 'releases' | 'shortcuts' | 'security' | 'community';

interface DocSection {
  id: string;
  title: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  content: React.ReactNode;
}

export const DocumentationApp: React.FC = () => {
  const currentLang = useLanguage();
  const [activeTab, setActiveTab] = useState<PortalTab>('showcase');
  const [activeSectionId, setActiveSectionId] = useState<string>('quickstart');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isGerman = currentLang === 'de';
  const isDesktop = isElectron();

  const docSections: DocSection[] = [
    {
      id: 'quickstart',
      title: isGerman ? 'Schnellstart & Desktop-Konzept' : 'Quickstart & Desktop Concept',
      category: isGerman ? 'Grundlagen' : 'Fundamentals',
      icon: Sparkles,
      summary: isGerman 
        ? 'Überblick über die Windows-Desktop-Oberfläche, Fensterverwaltung und Multi-Tasking.' 
        : 'Overview of the Windows desktop interface, window management, and multi-tasking.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
            <h4 className="font-bold text-sm text-indigo-900 dark:text-indigo-200 mb-1">
              {isGerman 
                ? "Willkommen bei SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)" 
                : "Welcome to SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)"}
            </h4>
            <p className="text-slate-700 dark:text-slate-300">
              {isGerman 
                ? 'Diese Applikation kombiniert die modulare Leistungsfähigkeit eines professionellen ERP-Systems mit der intuitiven Bedienung einer modernen Windows-Desktop-Umgebung.' 
                : 'This application combines the modular power of a professional ERP suite with the intuitive multi-window usability of a modern Windows desktop workstation.'}
            </p>
          </div>

          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isGerman ? 'Fenstersteuerung & Taskleiste' : 'Window Controls & Taskbar'}
          </h5>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li>
              <strong>{isGerman ? 'Fenster verschieben: ' : 'Move Windows: '}</strong>
              {isGerman 
                ? 'Klicken und halten Sie die Titelleiste eines Fensters, um es frei auf dem Desktop zu platzieren.' 
                : 'Click and drag the title bar of any window to position it anywhere across the desktop canvas.'}
            </li>
            <li>
              <strong>{isGerman ? 'Größe anpassen: ' : 'Resize: '}</strong>
              {isGerman 
                ? 'Ziehen Sie die untere rechte Ecke jedes Fensters oder doppelklicken Sie auf die Titelleiste für Vollbild.' 
                : 'Drag the bottom-right corner or double-click the title bar to toggle maximize/restore.'}
            </li>
            <li>
              <strong>{isGerman ? 'Minimieren & Schließen: ' : 'Minimize & Close: '}</strong>
              {isGerman 
                ? 'Nutzen Sie die Tasten — (Minimieren zur Taskleiste), ▢ (Maximieren) und ✕ (Schließen).' 
                : 'Use the standard buttons: — (minimize to taskbar), ▢ (maximize), and ✕ (close window).'}
            </li>
            <li>
              <strong>{isGerman ? 'Taskleiste & Startmenü: ' : 'Taskbar & Start Menu: '}</strong>
              {isGerman 
                ? 'Über den Start-Button unten links greifen Sie blitzschnell auf alle Module, Suchfunktionen und das Studio zu.' 
                : 'Access all business modules, quick search, system settings, and tools directly via the bottom start menu.'}
            </li>
          </ul>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300">
            <strong>{isGerman ? 'Tipp: ' : 'Pro Tip: '}</strong>
            {isGerman 
              ? 'Sie können mehrere Fenster gleichzeitig nebeneinander geöffnet haben, um z.B. Rechnungen zu schreiben und zeitgleich Kundenadressen oder Lagerbestände einzusehen!' 
              : 'You can have multiple windows open simultaneously side-by-side to draft invoices while checking stock inventory or customer accounts in real-time!'}
          </div>
        </div>
      )
    },
    {
      id: 'invoices',
      title: isGerman ? 'Fakturierung, Rechnungen & DIN 5008' : 'Invoicing, Billing & DIN 5008 Standards',
      category: isGerman ? 'Verkauf & Finanzen' : 'Sales & Finance',
      icon: Receipt,
      summary: isGerman 
        ? 'Rechnungen erstellen, Belegnummern, Briefkopf mit Hintergrundfoto & DIN 5008 Ausdruck.' 
        : 'Create invoices, voucher numbers, custom stationery with background photos & DIN 5008 print.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isGerman ? 'Rechnungserstellung in 4 Schritten' : 'Invoice Generation in 4 Easy Steps'}
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {isGerman ? '1. Kunde auswählen' : '1. Select Contact / Customer'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Wählen Sie einen existierenden Kontakt oder legen Sie direkt einen neuen an.' 
                  : 'Choose an existing customer from the address book or create a new contact instantly.'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {isGerman ? '2. Positionen & Rabatte' : '2. Items & Discounts'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Fügen Sie Artikel oder Freitextzeilen hinzu. Steuersätze (19%, 7%, 0%) und Rabatte werden automatisch berechnet.' 
                  : 'Add product catalog items or custom text lines. Tax rates (19%, 7%, 0%) and line discounts calculate automatically.'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {isGerman ? '3. Betreff & Zahlungsziel' : '3. Subject & Payment Terms'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Individuelle Betreffzeile für den Briefkopf und Zahlungsziel (z.B. 14 Tage netto) festlegen.' 
                  : 'Set custom letterhead subjects, performance period, and due date (e.g. 14 days net).'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {isGerman ? '4. Buchen & Drucken' : '4. Post & Print'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Klicken Sie auf Rechnung buchen und anschließend auf Drucken / DIN 5008 PDF.' 
                  : 'Book the invoice to save it to your records and generate a pixel-perfect DIN 5008 PDF document.'}
              </p>
            </div>
          </div>

          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isGerman ? 'Briefkopf mit Hintergrundfoto & Wasserzeichen' : 'Custom Letterhead & Background Stationery'}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'In den Einstellungen können Sie ein eigenes Hintergrund-Briefpapier (hochaufgelöstes Bild/Logo/Grafik) hochladen. Beim PDF-Druck wird Ihr Briefpapier exakt passgenau auf DIN-A4 im Hintergrund mit allen gesetzlichen DIN 5008 Elementen und 4-Spalten-Fußzeile gerendert.' 
              : 'In Settings you can upload full-bleed custom letterhead stationery (high-res background image or brand template). PDFs automatically integrate all statutory DIN 5008 standards, address boxes, folding marks, and 4-column bank footers.'}
          </p>
        </div>
      )
    },
    {
      id: 'contacts',
      title: isGerman ? 'Kontakte & CRM' : 'Contacts & CRM Directory',
      category: isGerman ? 'Kunden & Stammdaten' : 'Customers & Master Data',
      icon: Users,
      summary: isGerman 
        ? 'Adressbuch, Firmen- und Privatkunden, USt-IdNr., Zahlungsziele und Historie.' 
        : 'Address book, business and private accounts, VAT ID, payment terms, and ledger history.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isGerman ? 'Kundenverwaltung & Adressbuch' : 'Customer Directory & Accounts'}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Pflegen Sie Firmen- und Privatkunden mit lückenlosen Anschriften für das DIN 5008 Adressfenster, Telefonnummern, E-Mail-Adressen und Steuernummern.' 
              : 'Maintain corporate and private customers with complete postal addresses formatted for DIN 5008 envelope windows, phone numbers, email addresses, and VAT IDs.'}
          </p>
        </div>
      )
    },
    {
      id: 'pos',
      title: isGerman ? 'Kassensystem (POS) & Barcode' : 'Point of Sale (POS) & Barcode Scanning',
      category: isGerman ? 'Verkauf & Kasse' : 'Sales & Retail POS',
      icon: CreditCard,
      summary: isGerman 
        ? 'Touch-Kasse, Barcode-Scanning, Bar- und Kartenzahlung, Kassenbeleg-Druck (Bon).' 
        : 'Touch screen register, barcode scanning, cash and card tender, thermal receipt printer.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isGerman ? 'POS Kassenbetrieb' : 'POS Cash Register Operations'}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Die POS Kasse ermöglicht schnelle Verkäufe per Touch oder USB-Barcodescanner. Kassenbons können thermogedruckt oder als PDF exportiert werden.' 
              : 'The POS register provides lightning-fast checkout via touch grid or barcode scanner. Thermal receipts can be printed or exported directly.'}
          </p>
        </div>
      )
    },
    {
      id: 'accounting',
      title: isGerman ? 'Buchhaltung, EÜR & Finanzen' : 'Accounting, BWA, Cash Flow & Financials',
      category: isGerman ? 'Finanzen & Steuern' : 'Finance & Tax',
      icon: Calculator,
      summary: isGerman 
        ? 'Automatische Buchungssätze, Einnahmen-Überschuss-Rechnung (EÜR), BWA und DATEV-Export.' 
        : 'Automatic ledger entries, cash-basis accounting, profit and loss, and DATEV export.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isGerman ? 'Doppelte Buchführung & EÜR' : 'Accounting & Ledger Engine'}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Jede gebuchte Rechnung und jeder Kassenbeleg erzeugt automatisch GoBD-konforme Buchungszeilen für Erlöskonten, Vorsteuer und Umsatzsteuer.' 
              : 'Every posted invoice or POS sale automatically writes compliant double-entry journal rows across revenue, receivables, and VAT liability accounts.'}
          </p>
        </div>
      )
    },
    {
      id: 'calendar',
      title: isGerman ? 'Kalender & Google Sync' : 'Calendar & Google Sync',
      category: isGerman ? 'Planung & Termine' : 'Planning & Scheduling',
      icon: Calendar,
      summary: isGerman 
        ? 'Terminkalender mit Google Live Sync, Fälligkeitsterminen und Terminkategorien.' 
        : 'Appointment scheduler with Google Live Sync, invoice due dates, and category views.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isGerman ? 'Integrierter Business-Kalender' : 'Integrated Business Calendar'}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Synchronisieren Sie Termine in Echtzeit mit Google Calendar oder verwalten Sie lokale Zahlungsziele und Kundentermine übersichtlich in Monats- und Wochenansichten.' 
              : 'Sync appointments with Google Calendar or schedule local customer deadlines, invoices, and milestones in full monthly and weekly agenda views.'}
          </p>
        </div>
      )
    }
  ];

  const filteredSections = docSections.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeSection = docSections.find(s => s.id === activeSectionId) || docSections[0];
  const ActiveIcon = activeSection.icon;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 select-text">
      {/* Top Portal Navigation Ribbon */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-900/40 px-5 py-3 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-indigo-400/30">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-white tracking-tight">
                SOCDOF Portal &amp; Documentation Hub
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              {isGerman ? 'Offizielles Handbuch, Feature-Showcase, Release-Notes & Architektur' : 'Official User Manual, Feature Showcase, Release Notes & Architecture'}
            </p>
          </div>
        </div>

        {/* Portal Tabs */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs overflow-x-auto scrollbar-none">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('showcase');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'showcase' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGerman ? 'Showcase & Features' : 'Showcase & Features'}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('manual');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'manual' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isGerman ? 'Handbuch' : 'User Manual'}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('releases');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'releases' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGerman ? 'Download & Releases' : 'Download & Releases'}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('shortcuts');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'shortcuts' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{isGerman ? 'Tastenkürzel' : 'Shortcuts'}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('security');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'security' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isGerman ? 'Sicherheit & DSGVO' : 'Security & Offline'}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('community');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'community' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isGerman ? 'Community' : 'Community'}</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* 1. SHOWCASE & FEATURES TAB */}
        {activeTab === 'showcase' && (
          <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
            {/* Hero Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 text-white shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-white/20 backdrop-blur-md">
                  100% Offline-First ERP Suite
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500 text-white font-bold">
                  v{APP_VERSION}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {isGerman 
                  ? 'Moderne Unternehmenssoftware mit echtem Desktop-Multi-Tasking' 
                  : 'Modern Business ERP Workstation with True Multi-Tasking'}
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl leading-relaxed">
                {isGerman 
                  ? 'Verwalten Sie Rechnungen nach DIN 5008, Kunden, POS Kassen, Bestände und Buchhaltung in einer blitzschnellen, vollkommen privaten Windows-Desktop-Umgebung ohne Cloud-Zwang.' 
                  : 'Manage DIN 5008 compliant invoices, contacts CRM, POS registers, warehouse stock, and double-entry accounting in a private, offline-first Windows desktop workstation.'}
              </p>

              <div className="pt-2 flex flex-wrap gap-3">
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-white text-indigo-900 font-bold text-xs shadow-md hover:bg-indigo-50 transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{isGerman ? 'Windows Setup (.exe) laden' : 'Download Windows Setup (.exe)'}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>

                <button
                  onClick={() => setActiveTab('manual')}
                  className="px-4 py-2.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-950 text-white font-semibold text-xs border border-white/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{isGerman ? 'Handbuch & Anleitungen ansehen' : 'Explore User Manual'}</span>
                </button>
              </div>
            </div>

            {/* Feature Modules Matrix */}
            <div className="space-y-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{isGerman ? 'Integrierte Business-Module im Überblick' : 'Integrated Business Modules Overview'}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Invoices */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-indigo-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isGerman ? 'DIN 5008 Fakturierung' : 'DIN 5008 Invoicing'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isGerman 
                      ? 'Rechtssichere Rechnungen, individuelle Briefköpfe mit Hintergrundgrafiken, Rabatte, Zahlungsziele und PDF-Export.' 
                      : 'Compliant invoices, custom background letterhead stationery, line discounts, payment terms, and pixel-perfect PDF export.'}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isGerman ? 'GoBD & DIN-A4 konform' : 'Statutory Standards'}</span>
                  </div>
                </div>

                {/* 2. Contacts CRM */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-teal-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isGerman ? 'Kontakte & CRM' : 'Contacts & CRM'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isGerman 
                      ? 'Zentrales Adressbuch für Kunden und Lieferanten, USt-IdNr., Bonität, Zahlungskonditionen und historische Belege.' 
                      : 'Central master directory for customers and suppliers, VAT IDs, credit terms, and historical sales ledgers.'}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isGerman ? 'Vollständige Adressprüfung' : 'Address Verification'}</span>
                  </div>
                </div>

                {/* 3. POS Cash Register */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-violet-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-800">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isGerman ? 'POS Touch-Kasse' : 'POS Cash Register'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isGerman 
                      ? 'Schnellkasse für Ladengeschäfte, Touch-Eingabe, Barcode-Scanner-Support, Bar-/Kartenzahlung und Bondruck.' 
                      : 'Fast checkout for retail storefronts, touch grid, barcode scanner integration, cash/card tender, and thermal receipts.'}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isGerman ? 'Thermobondruck & Kassenjournal' : 'Thermal Receipts'}</span>
                  </div>
                </div>

                {/* 4. Accounting & BWA */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-emerald-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isGerman ? 'Abrechnung & BWA' : 'Accounting & Financials'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isGerman 
                      ? 'Automatische GoBD-Buchungssätze für Rechnungen und Kasse, Einnahmen-Überschuss-Rechnung (EÜR) und BWA.' 
                      : 'Automatic double-entry journal rows for invoices and sales, cash-basis accounting, BWA profit, and tax reporting.'}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isGerman ? 'Echtzeit-GuV & Steuerausweis' : 'Real-time Tax Engine'}</span>
                  </div>
                </div>

                {/* 5. Inventory & Stock */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-amber-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isGerman ? 'Warenwirtschaft & Lager' : 'Inventory & Warehouse'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isGerman 
                      ? 'Lagerbestandsführung in Echtzeit, Wareneingang und -ausgang, Mindestbestände und Bestandsbewertung.' 
                      : 'Real-time stock ledger, goods receipts and issues, reorder alerts, and valuation metrics.'}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isGerman ? 'Echtzeit-Bestandsabgleich' : 'Real-time Tracking'}</span>
                  </div>
                </div>

                {/* 6. Calendar & Google Sync */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 hover:border-blue-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isGerman ? 'Kalender & Live Sync' : 'Calendar & Live Sync'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isGerman 
                      ? 'Nahtlose Integration von Google Calendar, Anzeige von Rechnungsfälligkeiten, Terminerstellung und Agenda.' 
                      : 'Seamless Google Calendar synchronization, invoice payment tracking, appointment scheduler, and agenda flyout.'}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isGerman ? 'Google Calendar & Outlook Sync' : 'Cloud & Local Calendar'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. USER MANUAL & GUIDES TAB */}
        {activeTab === 'manual' && (
          <div className="flex flex-col md:flex-row h-full min-h-[500px]">
            {/* Sidebar */}
            <div className="w-full md:w-64 bg-slate-100 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col flex-shrink-0">
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={isGerman ? 'Thema suchen...' : 'Search documentation...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {filteredSections.map((sec) => {
                  const Icon = sec.icon;
                  const isSelected = sec.id === activeSectionId;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => {
                        sounds.playClick();
                        setActiveSectionId(sec.id);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition font-medium cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
                      <span className="truncate flex-1">{sec.title}</span>
                      {isSelected && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content view */}
            <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-950">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-start gap-3.5 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <ActiveIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {activeSection.category}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {activeSection.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeSection.summary}
                    </p>
                  </div>
                </div>

                <div>
                  {activeSection.content}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. DOWNLOAD & RELEASES TAB */}
        {activeTab === 'releases' && (
          <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Download Card */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                    Windows Installer
                  </span>
                  <span className="text-xs font-mono text-slate-400">SOCDOF-Setup-v{APP_VERSION}.exe</span>
                </div>
                <h3 className="text-xl font-bold">
                  {isGerman ? `SOCDOF v${APP_VERSION} für Windows herunterladen` : `Download SOCDOF v${APP_VERSION} for Windows`}
                </h3>
                <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
                  {isGerman 
                    ? 'Der vollständige Windows-Installer richtet die Desktop-App auf Ihrem System ein. Ihre Daten bleiben 100% lokal gespeichert.' 
                    : 'The official Windows NSIS installer configures the offline ERP suite on your PC with full local persistence.'}
                </p>
              </div>

              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center gap-2 shrink-0"
              >
                <Download className="w-5 h-5" />
                <span>{isGerman ? 'Installer herunterladen' : 'Download Installer'}</span>
                <ExternalLink className="w-4 h-4 opacity-70" />
              </a>
            </div>

            {/* Version History Changelog */}
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{isGerman ? 'Versionshistorie & Release Notes' : 'Release History & Changelog'}</span>
              </h3>

              <div className="space-y-3">
                {VERSION_HISTORY.map((rel) => (
                  <div key={rel.version} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md font-mono font-bold text-xs bg-indigo-600 text-white">
                          v{rel.version}
                        </span>
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{rel.title}</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{rel.date}</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {rel.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. KEYBOARD SHORTCUTS TAB */}
        {activeTab === 'shortcuts' && (
          <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{isGerman ? 'Tastaturkürzel & Schnellnavigation' : 'Keyboard Shortcuts & Quick Navigation'}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isGerman ? 'Steuern Sie die gesamte Desktop-Umgebung noch schneller über die Tastatur.' : 'Control the entire desktop workspace swiftly using keyboard shortcuts.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* General Shortcuts */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {isGerman ? 'System & Desktop' : 'System & Desktop'}
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">{isGerman ? 'Spotlight Command Palette öffnen' : 'Open Spotlight Command Palette'}</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Ctrl</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">K</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">{isGerman ? 'Startmenü öffnen / schließen' : 'Toggle Start Menu'}</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Win</kbd>
                      <span className="text-slate-400">/</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Ctrl+Space</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">{isGerman ? 'Handbuch & Showcase öffnen' : 'Open Documentation & Showcase'}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">F1</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">{isGerman ? 'Aktives Fenster / Modal schließen' : 'Close Active Modal / Window'}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">Esc</kbd>
                  </div>
                </div>
              </div>

              {/* Taskbar Apps Shortcuts */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {isGerman ? 'Taskleisten-Apps starten' : 'Launch Taskbar Apps'}
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">{isGerman ? 'App 1 auf Taskleiste öffnen' : 'Open Taskbar App 1'}</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Alt</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">1</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">{isGerman ? 'App 2 auf Taskleiste öffnen' : 'Open Taskbar App 2'}</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Alt</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">2</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">{isGerman ? 'App 3 auf Taskleiste öffnen' : 'Open Taskbar App 3'}</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Alt</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">3</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">{isGerman ? 'Apps 4 bis 9 öffnen' : 'Open Apps 4 to 9'}</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Alt</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">4..9</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. SECURITY & OFFLINE ARCHITECTURE TAB */}
        {activeTab === 'security' && (
          <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-emerald-950 dark:text-emerald-100">
                  {isGerman ? '100% Lokale Datenhoheit & Zero-Cloud-Architektur' : '100% Local Data Sovereignty & Zero-Cloud Architecture'}
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-200/90 leading-relaxed">
                  {isGerman 
                    ? 'SOCDOF speichert alle Stammdaten, Rechnungen, Kundenprofile und Finanzbuchungen ausschließlich auf Ihrem lokalen Computer. Keine Übertragung an externe Server, kein Tracking, DSGVO-konform by Design.' 
                    : 'SOCDOF stores all master data, invoices, customer records, and ledger balances exclusively on your local device. No external tracking or unsolicited cloud telemetry.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-indigo-500" />
                  <span>{isGerman ? 'Lokale Speicherung' : 'Local Storage Engine'}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  {isGerman 
                    ? 'Dauerhafte Persistenz via lokaler Datenbank und JSON-Backups. Sie behalten die volle Kontrolle über Ihre Dateien.' 
                    : 'Permanent offline database persistence with comprehensive JSON export and restore capabilities.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  <span>{isGerman ? 'DSGVO & Datenschutz' : 'GDPR & Privacy'}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  {isGerman 
                    ? 'Erfüllt höchste Datenschutzstandards, da keine personenbezogenen Daten an Dritte übermittelt werden.' 
                    : 'Meets strict data privacy requirements as zero personal data leaves your local machine.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 6. COMMUNITY & DISCORD TAB */}
        {activeTab === 'community' && (
          <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="p-6 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
              <h3 className="font-bold text-base text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{isGerman ? 'Open Source Projekt & Community Support' : 'Open Source Project & Community Support'}</span>
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {isGerman 
                  ? 'SOCDOF ist ein freies Open-Source-Projekt. Der gesamte Quellcode, Issues, Versionen und Erweiterungen sind transparent auf GitHub verfügbar. Bei Fragen oder für Support steht unsere Community auf Discord bereit.' 
                  : 'SOCDOF is a free open-source project. Source code, issues, versions, and enhancements are openly maintained on GitHub. For help and discussions, join our Discord community.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* GitHub Card */}
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 transition flex items-start gap-3.5 group shadow-sm"
              >
                <div className="p-3 rounded-xl bg-slate-900 text-white shrink-0 shadow-sm">
                  <Github className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    <span>GitHub Repository</span>
                    <ExternalLink className="w-4 h-4 opacity-60" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    github.com/Strudelcode/SOCDOF
                  </p>
                  <span className="inline-block mt-3 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-md">
                    Source Code &amp; Releases
                  </span>
                </div>
              </a>

              {/* Discord Card */}
              <a
                href="https://discord.gg/QW85EaXTgB"
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-2xl bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 transition flex items-start gap-3.5 group shadow-sm"
              >
                <div className="p-3 rounded-xl bg-[#5865F2] text-white shrink-0 shadow-md">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-[#5865F2] dark:text-indigo-300">
                    <span>{isGerman ? 'Hilfe & Support (Discord)' : 'Help & Support (Discord)'}</span>
                    <ExternalLink className="w-4 h-4 opacity-60" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {isGerman 
                      ? 'Hilfe und Feature-Austausch auf unserem offiziellen Discord-Server!' 
                      : 'Get community help and discuss new features on our official Discord server!'}
                  </p>
                  <span className="inline-block mt-3 text-[10px] font-bold text-white bg-[#5865F2] px-2.5 py-1 rounded-md shadow-xs">
                    discord.gg/QW85EaXTgB
                  </span>
                </div>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
