//! Documentation portal with searchable manual, shortcuts and security notes.

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

function render(query = ""): void {
  const list = document.getElementById("docs-sections");
  if (!list) return;
  const needle = query.trim().toLowerCase();
  const filtered = sections.filter((section) => {
    const text = `${section.title[language]} ${section.body[language].join(" ")}`.toLowerCase();
    return !needle || text.includes(needle);
  });
  list.innerHTML = filtered.length
    ? filtered
        .map(
          (section) => `<article class="card doc-section" id="docs-${section.id}">
            <p class="eyebrow">${escapeHtml(t("docsManual"))}</p>
            <h2>${escapeHtml(section.title[language])}</h2>
            ${section.body[language].map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          </article>`,
        )
        .join("")
    : `<p class="empty">${escapeHtml(t("docsNoResults"))}</p>`;
}

export function initDocs(): void {
  const view = document.getElementById("view-docs");
  if (!view) return;
  view.innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">${escapeHtml(t("docsEyebrow"))}</p><h2>${escapeHtml(t("docsTitle"))}</h2><p class="subtitle">${escapeHtml(t("docsSubtitle"))}</p></div>
      <label class="search-field"><span class="visually-hidden">${escapeHtml(t("docsSearch"))}</span><input id="docs-search" type="search" placeholder="${escapeHtml(t("docsSearch"))}"></label>
    </div>
    <nav class="doc-nav">${sections.map((section) => `<a href="#docs-${section.id}">${escapeHtml(section.title[language])}</a>`).join("")}</nav>
    <div id="docs-sections" class="doc-sections"></div>`;
  document.getElementById("docs-search")?.addEventListener("input", (event) => {
    render((event.target as HTMLInputElement).value);
  });
  render();
}

export function loadDocs(): void {
  render((document.getElementById("docs-search") as HTMLInputElement | null)?.value ?? "");
}
