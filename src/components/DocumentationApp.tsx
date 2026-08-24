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
  History
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { APP_VERSION, VERSION_HISTORY } from '../lib/version';

interface DocSection {
  id: string;
  title: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  content: React.ReactNode;
}

export const DocumentationApp: React.FC = () => {
  const [activeSectionId, setActiveSectionId] = useState<string>('quickstart');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const docSections: DocSection[] = [
    {
      id: 'quickstart',
      title: 'Schnellstart & Desktop-Konzept',
      category: 'Grundlagen',
      icon: Sparkles,
      summary: 'Überblick über die Windows-Desktop-Oberfläche, Fensterverwaltung und Multi-Tasking.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
            <h4 className="font-bold text-sm text-indigo-900 dark:text-indigo-200 mb-1">
              Willkommen bei SOCDOF (Strudel's Organization, Commerce &amp; Documentation Offline Flow)
            </h4>
            <p className="text-slate-700 dark:text-slate-300">
              Diese Applikation kombiniert die modulare Leistungsfähigkeit eines professionellen ERP-Systems mit der intuitiven Bedienung einer modernen Windows-Desktop-Umgebung.
            </p>
          </div>

          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">Fenstersteuerung & Taskleiste</h5>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li><strong>Fenster verschieben:</strong> Klicken und halten Sie die Titelleiste eines Fensters, um es frei auf dem Desktop zu platzieren.</li>
            <li><strong>Größe anpassen:</strong> Ziehen Sie die untere rechte Ecke jedes Fensters oder doppelklicken Sie auf die Titelleiste für Vollbild.</li>
            <li><strong>Minimieren & Schließen:</strong> Nutzen Sie die Tasten <code>—</code> (Minimieren zur Taskleiste), <code>▢</code> (Maximieren) und <code>✕</code> (Schließen).</li>
            <li><strong>Taskleiste & Startmenü:</strong> Über den Start-Button unten links greifen Sie blitzschnell auf alle Module, Suchfunktionen und das Studio zu.</li>
          </ul>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300">
            <strong>Tipp:</strong> Sie können mehrere Fenster gleichzeitig nebeneinander geöffnet haben, um z.B. Rechnungen zu schreiben und zeitgleich Kundenadressen oder Lagerbestände einzusehen!
          </div>
        </div>
      )
    },
    {
      id: 'invoices',
      title: 'Fakturierung, Rechnungen & DIN 5008',
      category: 'Verkauf & Finanzen',
      icon: Receipt,
      summary: 'Rechnungen erstellen, Belegnummern, Briefkopf mit Hintergrundfoto & DIN 5008 Ausdruck.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">Rechnungserstellung in 4 Schritten</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">1. Kunde auswählen</span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Wählen Sie einen existierenden Kontakt oder legen Sie direkt einen neuen an.</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">2. Positionen & Rabatte</span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Fügen Sie Artikel oder Freitextzeilen hinzu. Steuersätze (19%, 7%, 0%) und Rabatte werden automatisch berechnet.</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">3. Betreff & Zahlungsziel</span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Individuelle Betreffzeile für den Briefkopf und Zahlungsziel (z.B. 14 Tage netto) festlegen.</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">4. Buchen & Drucken</span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Klicken Sie auf <em>Rechnung buchen</em> und anschließend auf <em>Drucken / DIN 5008 PDF</em>.</p>
            </div>
          </div>

          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">Briefkopf mit Hintergrundfoto & Wasserzeichen</h5>
          <p className="text-slate-600 dark:text-slate-300">
            In den <strong>Einstellungen</strong> können Sie ein eigenes Hintergrund-Briefpapier (hochaufgelöstes Bild/Logo/Grafik) hochladen. Beim PDF-Druck wird Ihr Briefpapier exakt passgenau auf DIN-A4 im Hintergrund mit allen gesetzlichen DIN 5008 Elementen und 4-Spalten-Fußzeile gerendert.
          </p>
        </div>
      )
    },
    {
      id: 'contacts',
      title: 'Kontakte & Batch-Import',
      category: 'Stammdaten',
      icon: Users,
      summary: 'Kunden, Lieferanten, Batch-Erstellung und Outlook/CSV/vCard-Import.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            Das Kontaktmodul verwaltet Kunden, Lieferanten und Dienstleister mit Adressen, USt-IdNr., Bankdaten und Kundenhistorie.
          </p>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h6 className="font-bold text-slate-900 dark:text-white mb-1">Mehrfach-Import & Batch-Erstellung</h6>
            <p className="text-slate-600 dark:text-slate-300">
              Über die Buttons <strong>Import (CSV / vCard)</strong> oder <strong>Batch-Erstellung</strong> können Sie beliebig viele Kontakte auf einen Schlag einfügen. Unterstützt werden Standard-Outlook-Dateien, Adressbuch-vCards und CSVs mit Spalten wie Name, E-Mail, Telefon und Firma.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'pos',
      title: 'POS Kasse & Barcode-Scanner',
      category: 'Verkauf & Finanzen',
      icon: CreditCard,
      summary: 'Touch-Kassensystem, Scanner-Unterstützung, Bar-/Kartenzahlung und Bon-Druck.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            Die Point of Sale (POS) Kasse ist für schnelle Thekenverkäufe optimiert:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li><strong>Warenkorb per Klick:</strong> Tippen Sie auf einen Artikel, um ihn dem Beleg hinzuzufügen.</li>
            <li><strong>Barcode-Scanner:</strong> Scannen Sie Barcodes oder EAN-Nummern via USB/Bluetooth-Handscanner.</li>
            <li><strong>Zahlungsarten:</strong> Barzahlung mit automatischer Wechselgeldberechnung, EC-/Kreditkarte oder NFC.</li>
            <li><strong>Thermischer Bon-Druck:</strong> Kompatibel mit 80mm und 58mm POS-Bondruckern.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'accounting',
      title: 'Abrechnungen, BWA & Finanzen',
      category: 'Verkauf & Finanzen',
      icon: Calculator,
      summary: 'Einnahmen-Überschuss-Rechnung (EÜR), BWA-Übersicht, UStVA, Offene Posten & Z-Bon.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            Im Modul <strong>Abrechnungen & Finanzen</strong> erhalten Sie den vollständigen buchhalterischen Überblick über Ihr Unternehmen:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">EÜR & BWA</span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Gegenüberstellung von Umsatzerlösen, Material-/Wareneinsatz und Betriebsergebnis.</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">Umsatzsteuer-Voranmeldung (UStVA)</span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Aufschlüsselung der fälligen Mehrwertsteuer nach 19% und 7% sowie Vorsteuer.</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">Offene Posten & Mahnwesen</span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Überfällige Rechnungen mit Tagen Verzug und 1-Klick-Zahlungseingang.</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">Kassenabschluss (Z-Bon)</span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Tagesabschluss für Barumsätze und Kartenterminal-Umsätze mit Druckansicht.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'appstore',
      title: 'Odoo App Store & Modulverwaltung',
      category: 'System',
      icon: Package,
      summary: 'Module nach Bedarf aktivieren, installieren, anheften oder ausblenden.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            Über den <strong>Odoo App Store</strong> passen Sie Ihr ERP exakt an Ihre Arbeitsweise an:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li><strong>Modul aktivieren/deaktivieren:</strong> Blenden Sie nicht benötigte Module (z.B. POS Kasse oder Einkauf) mit einem Klick aus, um Ihren Desktop übersichtlich zu halten.</li>
            <li><strong>Anheften an Desktop & Taskleiste:</strong> Legen Sie fest, welche Schnellzugriffe direkt auf Ihrem Windows-Desktop angezeigt werden.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'shortcuts',
      title: 'Tastaturkürzel & Schnelltasten',
      category: 'System',
      icon: Keyboard,
      summary: 'Wichtige Tastaturkürzel für maximale Produktivität.',
      content: (
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-medium text-slate-800 dark:text-slate-200">Befehlspalette öffnen</span>
              <kbd className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-[11px] font-bold shadow-xs">
                Strg + K / Cmd + K
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-medium text-slate-800 dark:text-slate-200">Aktives Dokument drucken</span>
              <kbd className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-[11px] font-bold shadow-xs">
                Strg + P / Cmd + P
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-medium text-slate-800 dark:text-slate-200">Fenster maximieren / wiederherstellen</span>
              <kbd className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-[11px] font-bold shadow-xs">
                Doppelklick Titelleiste
              </kbd>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'backups',
      title: 'Backups, Datenschutz & Speicher',
      category: 'Sicherheit',
      icon: ShieldCheck,
      summary: 'Kompakte Backup-Dateien, Speicherplatz-Überwachung und Datenschutz.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <p className="text-slate-600 dark:text-slate-300">
            Ihre Unternehmensdaten werden zu 100% lokal und sicher in Ihrem Browser gespeichert (IndexedDB). Es werden keine sensiblen Kundendaten an externe Dritte übertragen.
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300">
            <strong>Empfehlung zur Datensicherung:</strong> Erstellen Sie regelmäßig über <strong>Einstellungen &gt; Datensicherung</strong> eine separate JSON-Backup-Datei und speichern Sie diese auf einem USB-Stick oder Netzlaufwerk.
          </div>
        </div>
      )
    },
    {
      id: 'community',
      title: 'Open Source & Discord Community Hilfe',
      category: 'Support & Community',
      icon: MessageSquare,
      summary: 'Offizielles Open-Source GitHub Repository & Support ausschließlich auf Discord.',
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 space-y-3">
            <h5 className="font-bold text-sm text-indigo-900 dark:text-indigo-200">
              Open Source Projekt & Community Support
            </h5>
            <p className="text-slate-700 dark:text-slate-300">
              SOCDOF ist ein freies Open-Source-Projekt. Der gesamte Quellcode, Issues, Versionen und Erweiterungen sind transparent auf GitHub verfügbar.
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
                  <span>Hilfe &amp; Support (Discord)</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                  Hilfe ausschließlich auf unserem offiziellen Discord-Server!
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
      title: 'Versionshistorie & Updates',
      category: 'System & Releases',
      icon: History,
      summary: `Aktuelle Version SOCDOF v${APP_VERSION} und alle Release-Highlights.`,
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="flex items-center justify-between p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
            <div>
              <div className="text-[11px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Installierte Version</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white">SOCDOF v{APP_VERSION}</div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
              Aktuell
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
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">Handbuch & Docs</h3>
            <p className="text-[10px] text-slate-500">Offizielle Dokumentation</p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Thema suchen..."
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
