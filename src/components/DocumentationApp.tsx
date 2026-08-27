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
  Headphones
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { APP_VERSION, VERSION_HISTORY } from '../lib/version';
import { useLanguage, t } from '../lib/i18n';

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
  const [activeSectionId, setActiveSectionId] = useState<string>('quickstart');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isGerman = currentLang === 'de';

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
      title: isGerman ? 'Kontakte & Batch-Import' : 'Contacts & Address Book',
      category: isGerman ? 'Stammdaten' : 'Master Data',
      icon: Users,
      summary: isGerman 
        ? 'Kunden, Lieferanten, Batch-Erstellung und Outlook/CSV/vCard-Import.' 
        : 'Customers, suppliers, batch multi-entry, and Outlook/CSV/vCard data import.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Das Kontaktmodul verwaltet Kunden, Lieferanten und Dienstleister mit Adressen, USt-IdNr., Bankdaten und Kundenhistorie.' 
              : 'The contacts module manages customers, suppliers, and vendors with complete addresses, Tax/VAT IDs, billing history, and balances.'}
          </p>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h6 className="font-bold text-slate-900 dark:text-white mb-1">
              {isGerman ? 'Mehrfach-Import & Batch-Erstellung' : 'Bulk Import & Fast Batch Creation'}
            </h6>
            <p className="text-slate-600 dark:text-slate-300">
              {isGerman 
                ? 'Über die Buttons Import (CSV / vCard) oder Batch-Erstellung können Sie beliebig viele Kontakte auf einen Schlag einfügen. Unterstützt werden Standard-Outlook-Dateien, Adressbuch-vCards und CSVs mit Spalten wie Name, E-Mail, Telefon und Firma.' 
                : 'Use CSV / vCard Import or the Batch Add modal to create dozens of contacts at once. Supported formats include Outlook CSV exports, standard vCard files, and formatted spreadsheet tables.'}
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'pos',
      title: isGerman ? 'POS Kasse & Barcode-Scanner' : 'Point of Sale (POS) & Barcode Scanner',
      category: isGerman ? 'Verkauf & Finanzen' : 'Sales & Finance',
      icon: CreditCard,
      summary: isGerman 
        ? 'Touch-Kassensystem, Scanner-Unterstützung, Bar-/Kartenzahlung und Bon-Druck.' 
        : 'Touch cash register, barcode scanner support, cash/card checkout, and thermal receipt printing.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Die Point of Sale (POS) Kasse ist für schnelle Thekenverkäufe optimiert:' 
              : 'The POS cash register is designed for ultra-fast over-the-counter sales:'}
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li>
              <strong>{isGerman ? 'Warenkorb per Klick: ' : 'One-Click Cart: '}</strong>
              {isGerman 
                ? 'Tippen Sie auf einen Artikel, um ihn dem Beleg hinzuzufügen.' 
                : 'Tap any product tile to instantly add it to the active receipt ticket.'}
            </li>
            <li>
              <strong>{isGerman ? 'Barcode-Scanner: ' : 'Hardware Scanner Support: '}</strong>
              {isGerman 
                ? 'Scannen Sie Barcodes oder EAN-Nummern via USB/Bluetooth-Handscanner.' 
                : 'Scan barcodes or EAN-13 codes seamlessly with handheld USB/Bluetooth scanners.'}
            </li>
            <li>
              <strong>{isGerman ? 'Zahlungsarten: ' : 'Multiple Payment Methods: '}</strong>
              {isGerman 
                ? 'Barzahlung mit automatischer Wechselgeldberechnung, EC-/Kreditkarte oder NFC.' 
                : 'Cash checkout with automatic change calculation, debit/credit cards, or contactless payments.'}
            </li>
            <li>
              <strong>{isGerman ? 'Thermischer Bon-Druck: ' : 'Thermal Receipt Printing: '}</strong>
              {isGerman 
                ? 'Kompatibel mit standardmäßigen 80mm und 58mm POS-Bondruckern.' 
                : 'Generates standard 80mm/58mm thermal receipt layouts with company header and QR codes.'}
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'accounting',
      title: isGerman ? 'Abrechnungen, BWA & Finanzen' : 'Accounting, Financial Reports & BWA',
      category: isGerman ? 'Verkauf & Finanzen' : 'Sales & Finance',
      icon: Calculator,
      summary: isGerman 
        ? 'Einnahmen-Überschuss-Rechnung (EÜR), BWA-Übersicht, UStVA, Offene Posten & Z-Bon.' 
        : 'Income statement (EÜR), monthly financial evaluations, sales tax filings, and register closing (Z-report).',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Im Modul Abrechnungen & Finanzen erhalten Sie den vollständigen buchhalterischen Überblick über Ihr Unternehmen:' 
              : 'The Accounting & Finance module gives you full real-time transparency over your business performance:'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {isGerman ? 'EÜR & BWA' : 'Income & Operating Result'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Gegenüberstellung von Umsatzerlösen, Material-/Wareneinsatz und Betriebsergebnis.' 
                  : 'Breakdown of gross revenue, operational expenses, material costs, and net profit.'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {isGerman ? 'Umsatzsteuer-Voranmeldung' : 'VAT / Sales Tax Breakdown'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Aufschlüsselung der fälligen Mehrwertsteuer nach 19% und 7% sowie Vorsteuer.' 
                  : 'Calculates tax liabilities split by 19% standard, 7% reduced, and deductible input tax.'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {isGerman ? 'Offene Posten & Mahnwesen' : 'Receivables & Dunning'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Überfällige Rechnungen mit Tagen Verzug und 1-Klick-Zahlungseingang.' 
                  : 'Track overdue customer invoices, payment delays, and record incoming payments in 1 click.'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {isGerman ? 'Kassenabschluss (Z-Bon)' : 'Register Closing (Z-Report)'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Tagesabschluss für Barumsätze und Kartenterminal-Umsätze mit Druckansicht.' 
                  : 'End-of-day summary reconciling cash drawer takings, card transactions, and thermal Z-receipts.'}
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'calendar',
      title: isGerman ? 'Google Kalender, Live-Sync & Termine' : 'Google Calendar, Live Sync & Events',
      category: isGerman ? 'Produktivität & Zeit' : 'Productivity & Time',
      icon: Calendar,
      summary: isGerman 
        ? 'Zwei-Wege Google Kalender Live-Sync, Rechnungsfälligkeiten, Monats-/Wochen-/Tagesansicht & Terminerstellung.' 
        : 'Two-way Google Calendar live sync, invoice due dates, month/week/day views & event management.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/60">
            <h5 className="font-bold text-sm text-blue-900 dark:text-blue-200 mb-1">
              {isGerman ? 'Zwei-Wege Google Kalender Live-Synchronisation' : 'Two-Way Google Calendar Live Synchronization'}
            </h5>
            <p className="text-slate-700 dark:text-slate-300">
              {isGerman 
                ? 'SOCDOF bietet eine vollständige, bidirektionale Google Kalender Synchronisierung. Offene Kundenrechnungen werden mit Zahlungsziel automatisch in Ihren Google Kalender eingetragen, während externe Termine live in SOCDOF importiert werden.' 
                : 'SOCDOF provides comprehensive, bidirectional Google Calendar synchronization. Customer invoice due dates are automatically published as calendar events, while your Google Calendar appointments are streamed into SOCDOF in real time.'}
            </p>
          </div>

          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isGerman ? 'Hauptfunktionen des Kalendermoduls' : 'Key Calendar Module Features'}
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {isGerman ? '1. Flexible Ansichten' : '1. Flexible View Modes'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Wechseln Sie nahtlos zwischen Monatsgitter (42-Tage-Matrix), Wochenansicht, detailliertem Tagesplan und chronologischer Agenda.' 
                  : 'Switch seamlessly between full Month matrix (uniform 42-day layout), Week view, detailed Day view, and chronological Agenda.'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {isGerman ? '2. Automatische Fälligkeiten' : '2. Automatic Invoice Deadlines'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Alle gebuchten Ausgangsrechnungen erscheinen automatisch als Fälligkeitstermine inklusive Rechnungsnummer, Kunde und Bruttobetrag.' 
                  : 'All posted customer invoices automatically appear on their payment due date with invoice number, customer name, and total amount.'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {isGerman ? '3. Google Live-Verbindung' : '3. Google Live Connection'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Verbinden Sie Ihren Google Account mit 1 Klick. Wählen Sie den Zielkalender und optional automatische Synchronisierungsintervalle (1m, 2m, 5m).' 
                  : 'Connect your Google account in 1 click. Select your target calendar and configure background auto-sync intervals (1m, 2m, 5m).'}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {isGerman ? '4. Schnelle Terminerstellung' : '4. Fast Appointment Creation'}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {isGerman 
                  ? 'Erstellen Sie Kundentermine, Besprechungen oder Fristen mit Start-/Endzeit, Ganztags-Option, Farbkategorien und Ortsangaben.' 
                  : 'Create custom meetings, deadlines, and customer consultations with start/end time, all-day toggle, color tags, and locations.'}
              </p>
            </div>
          </div>

          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {isGerman ? 'Dynamisches Taskleisten-Icon & Windows 11 Agenda' : 'Dynamic Taskbar Icon & Windows 11 Agenda'}
          </h5>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li>
              <strong>{isGerman ? 'Dynamisches Datum-Icon: ' : 'Live Dynamic Date Icon: '}</strong>
              {isGerman 
                ? 'Das Kalender-Icon auf dem Desktop und in der Taskleiste zeigt immer aktuell den aktuellen Monat und den Tag (z. B. 27. Aug) an.' 
                : 'The desktop and taskbar calendar icons dynamically display the current month and live day number (e.g. Aug 27).'}
            </li>
            <li>
              <strong>{isGerman ? 'Taskleisten-Uhr Flyout: ' : 'Taskbar Clock Flyout: '}</strong>
              {isGerman 
                ? 'Beim Klick auf die Systemuhr unten rechts öffnet sich die Windows-11-Kalender-Agenda mit Direktzugriff auf anstehende Termine und Rechnungsfälligkeiten.' 
                : 'Clicking the system clock in the bottom taskbar opens the integrated Windows 11 Agenda flyout with upcoming appointments and invoices.'}
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'restaurant',
      title: isGerman ? 'Gastronomie, Tische & Küchenmonitor (KDS)' : 'Restaurant, Tables & Kitchen Display (KDS)',
      category: isGerman ? 'Branchenlösungen' : 'Industry Solutions',
      icon: UtensilsCrossed,
      summary: isGerman 
        ? 'Tischplan-Verwaltung, Gang-Bestellungen, Küchenmonitor und Touch-Abrechnung.' 
        : 'Table management, course ordering, live kitchen display system (KDS), and split billing.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Das Gastronomie-Modul verwandelt SOCDOF in ein vollwertiges Restaurant-Kassensystem mit Tischplan und Küchenbildschirm:' 
              : 'The Restaurant module provides full food-and-beverage workflows with interactive table layouts and kitchen display system:'}
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li>
              <strong>{isGerman ? 'Interaktiver Tischplan: ' : 'Interactive Table Layout: '}</strong>
              {isGerman 
                ? 'Tische nach Bereichen (Gastraum, Terrasse, Bar) mit Statusfarben (Frei, Belegt, Bestellt).' 
                : 'Manage dining rooms, outdoor patio, and bar tables with real-time status indicators.'}
            </li>
            <li>
              <strong>{isGerman ? 'Küchenmonitor (KDS): ' : 'Kitchen Display System (KDS): '}</strong>
              {isGerman 
                ? 'Bestellungen werden in Echtzeit an die Küche übertragen und können als zubereitet markiert werden.' 
                : 'Orders are sent live to kitchen screens with order timers and course progress management.'}
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'support_services',
      title: isGerman ? 'Kunden-Support & Zeiterfassung' : 'Customer Support & Time Tracking',
      category: isGerman ? 'Dienstleistung' : 'Services & Tickets',
      icon: Headphones,
      summary: isGerman 
        ? 'Support-Tickets erfassen, Stundensätze hinterlegen und direkt in Rechnungen abrechnen.' 
        : 'Log support tickets, record billable time, and convert hours directly to customer invoices.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Erfassen Sie Kunden-Tickets, dokumentieren Sie geleistete Arbeitsstunden und rechnen Sie diese mit 1 Klick als Rechnungspositionen ab.' 
              : 'Log customer support requests, track billable project time with timer controls, and convert tickets into invoice line items in 1 click.'}
          </p>
        </div>
      )
    },
    {
      id: 'appstore',
      title: isGerman ? 'Odoo App Store & Modulverwaltung' : 'App Store & Module Management',
      category: isGerman ? 'System' : 'System',
      icon: Package,
      summary: isGerman 
        ? 'Module nach Bedarf aktivieren, installieren, anheften oder ausblenden.' 
        : 'Enable, configure, pin, or hide application modules to customize your workflow.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Über den App Store passen Sie Ihr ERP exakt an Ihre Arbeitsweise an:' 
              : 'Tailor your workspace directly from the modular App Store:'}
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li>
              <strong>{isGerman ? 'Module aktivieren/deaktivieren: ' : 'Enable/Disable Modules: '}</strong>
              {isGerman 
                ? 'Blenden Sie nicht benötigte Module (z.B. POS Kasse oder Einkauf) mit einem Klick aus, um Ihren Desktop übersichtlich zu halten.' 
                : 'Hide unused modules (such as POS or Purchases) with a single click to maintain a tidy desktop.'}
            </li>
            <li>
              <strong>{isGerman ? 'Anheften an Desktop & Taskleiste: ' : 'Pin to Desktop & Taskbar: '}</strong>
              {isGerman 
                ? 'Legen Sie fest, welche Schnellzugriffe direkt auf Ihrem Windows-Desktop angezeigt werden.' 
                : 'Choose which favorite apps appear as desktop shortcuts or pinned quick-launch icons.'}
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'shortcuts',
      title: isGerman ? 'Tastaturkürzel & Schnelltasten' : 'Keyboard Shortcuts & Productivity',
      category: isGerman ? 'System' : 'System',
      icon: Keyboard,
      summary: isGerman 
        ? 'Wichtige Tastaturkürzel für maximale Produktivität.' 
        : 'Essential hotkeys and shortcuts for rapid navigation.',
      content: (
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {isGerman ? 'Befehlspalette / Globale Suche öffnen' : 'Open Command Palette / Search'}
              </span>
              <kbd className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-[11px] font-bold shadow-xs">
                Ctrl + K / Cmd + K
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {isGerman ? 'Aktives Dokument drucken' : 'Print Active Document'}
              </span>
              <kbd className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-[11px] font-bold shadow-xs">
                Ctrl + P / Cmd + P
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {isGerman ? 'Fenster maximieren / wiederherstellen' : 'Maximize / Restore Window'}
              </span>
              <kbd className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-[11px] font-bold shadow-xs">
                {isGerman ? 'Doppelklick Titelleiste' : 'Double-click Title Bar'}
              </kbd>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'backups',
      title: isGerman ? 'Backups, Datenschutz & Speicher' : 'Backups, Security & Offline Storage',
      category: isGerman ? 'Sicherheit' : 'Security & Storage',
      icon: ShieldCheck,
      summary: isGerman 
        ? 'Kompakte Backup-Dateien, Speicherplatz-Überwachung und Datenschutz.' 
        : 'Offline-first database, automatic data backups, and local browser persistence.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            {isGerman 
              ? 'Ihre Unternehmensdaten werden zu 100% lokal und sicher in Ihrem Browser gespeichert (IndexedDB). Es werden keine sensiblen Kundendaten an externe Server übertragen.' 
              : 'All enterprise data is stored 100% locally and securely in your browser storage (IndexedDB). No sensitive customer or financial records are sent to external third parties.'}
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300">
            <strong>{isGerman ? 'Empfehlung zur Datensicherung: ' : 'Backup Recommendation: '}</strong>
            {isGerman 
              ? 'Erstellen Sie regelmäßig über Einstellungen > Datensicherung eine separate JSON-Backup-Datei und speichern Sie diese auf einem USB-Stick oder Netzlaufwerk.' 
              : 'Create regular JSON backup snapshots via Settings > Backup & Storage, and store copies on encrypted external drives or company cloud backup locations.'}
          </div>
        </div>
      )
    },
    {
      id: 'community',
      title: isGerman ? 'Open Source & Discord Community Hilfe' : 'Open Source Repository & Discord Support',
      category: isGerman ? 'Support & Community' : 'Support & Community',
      icon: MessageSquare,
      summary: isGerman 
        ? 'Offizielles Open-Source GitHub Repository & Support ausschließlich auf Discord.' 
        : 'Official open-source GitHub repository and developer community support on Discord.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 space-y-3">
            <h5 className="font-bold text-sm text-indigo-900 dark:text-indigo-200">
              {isGerman ? 'Open Source Projekt & Community Support' : 'Open Source Project & Community Support'}
            </h5>
            <p className="text-slate-700 dark:text-slate-300">
              {isGerman 
                ? 'SOCDOF ist ein freies Open-Source-Projekt. Der gesamte Quellcode, Issues, Versionen und Erweiterungen sind transparent auf GitHub verfügbar.' 
                : 'SOCDOF is a free open-source project. Source code, issue trackers, version releases, and documentation are openly available on GitHub.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* GitHub Card */}
            <a
              href="https://github.com/Strudelcode/SOCDOF"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition flex items-start gap-3 group"
            >
              <div className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
                <Github className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  github.com/Strudelcode/SOCDOF
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
                  Source Code &amp; Releases
                </span>
              </div>
            </a>

            {/* Discord Support Card */}
            <a
              href="https://discord.gg/QW85EaXTgB"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-2xl bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 transition flex items-start gap-3 group"
            >
              <div className="p-2.5 rounded-xl bg-[#5865F2] text-white shrink-0 shadow-sm">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 font-bold text-xs text-[#5865F2] dark:text-indigo-300">
                  <span>{isGerman ? 'Hilfe & Support (Discord)' : 'Community Help & Support (Discord)'}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                  {isGerman 
                    ? 'Hilfe ausschließlich auf unserem offiziellen Discord-Server!' 
                    : 'Get community help and feature support on our official Discord server!'}
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold text-white bg-[#5865F2] px-2 py-0.5 rounded-md shadow-xs">
                  discord.gg/QW85EaXTgB
                </span>
              </div>
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'changelog',
      title: isGerman ? 'Versionshistorie & Updates' : 'Release History & Changelog',
      category: isGerman ? 'System & Releases' : 'System & Releases',
      icon: History,
      summary: isGerman 
        ? `Aktuelle Version SOCDOF v${APP_VERSION} und alle Release-Highlights.` 
        : `Current version SOCDOF v${APP_VERSION} and all release highlights.`,
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="flex items-center justify-between p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
            <div>
              <div className="text-[11px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                {isGerman ? 'Installierte Version' : 'Installed Version'}
              </div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white">SOCDOF v{APP_VERSION}</div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
              {isGerman ? 'Aktuell' : 'Latest'}
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {VERSION_HISTORY.map((rel) => (
              <div key={rel.version} className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-indigo-600 text-white">
                      v{rel.version}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{rel.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{rel.date}</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                  {rel.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
    <div className="flex flex-col md:flex-row h-full min-h-[500px] bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      {/* Left Sidebar: Chapters & Search */}
      <div className="w-full md:w-64 bg-slate-100 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">
              {isGerman ? 'Handbuch & Docs' : 'User Manual & Docs'}
            </h3>
            <p className="text-[10px] text-slate-500">
              {isGerman ? 'Offizielle Dokumentation' : 'Official Documentation'}
            </p>
          </div>
        </div>

        {/* Search input */}
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

        {/* List of sections */}
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
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition font-medium ${
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

      {/* Right Content Area */}
      <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-950">
        <div className="max-w-2xl mx-auto">
          {/* Header of active section */}
          <div className="flex items-start gap-3.5 pb-4 mb-6 border-b border-slate-200 dark:border-slate-800">
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

          {/* Body */}
          <div>
            {activeSection.content}
          </div>
        </div>
      </div>
    </div>
  );
};

