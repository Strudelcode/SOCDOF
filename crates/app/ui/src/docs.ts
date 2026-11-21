//! Documentation portal (`view-docs`) of the Tauri webview.
//!
//! A port of the reference `documents/DocumentationApp.tsx` showcase tab: the white portal ribbon
//! with the indigo book tile, the title and its emerald version chip, the six-pill tab bar and the
//! "Integrierte Business-Module im Überblick" section with the 3 x 3 feature grid. Geometry comes
//! from the reference capture (ribbon 58-173, tabs 124-159, cards on the 182/513/843 column grid),
//! not from the Tailwind classes alone. The manual tab keeps the searchable handbook.

import { detectLanguage, translate, type TranslationKey } from "./i18n";

const language = detectLanguage();
const t = (key: TranslationKey): string => translate(language, key);

interface Section {
  id: string;
  title: Record<"de" | "en" | "fr" | "es", string>;
  body: Record<"de" | "en" | "fr" | "es", string[]>;
}

const sections: Section[] = [
  {
    id: "quickstart",
    title: { de: "Schnellstart", en: "Quick start", fr: "Démarrage rapide", es: "Inicio rápido" },
    body: {
      de: [
        "Lege zuerst Kontakte und Artikel an, danach Rechnungen. Die Übersicht zeigt Umsatz, offene Beträge und Nachbestellungen aus der Datenbank.",
        "Alle Beträge werden in ganzen Cent gerechnet; die Anzeige ist nur die formatierte Sicht auf denselben Wert.",
        "Backups liegen standardmäßig im Ordner backups/ neben der Datenbank und können in den Einstellungen geprüft und wiederhergestellt werden.",
      ],
      en: [
        "Create contacts and products first, then invoices. The dashboard shows revenue, open amounts and reorder needs from the database.",
        "All amounts are calculated in integer cents; the display is only a formatted view of the same value.",
        "Backups are written to backups/ beside the database by default and can be verified and restored in Settings.",
      ],
      fr: [
        "Créez d'abord les contacts et les articles, puis les factures. Le tableau de bord affiche le chiffre d'affaires, les montants ouverts et les réapprovisionnements.",
        "Tous les montants sont calculés en centimes entiers ; l'affichage n'est qu'une vue formatée de la même valeur.",
        "Les sauvegardes sont écrites dans backups/ à côté de la base et peuvent être vérifiées et restaurées dans les paramètres.",
      ],
      es: [
        "Crea primero contactos y artículos, después facturas. El panel muestra facturación, importes pendientes y reposiciones desde la base de datos.",
        "Todos los importes se calculan en céntimos enteros; la pantalla solo formatea el mismo valor.",
        "Las copias se guardan en backups/ junto a la base de datos y se pueden verificar y restaurar en Ajustes.",
      ],
    },
  },
  {
    id: "modules",
    title: { de: "Module", en: "Modules", fr: "Modules", es: "Módulos" },
    body: {
      de: [
        "Die Navigation enthält Dashboard, Kontakte, Artikel, Rechnungen, Buchhaltung, Bestellungen, Berichte, Flotte, Projekte, Restaurant, Kalender, Dokumente, Handbuch, Benutzer und Einstellungen.",
        "Die Befehlspalette (Strg+K) durchsucht Module, Aktionen sowie Kontakte, Artikel und Rechnungsnummern.",
        "Rechner, Widgets und Aufgabenansicht sind jederzeit über die Kopfzeile erreichbar.",
      ],
      en: [
        "Navigation contains Dashboard, Contacts, Products, Invoices, Accounting, Purchases, Reports, Fleet, Projects, Restaurant, Calendar, Documents, Manual, Users and Settings.",
        "The command palette (Ctrl+K) searches modules, actions, contacts, products and invoice numbers.",
        "Calculator, widgets and task view are available from the header at any time.",
      ],
      fr: [
        "La navigation contient le tableau de bord, les contacts, les articles, les factures, la comptabilité, les achats, les rapports, la flotte, les projets, le restaurant, le calendrier, les documents, le manuel, les utilisateurs et les paramètres.",
        "La palette de commandes (Ctrl+K) recherche les modules, les actions, les contacts, les articles et les numéros de facture.",
        "Calculatrice, widgets et vue des tâches sont accessibles depuis l'en-tête.",
      ],
      es: [
        "La navegación contiene panel, contactos, artículos, facturas, contabilidad, compras, informes, flota, proyectos, restaurante, calendario, documentos, manual, usuarios y ajustes.",
        "La paleta de comandos (Ctrl+K) busca módulos, acciones, contactos, artículos y números de factura.",
        "Calculadora, widgets y vista de tareas están disponibles desde la cabecera.",
      ],
    },
  },
  {
    id: "shortcuts",
    title: { de: "Tastenkürzel", en: "Keyboard shortcuts", fr: "Raccourcis", es: "Atajos" },
    body: {
      de: [
        "Strg+K öffnet die Befehlspalette, Esc schließt sie.",
        "In Tabellen und Formularen springt Tab zum nächsten Feld; Enter speichert den aktiven Dialog.",
        "Die Aufgabenansicht zeigt alle geöffneten Module und erlaubt den direkten Wechsel.",
      ],
      en: [
        "Ctrl+K opens the command palette, Esc closes it.",
        "In tables and forms Tab moves to the next field; Enter saves the active dialog.",
        "The task view lists every open module and switches directly to it.",
      ],
      fr: [
        "Ctrl+K ouvre la palette de commandes, Échap la ferme.",
        "Dans les tableaux et formulaires, Tab passe au champ suivant ; Entrée enregistre le dialogue actif.",
        "La vue des tâches liste tous les modules ouverts et permet d'y accéder directement.",
      ],
      es: [
        "Ctrl+K abre la paleta de comandos, Esc la cierra.",
        "En tablas y formularios, Tab pasa al siguiente campo; Enter guarda el diálogo activo.",
        "La vista de tareas lista todos los módulos abiertos y permite cambiar directamente.",
      ],
    },
  },
  {
    id: "security",
    title: { de: "Sicherheit", en: "Security", fr: "Sécurité", es: "Seguridad" },
    body: {
      de: [
        "Passwörter werden mit Argon2id gehasht und nie im Klartext gespeichert. Die Benutzerverwaltung schützt den letzten Administrator.",
        "Der Storage Inspector zeigt Datenbankpfad, Größe, Schema-Version und Zeilenanzahlen, ohne Inhalte zu verändern.",
        "Ein vorhandenes Benutzerkonto aktiviert die Anmeldung beim nächsten Start; ohne Konten startet die App im lokalen Einzelplatzmodus.",
      ],
      en: [
        "Passwords are hashed with Argon2id and never stored in plain text. User management protects the last administrator.",
        "The storage inspector shows database path, size, schema version and row counts without changing content.",
        "Existing accounts enable sign-in on the next start; without accounts the app starts in local single-user mode.",
      ],
      fr: [
        "Les mots de passe sont hachés avec Argon2id et jamais stockés en clair. La gestion des utilisateurs protège le dernier administrateur.",
        "L'inspecteur de stockage affiche le chemin, la taille, la version du schéma et le nombre de lignes sans modifier le contenu.",
        "Les comptes existants activent la connexion au prochain démarrage ; sans compte, l'application démarre en mode local.",
      ],
      es: [
        "Las contraseñas se cifran con Argon2id y nunca se guardan en texto plano. La gestión de usuarios protege al último administrador.",
        "El inspector de almacenamiento muestra ruta, tamaño, versión del esquema y número de filas sin modificar el contenido.",
        "Las cuentas existentes activan el inicio de sesión; sin cuentas, la app arranca en modo local.",
      ],
    },
  },
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const ICON: Record<string, string> = {
  book: svg('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  sparkles: svg('<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>'),
  history: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'),
  keyboard: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/>'),
  shield: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'),
  message: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  grid: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'),
  check: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  receipt: svg('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>'),
  users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  card: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
  calculator: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>'),
  layers: svg('<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 12.5-9.17 4.16a2 2 0 0 1-1.66 0L2 12.5"/><path d="m22 17.5-9.17 4.16a2 2 0 0 1-1.66 0L2 17.5"/>'),
  calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/>'),
  hospital: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/>'),
  utensils: svg('<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15z"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>'),
  headphones: svg('<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>'),
  search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
};

interface FeatureCard {
  tone: string;
  icon: string;
  title: string;
  body: string;
  badge: string;
}

const FEATURES: FeatureCard[] = [
  {
    tone: "indigo",
    icon: "receipt",
    title: "DIN 5008 Fakturierung",
    body: "Rechtssichere Rechnungen, individuelle Briefköpfe mit Hintergrundgrafiken, Rabatte, Zahlungsziele und PDF-Export.",
    badge: "GoBD & DIN-A4 konform",
  },
  {
    tone: "teal",
    icon: "users",
    title: "Kontakte & CRM",
    body: "Zentrales Adressbuch für Kunden und Lieferanten, USt-IdNr., Bonität, Zahlungskonditionen und historische Belege.",
    badge: "Vollständige Adressprüfung",
  },
  {
    tone: "violet",
    icon: "card",
    title: "POS Touch-Kasse",
    body: "Schnellkasse für Ladengeschäfte, Touch-Eingabe, Barcode-Scanner-Support, Bar-/Kartenzahlung und Bondruck.",
    badge: "Thermobondruck & Kassenjournal",
  },
  {
    tone: "emerald",
    icon: "calculator",
    title: "Abrechnung & BWA",
    body: "Automatische GoBD-Buchungssätze für Rechnungen und Kasse, Einnahmen-Überschuss-Rechnung (EÜR) und BWA.",
    badge: "Echtzeit-GuV & Steuerausweis",
  },
  {
    tone: "amber",
    icon: "layers",
    title: "Warenwirtschaft & Lager",
    body: "Lagerbestandsführung in Echtzeit, Wareneingang und -ausgang, Mindestbestände und Bestandsbewertung.",
    badge: "Echtzeit-Bestandsabgleich",
  },
  {
    tone: "blue",
    icon: "calendar",
    title: "Kalender & Live Sync",
    body: "Nahtlose Integration von Google Calendar, Anzeige von Rechnungsfälligkeiten, Terminerstellung und Agenda.",
    badge: "Google Calendar & Offline-Agenda",
  },
  {
    tone: "teal",
    icon: "hospital",
    title: "Praxis & Therapie",
    body: "Klientenkartei, strukturierte Sitzungsprotokolle, Notizen, Fahrtenbuch und Abrechnungsentwürfe für Therapeuten.",
    badge: "100% Offline-Klientenarchiv",
  },
  {
    tone: "orange",
    icon: "utensils",
    title: "Gastronomie & Restaurant",
    body: "Interaktiver Tischplan mit Farbstatus, Bon-Druck für Küche/Bar, Gang-Timing und Rechnungs-Splits.",
    badge: "Tischplan & Küchenbons",
  },
  {
    tone: "cyan",
    icon: "headphones",
    title: "Kundendienst & Tickets",
    body: "Ticket-System mit absturzsicherem Live-Timer, Außendienst-Protokollen und Zeiterfassungs-Export.",
    badge: "Live-Timer & Stundenjournal",
  },
];

const TABS: { id: string; label: string; icon: string }[] = [
  { id: "showcase", label: "Showcase & Features", icon: "sparkles" },
  { id: "manual", label: "Handbuch", icon: "book" },
  { id: "releases", label: "Versionen & Updates", icon: "history" },
  { id: "shortcuts", label: "Tastenkürzel", icon: "keyboard" },
  { id: "security", label: "Sicherheit & DSGVO", icon: "shield" },
  { id: "community", label: "Community", icon: "message" },
];

const VERSION = "v25.2.27";

let activeTab = "showcase";

function tabBar(): string {
  return TABS.map(
    (tab) =>
      `<button type="button" class="dp-tab${tab.id === activeTab ? " is-active" : ""}" data-docs-tab="${tab.id}">${ICON[tab.icon]}<span>${escapeHtml(tab.label)}</span></button>`,
  ).join("");
}

function featureGrid(): string {
  return FEATURES.map(
    (card) => `<article class="dp-card">
        <div class="dp-card-icon is-${card.tone}">${ICON[card.icon]}</div>
        <h4 class="dp-card-title">${escapeHtml(card.title)}</h4>
        <p class="dp-card-body">${escapeHtml(card.body)}</p>
        <div class="dp-card-badge">${ICON.check}<span>${escapeHtml(card.badge)}</span></div>
      </article>`,
  ).join("");
}

function manualCards(query: string): string {
  const needle = query.trim().toLowerCase();
  const filtered = sections.filter((section) => {
    const text = `${section.title[language]} ${section.body[language].join(" ")}`.toLowerCase();
    return !needle || text.includes(needle);
  });
  if (!filtered.length) {
    return `<p class="dp-empty">${escapeHtml(t("docsNoResults"))}</p>`;
  }
  return filtered
    .map(
      (section) => `<article class="dp-card dp-card-wide" id="docs-${section.id}">
        <h4 class="dp-card-title">${escapeHtml(section.title[language])}</h4>
        ${section.body[language].map((paragraph) => `<p class="dp-card-body">${escapeHtml(paragraph)}</p>`).join("")}
      </article>`,
    )
    .join("");
}

function tabBody(query: string): string {
  if (activeTab === "manual") {
    const section = sections.filter((entry) => entry.id === activeTab);
    return `<div class="dp-manualbar">
        <label class="dp-search"><span class="visually-hidden">${escapeHtml(t("docsSearch"))}</span>
          <span class="dp-search-icon">${ICON.search}</span>
          <input id="docs-search" type="search" value="${escapeHtml(query)}" placeholder="${escapeHtml(t("docsSearch"))}">
        </label>
      </div>
      <div class="dp-grid dp-grid-manual">${manualCards(query)}</div>${
        section.length ? "" : ""
      }`;
  }
  return `<div class="dp-sectionhead">
      <h3><span class="dp-sectionhead-icon">${ICON.grid}</span><span>Integrierte Business-Module im Überblick</span></h3>
      <span class="dp-local">${ICON.check}<span>100% Lokale Datenhaltung &amp; Offline-Betrieb</span></span>
    </div>
    <div class="dp-grid">${featureGrid()}</div>`;
}

function render(query = ""): void {
  const host = document.getElementById("docs-body");
  if (!host) return;
  host.innerHTML = `<div class="dp-body">${tabBody(query)}</div>`;
  document.getElementById("docs-search")?.addEventListener("input", (event) => {
    render((event.target as HTMLInputElement).value);
    const field = document.getElementById("docs-search") as HTMLInputElement | null;
    if (field) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  });
}

export function initDocs(): void {
  const view = document.getElementById("view-docs");
  if (!view) return;
  view.innerHTML = `<div class="dp-shell">
      <header class="dp-ribbon">
        <div class="dp-brand">
          <div class="dp-brand-tile">${ICON.book}</div>
          <div class="dp-brand-text">
            <div class="dp-brand-line">
              <h2>SOCDOF Portal &amp; Dokumentation</h2>
              <span class="dp-version">${VERSION}</span>
            </div>
            <p class="dp-brand-sub">Offizielles Handbuch, Feature-Showcase, Release-Notes &amp; Architektur</p>
          </div>
        </div>
        <nav class="dp-tabs" id="docs-tabs">${tabBar()}</nav>
      </header>
      <div class="dp-scroll" id="docs-body"></div>
    </div>`;
  document.getElementById("docs-tabs")?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-docs-tab]");
    if (!button) return;
    activeTab = button.dataset.docsTab ?? "showcase";
    const nav = document.getElementById("docs-tabs");
    if (nav) nav.innerHTML = tabBar();
    render();
  });
  render();
}

export function loadDocs(): void {
  render();
}
