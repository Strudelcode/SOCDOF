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
import { useLanguage, t, formatShortcut } from '../lib/i18n';
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

  const getLoc = (dict: { de: string; en: string; fr: string; es: string }) => {
    return dict[currentLang as 'de' | 'en' | 'fr' | 'es'] || dict.en;
  };

  const docSections: DocSection[] = [
    {
      id: 'quickstart',
      title: getLoc({
        de: 'Schnellstart & Desktop-Konzept',
        en: 'Quickstart & Desktop Concept',
        fr: 'Démarrage rapide & Bureau',
        es: 'Inicio rápido y escritorio'
      }),
      category: getLoc({
        de: 'Grundlagen',
        en: 'Fundamentals',
        fr: 'Fondamentaux',
        es: 'Fundamentos'
      }),
      icon: Sparkles,
      summary: getLoc({
        de: 'Überblick über die Windows-Desktop-Oberfläche, Fensterverwaltung und Multi-Tasking.',
        en: 'Overview of the Windows desktop interface, window management, and multi-tasking.',
        fr: 'Aperçu de l’interface de bureau, gestion des fenêtres et multitâche.',
        es: 'Descripción general del escritorio, gestión de ventanas y multitarea.'
      }),
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
            <h4 className="font-bold text-sm text-indigo-900 dark:text-indigo-200 mb-1">
              {getLoc({
                de: "Willkommen bei SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)",
                en: "Welcome to SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)",
                fr: "Bienvenue sur SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)",
                es: "Bienvenido a SOCDOF (Strudel's Organization, Commerce & Documentation Offline Flow)"
              })}
            </h4>
            <p className="text-slate-700 dark:text-slate-300">
              {getLoc({
                de: 'Diese Applikation kombiniert die modulare Leistungsfähigkeit eines professionellen ERP-Systems mit der intuitiven Bedienung einer modernen Windows-Desktop-Umgebung.',
                en: 'This application combines the modular power of a professional ERP suite with the intuitive multi-window usability of a modern Windows desktop workstation.',
                fr: 'Cette application allie la puissance modulaire d’un ERP professionnel à la simplicité d’utilisation d’un bureau Windows moderne.',
                es: 'Esta aplicación combina la potencia modular de un ERP profesional con la usabilidad intuitiva de un escritorio moderno.'
              })}
            </p>
          </div>

          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {getLoc({
              de: 'Fenstersteuerung & Taskleiste',
              en: 'Window Controls & Taskbar',
              fr: 'Contrôle des fenêtres & Barre des tâches',
              es: 'Control de ventanas y barra de tareas'
            })}
          </h5>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li>
              <strong>{getLoc({ de: 'Fenster verschieben: ', en: 'Move Windows: ', fr: 'Déplacer les fenêtres : ', es: 'Mover ventanas: ' })}</strong>
              {getLoc({
                de: 'Klicken und halten Sie die Titelleiste eines Fensters, um es frei auf dem Desktop zu platzieren.',
                en: 'Click and drag the title bar of any window to position it anywhere across the desktop canvas.',
                fr: 'Cliquez et maintenez la barre de titre d’une fenêtre pour la déplacer librement.',
                es: 'Haz clic y mantén pulsada la barra de título de cualquier ventana para moverla libremente.'
              })}
            </li>
            <li>
              <strong>{getLoc({ de: 'Größe anpassen: ', en: 'Resize: ', fr: 'Redimensionner : ', es: 'Redimensionar: ' })}</strong>
              {getLoc({
                de: 'Ziehen Sie die untere rechte Ecke jedes Fensters oder doppelklicken Sie auf die Titelleiste für Vollbild.',
                en: 'Drag the bottom-right corner or double-click the title bar to toggle maximize/restore.',
                fr: 'Tirez sur le coin inférieur droit ou double-cliquez sur la barre de titre pour maximiser.',
                es: 'Arrastra la esquina inferior derecha o haz doble clic en la barra de título para maximizar.'
              })}
            </li>
            <li>
              <strong>{getLoc({ de: 'Minimieren & Schließen: ', en: 'Minimize & Close: ', fr: 'Réduire & Fermer : ', es: 'Minimizar y cerrar: ' })}</strong>
              {getLoc({
                de: 'Nutzen Sie die Tasten — (Minimieren zur Taskleiste), ▢ (Maximieren) und ✕ (Schließen).',
                en: 'Use the standard buttons: — (minimize to taskbar), ▢ (maximize), and ✕ (close window).',
                fr: 'Utilisez les boutons standard : — (réduire dans la barre), ▢ (maximiser) et ✕ (fermer).',
                es: 'Usa los botones estándar: — (minimizar a la barra de tareas), ▢ (maximizar) y ✕ (cerrar).'
              })}
            </li>
            <li>
              <strong>{getLoc({ de: 'Taskleiste & Startmenü: ', en: 'Taskbar & Start Menu: ', fr: 'Barre des tâches & Menu Démarrer : ', es: 'Barra de tareas y menú de inicio: ' })}</strong>
              {getLoc({
                de: 'Über den Start-Button unten links greifen Sie blitzschnell auf alle Module, Suchfunktionen und das Studio zu.',
                en: 'Access all business modules, quick search, system settings, and tools directly via the bottom start menu.',
                fr: 'Accédez à tous les modules métier, à la recherche et aux paramètres depuis le bouton Démarrer en bas.',
                es: 'Accede a todos los módulos comerciales, búsqueda y configuración desde el menú de inicio inferior.'
              })}
            </li>
          </ul>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300">
            <strong>{getLoc({ de: 'Tipp: ', en: 'Pro Tip: ', fr: 'Astuce : ', es: 'Consejo: ' })}</strong>
            {getLoc({
              de: 'Sie können mehrere Fenster gleichzeitig nebeneinander geöffnet haben, um z.B. Rechnungen zu schreiben und zeitgleich Kundenadressen oder Lagerbestände einzusehen!',
              en: 'You can have multiple windows open simultaneously side-by-side to draft invoices while checking stock inventory or customer accounts in real-time!',
              fr: 'Vous pouvez ouvrir plusieurs fenêtres côte à côte pour facturer tout en consultant les stocks ou les contacts en temps réel !',
              es: '¡Puedes tener múltiples ventanas abiertas en paralelo para facturar mientras consultas inventario o clientes en tiempo real!'
            })}
          </div>
        </div>
      )
    },
    {
      id: 'authentication',
      title: getLoc({
        de: 'Authentifizierung & Mehrbenutzer-Sicherheit',
        en: 'Authentication & Multi-User Security',
        fr: 'Authentification & sécurité multi-utilisateur',
        es: 'Autenticación y seguridad multiusuario'
      }),
      category: getLoc({
        de: 'Sicherheit',
        en: 'Security',
        fr: 'Sécurité',
        es: 'Seguridad'
      }),
      icon: ShieldCheck,
      summary: getLoc({
        de: 'Lokale Konten, Passwortschutz, Wiederherstellung, Sperrregeln und Windows-ähnliche Benutzerumschaltung.',
        en: 'Local accounts, password protection, recovery, lockout rules, and Windows-style user switching.',
        fr: 'Comptes locaux, protection par mot de passe, récupération, verrouillage et changement d’utilisateur.',
        es: 'Cuentas locales, protección de contraseñas, recuperación, bloqueos y cambio de usuario.'
      }),
      content: (
        <div className="space-y-5 text-xs leading-relaxed">
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
            <h4 className="font-bold text-sm text-indigo-950 dark:text-indigo-100">
              {getLoc({
                de: 'Lokale Konten statt Cloud-Konten',
                en: 'Local Accounts, No Cloud Identity Required',
                fr: 'Comptes locaux sans identité cloud obligatoire',
                es: 'Cuentas locales sin identidad en la nube'
              })}
            </h4>
            <p className="mt-1 text-slate-700 dark:text-slate-300">
              {getLoc({
                de: 'SOCDOF verwaltet lokale Benutzerprofile offline. Konten und Sicherheitsrichtlinien werden im vorhandenen lokalen IndexedDB-Speicher persistiert; ältere Authentifizierungsdaten aus LocalStorage werden automatisch migriert.',
                en: 'SOCDOF manages local user profiles offline. Accounts and security policies are persisted in the existing local IndexedDB store, with automatic migration of legacy authentication data from LocalStorage.',
                fr: 'SOCDOF gère les profils utilisateurs localement et hors ligne. Les comptes et politiques sont conservés dans IndexedDB, avec migration automatique des anciennes données LocalStorage.',
                es: 'SOCDOF gestiona perfiles locales sin conexión. Las cuentas y políticas se guardan en IndexedDB, con migración automática de datos de autenticación heredados de LocalStorage.'
              })}
            </p>
          </div>

          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            {getLoc({ de: 'Konten & Benutzerwechsel', en: 'Accounts & User Switching', fr: 'Comptes & changement d’utilisateur', es: 'Cuentas y cambio de usuario' })}
          </h4>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li>{getLoc({ de: 'Beim ersten Start wird ein lokales Administratorkonto erstellt. Weitere Konten werden durch einen aktiven Administrator angelegt.', en: 'The first setup creates a local administrator. Additional accounts are created by an active administrator.', fr: 'La première configuration crée un administrateur local. Les comptes supplémentaires sont créés par un administrateur actif.', es: 'La primera configuración crea un administrador local. Las cuentas adicionales las crea un administrador activo.' })}</li>
            <li>{getLoc({ de: 'Persönliche und geschäftliche Kontotypen, Rollen, Aktivierungsstatus, Avatare und persönliche Einstellungen werden pro Benutzer gespeichert.', en: 'Personal and business account types, roles, activation state, avatars, and personal preferences are stored per user.', fr: 'Les types de compte personnel/professionnel, rôles, état d’activation, avatars et préférences sont stockés par utilisateur.', es: 'Los tipos de cuenta personal/empresa, roles, estado, avatares y preferencias se guardan por usuario.' })}</li>
            <li>{getLoc({ de: 'Über „Benutzer verwalten“ können Administratoren Konten aktivieren, deaktivieren, bearbeiten, löschen und Passwörter zurücksetzen.', en: 'The “Manage users” control lets administrators activate, disable, edit, delete accounts, and reset passwords.', fr: '« Gérer les utilisateurs » permet aux administrateurs d’activer, désactiver, modifier, supprimer des comptes et réinitialiser les mots de passe.', es: '“Gestionar usuarios” permite a los administradores activar, desactivar, editar, eliminar cuentas y restablecer contraseñas.' })}</li>
            <li>{getLoc({ de: 'Der letzte aktive Administrator ist vor versehentlichem Löschen oder Deaktivieren geschützt.', en: 'The final active administrator is protected against accidental deletion or deactivation.', fr: 'Le dernier administrateur actif est protégé contre la suppression ou la désactivation accidentelle.', es: 'El último administrador activo está protegido contra eliminación o desactivación accidental.' })}</li>
          </ul>

          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            {getLoc({ de: 'Passwort & Wiederherstellung', en: 'Password & Recovery', fr: 'Mot de passe & récupération', es: 'Contraseña y recuperación' })}
          </h4>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li>{getLoc({ de: 'Passwörter werden mit PBKDF2-HMAC-SHA256 und individuellen Salts gehasht; Klartext-Passwörter werden nicht gespeichert.', en: 'Passwords use PBKDF2-HMAC-SHA256 with per-account salts; plaintext passwords are never persisted.', fr: 'Les mots de passe utilisent PBKDF2-HMAC-SHA256 avec un sel par compte ; aucun mot de passe en clair n’est conservé.', es: 'Las contraseñas usan PBKDF2-HMAC-SHA256 con sales por cuenta; nunca se guardan en texto plano.' })}</li>
            <li>{getLoc({ de: 'Bei der Einrichtung kann eine Wiederherstellungsfrage mit gehashter Antwort hinterlegt werden.', en: 'A recovery question with a hashed answer can be configured during account setup.', fr: 'Une question de récupération avec réponse hachée peut être configurée lors de la création du compte.', es: 'Durante la configuración puede definirse una pregunta de recuperación con respuesta hasheada.' })}</li>
            <li>{getLoc({ de: '„Passwort vergessen?“ führt durch die lokale Wiederherstellung. Administratoren können alternativ ein temporäres Passwort setzen, das beim nächsten Login geändert werden muss.', en: '“Forgot password?” starts the local recovery flow. Administrators can alternatively issue a temporary password that must be changed at the next sign-in.', fr: '« Mot de passe oublié ? » lance la récupération locale. Un administrateur peut aussi définir un mot de passe temporaire à modifier à la prochaine connexion.', es: '“¿Olvidaste la contraseña?” inicia la recuperación local. Un administrador también puede establecer una contraseña temporal que deberá cambiarse en el siguiente inicio.' })}</li>
          </ul>

          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            {getLoc({ de: 'Fehlversuche, Sperre & Auto-Lock', en: 'Failed Attempts, Lockout & Auto-Lock', fr: 'Échecs, verrouillage & verrouillage automatique', es: 'Intentos fallidos, bloqueo y bloqueo automático' })}
          </h4>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
            <li>{getLoc({ de: 'Die Sicherheitsrichtlinie erlaubt konfigurierbare Fehlversuchsgrenzen, Sperrdauer und exponentielle Verlängerung.', en: 'The security policy supports configurable failed-attempt thresholds, lockout duration, and exponential backoff.', fr: 'La politique de sécurité permet de configurer le seuil d’échecs, la durée du verrouillage et le backoff exponentiel.', es: 'La política de seguridad permite configurar umbrales de intentos, duración del bloqueo y backoff exponencial.' })}</li>
            <li>{getLoc({ de: 'Der Sperrbildschirm zeigt den Countdown an und erlaubt einen schnellen Benutzerwechsel.', en: 'The lock screen shows the remaining countdown and supports fast user switching.', fr: 'L’écran verrouillé affiche le compte à rebours et permet de changer rapidement d’utilisateur.', es: 'La pantalla bloqueada muestra la cuenta atrás y permite cambiar rápidamente de usuario.' })}</li>
            <li>{getLoc({ de: 'Die automatische Arbeitsplatzsperre verwendet die pro Benutzer gespeicherte Auto-Lock-Zeit.', en: 'Automatic workstation locking uses the auto-lock duration stored for the current user.', fr: 'Le verrouillage automatique utilise la durée configurée pour l’utilisateur actuel.', es: 'El bloqueo automático usa la duración configurada para el usuario actual.' })}</li>
          </ul>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h5 className="font-bold text-slate-900 dark:text-white">{getLoc({ de: 'Wichtige Schaltflächen', en: 'Key Controls', fr: 'Commandes principales', es: 'Controles principales' })}</h5>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{getLoc({ de: 'Anmelden, Benutzer verwalten, Benutzer wechseln, Sperren, Abmelden, Konto wiederherstellen und Passwort ändern.', en: 'Sign in, Manage users, Switch user, Lock, Sign out, Recover account, and Change password.', fr: 'Se connecter, gérer les utilisateurs, changer d’utilisateur, verrouiller, se déconnecter, récupérer et modifier le mot de passe.', es: 'Iniciar sesión, gestionar usuarios, cambiar usuario, bloquear, cerrar sesión, recuperar cuenta y cambiar contraseña.' })}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h5 className="font-bold text-slate-900 dark:text-white">{getLoc({ de: 'Tastenkürzel & Integration', en: 'Shortcuts & Integration', fr: 'Raccourcis & intégration', es: 'Atajos e integración' })}</h5>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{getLoc({ de: 'Ctrl+Shift+L sperrt den Arbeitsplatz im Browser sicher. Electron kann native Windows-Shortcuts unabhängig davon ergänzen. Die Authentifizierung nutzt den vorhandenen Dexie-Speicher und keine Cloud-Identität.', en: 'Ctrl+Shift+L safely locks the workstation in the browser. Electron can add native Windows shortcuts independently. Authentication uses the existing Dexie store and does not require a cloud identity.', fr: 'Ctrl+Shift+L verrouille le poste dans le navigateur. Electron peut ajouter des raccourcis Windows natifs. L’authentification utilise IndexedDB local sans identité cloud.', es: 'Ctrl+Shift+L bloque el puesto en el navegador. Electron puede añadir atajos nativos de Windows. La autenticación usa IndexedDB local sin identidad en la nube.' })}</p>
            </div>
          </div>
        </div>
      )
    },
    { 
      id: 'invoices',
      title: getLoc({
        de: 'Fakturierung, Rechnungen & DIN 5008',
        en: 'Invoicing, Billing & DIN 5008 Standards',
        fr: 'Facturation & Normes DIN 5008',
        es: 'Facturación y normas DIN 5008'
      }),
      category: getLoc({
        de: 'Verkauf & Finanzen',
        en: 'Sales & Finance',
        fr: 'Ventes & Finances',
        es: 'Ventas y finanzas'
      }),
      icon: Receipt,
      summary: getLoc({
        de: 'Rechnungen erstellen, Belegnummern, Briefkopf mit Hintergrundfoto & DIN 5008 Ausdruck.',
        en: 'Create invoices, voucher numbers, custom stationery with background photos & DIN 5008 print.',
        fr: 'Création de factures, numérotation, en-tête avec image de fond et impression DIN 5008.',
        es: 'Crear facturas, numeración, membrete con imagen de fondo e impresión DIN 5008.'
      }),
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {getLoc({
              de: 'Rechnungserstellung in 4 Schritten',
              en: 'Invoice Generation in 4 Easy Steps',
              fr: 'Création de facture en 4 étapes',
              es: 'Creación de facturas en 4 pasos'
            })}
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {getLoc({ de: '1. Kunde auswählen', en: '1. Select Contact / Customer', fr: '1. Sélectionner un client', es: '1. Seleccionar cliente' })}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {getLoc({
                  de: 'Wählen Sie einen existierenden Kontakt oder legen Sie direkt einen neuen an.',
                  en: 'Choose an existing customer from the address book or create a new contact instantly.',
                  fr: 'Choisissez un client dans le carnet d’adresses ou créez-en un instantanément.',
                  es: 'Elige un cliente de la agenda o crea uno nuevo de inmediato.'
                })}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {getLoc({ de: '2. Positionen & Rabatte', en: '2. Items & Discounts', fr: '2. Lignes & Remises', es: '2. Líneas y descuentos' })}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {getLoc({
                  de: 'Fügen Sie Artikel oder Freitextzeilen hinzu. Steuersätze (19%, 7%, 0%) und Rabatte werden automatisch berechnet.',
                  en: 'Add product catalog items or custom text lines. Tax rates (19%, 7%, 0%) and line discounts calculate automatically.',
                  fr: 'Ajoutez des articles du catalogue ou du texte libre. Les taux de TVA et remises sont calculés automatiquement.',
                  es: 'Añade artículos o texto libre. Las tasas de IVA y descuentos se calculan de manera automática.'
                })}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {getLoc({ de: '3. Betreff & Zahlungsziel', en: '3. Subject & Payment Terms', fr: '3. Objet & Échéance', es: '3. Asunto y vencimiento' })}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {getLoc({
                  de: 'Individuelle Betreffzeile für den Briefkopf und Zahlungsziel (z.B. 14 Tage netto) festlegen.',
                  en: 'Set custom letterhead subjects, performance period, and due date (e.g. 14 days net).',
                  fr: 'Définissez l’objet de l’en-tête, la période et le délai de paiement (ex. 14 jours net).',
                  es: 'Define el asunto del membrete, el período y el plazo de pago (p. ej. 14 días neto).'
                })}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {getLoc({ de: '4. Buchen & Drucken', en: '4. Post & Print', fr: '4. Valider & Imprimer', es: '4. Contabilizar e imprimir' })}
              </span>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {getLoc({
                  de: 'Klicken Sie auf Rechnung buchen und anschließend auf Drucken / DIN 5008 PDF.',
                  en: 'Book the invoice to save it to your records and generate a pixel-perfect DIN 5008 PDF document.',
                  fr: 'Validez la facture pour l’enregistrer et générez un PDF au pixel près conforme DIN 5008.',
                  es: 'Contabiliza la factura para guardarla y genera un documento PDF conforme a DIN 5008.'
                })}
              </p>
            </div>
          </div>

          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {getLoc({
              de: 'Briefkopf mit Hintergrundfoto & Wasserzeichen',
              en: 'Custom Letterhead & Background Stationery',
              fr: 'En-tête personnalisé & Image d’arrière-plan',
              es: 'Membrete personalizado e imagen de fondo'
            })}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {getLoc({
              de: 'In den Einstellungen können Sie ein eigenes Hintergrund-Briefpapier (hochaufgelöstes Bild/Logo/Grafik) hochladen. Beim PDF-Druck wird Ihr Briefpapier exakt passgenau auf DIN-A4 im Hintergrund mit allen gesetzlichen DIN 5008 Elementen und 4-Spalten-Fußzeile gerendert.',
              en: 'In Settings you can upload full-bleed custom letterhead stationery (high-res background image or brand template). PDFs automatically integrate all statutory DIN 5008 standards, address boxes, folding marks, and 4-column bank footers.',
              fr: 'Dans les Paramètres, vous pouvez importer votre propre papier à en-tête. L’impression PDF intègre automatiquement les normes DIN 5008 et le pied de page bancaire à 4 colonnes.',
              es: 'En Configuración puedes subir un membrete personalizado. El PDF integra automáticamente las normas oficiales DIN 5008 y el pie de página bancario de 4 columnas.'
            })}
          </p>
        </div>
      )
    },
    {
      id: 'contacts',
      title: getLoc({
        de: 'Kontakte & CRM',
        en: 'Contacts & CRM Directory',
        fr: 'Contacts & Annuaire CRM',
        es: 'Contactos y directorio CRM'
      }),
      category: getLoc({
        de: 'Kunden & Stammdaten',
        en: 'Customers & Master Data',
        fr: 'Clients & Données de base',
        es: 'Clientes y datos maestros'
      }),
      icon: Users,
      summary: getLoc({
        de: 'Adressbuch, Firmen- und Privatkunden, USt-IdNr., Zahlungsziele und Historie.',
        en: 'Address book, business and private accounts, VAT ID, payment terms, and ledger history.',
        fr: 'Carnet d’adresses, entreprises et particuliers, numéro de TVA et historique.',
        es: 'Agenda, clientes empresariales y particulares, NIF-IVA y condiciones.'
      }),
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {getLoc({
              de: 'Kundenverwaltung & Adressbuch',
              en: 'Customer Directory & Accounts',
              fr: 'Gestion clients & Carnet d’adresses',
              es: 'Gestión de clientes y agenda'
            })}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {getLoc({
              de: 'Pflegen Sie Firmen- und Privatkunden mit lückenlosen Anschriften für das DIN 5008 Adressfenster, Telefonnummern, E-Mail-Adressen und Steuernummern.',
              en: 'Maintain corporate and private customers with complete postal addresses formatted for DIN 5008 envelope windows, phone numbers, email addresses, and VAT IDs.',
              fr: 'Gérez vos clients entreprises et particuliers avec adresses complètes conformes au pliage postal, numéros de téléphone et TVA.',
              es: 'Mantén clientes particulares y empresas con direcciones postales completas para sobres con ventana, teléfonos y NIF-IVA.'
            })}
          </p>
        </div>
      )
    },
    {
      id: 'pos',
      title: getLoc({
        de: 'Kassensystem (POS) & Barcode',
        en: 'Point of Sale (POS) & Barcode Scanning',
        fr: 'Caisse tactile (POS) & Code-barres',
        es: 'TPV Kasse y escaneo de códigos'
      }),
      category: getLoc({
        de: 'Verkauf & Kasse',
        en: 'Sales & Retail POS',
        fr: 'Ventes & Caisse',
        es: 'Ventas y caja'
      }),
      icon: CreditCard,
      summary: getLoc({
        de: 'Touch-Kasse, Barcode-Scanning, Bar- und Kartenzahlung, Kassenbeleg-Druck (Bon).',
        en: 'Touch screen register, barcode scanning, cash and card tender, thermal receipt printer.',
        fr: 'Caisse tactile, scan de codes-barres, paiement espèces/carte et tickets de caisse.',
        es: 'Caja táctil, lectura de códigos de barras, pago en efectivo/tarjeta y recibos térmicos.'
      }),
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {getLoc({
              de: 'POS Kassenbetrieb',
              en: 'POS Cash Register Operations',
              fr: 'Fonctionnement de la caisse POS',
              es: 'Operaciones del terminal TPV'
            })}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {getLoc({
              de: 'Die POS Kasse ermöglicht schnelle Verkäufe per Touch oder USB-Barcodescanner. Kassenbons können thermogedruckt oder als PDF exportiert werden.',
              en: 'The POS register provides lightning-fast checkout via touch grid or barcode scanner. Thermal receipts can be printed or exported directly.',
              fr: 'La caisse POS assure un encaissement ultra-rapide par écran tactile ou lecteur de codes-barres avec impression directe du ticket.',
              es: 'La caja registradora POS permite cobros rápidos mediante panel táctil o escáner USB, con impresión de tickets térmicos.'
            })}
          </p>
        </div>
      )
    },
    {
      id: 'accounting',
      title: getLoc({
        de: 'Buchhaltung, EÜR & Finanzen',
        en: 'Accounting, BWA, Cash Flow & Financials',
        fr: 'Comptabilité, BWA & Finances',
        es: 'Contabilidad, BWA y finanzas'
      }),
      category: getLoc({
        de: 'Finanzen & Steuern',
        en: 'Finance & Tax',
        fr: 'Finances & Fiscalité',
        es: 'Finanzas e impuestos'
      }),
      icon: Calculator,
      summary: getLoc({
        de: 'Automatische Buchungssätze, Einnahmen-Überschuss-Rechnung (EÜR), BWA und DATEV-Export.',
        en: 'Automatic ledger entries, cash-basis accounting, profit and loss, and DATEV export.',
        fr: 'Écritures automatiques, comptabilité de trésorerie, compte de résultat et export.',
        es: 'Asientos automáticos, contabilidad por partida doble, cuenta de resultados y exportación.'
      }),
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {getLoc({
              de: 'Doppelte Buchführung & EÜR',
              en: 'Accounting & Ledger Engine',
              fr: 'Partie double & Journal comptable',
              es: 'Partida doble y libro contable'
            })}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {getLoc({
              de: 'Jede gebuchte Rechnung und jeder Kassenbeleg erzeugt automatisch GoBD-konforme Buchungszeilen für Erlöskonten, Vorsteuer und Umsatzsteuer.',
              en: 'Every posted invoice or POS sale automatically writes compliant double-entry journal rows across revenue, receivables, and VAT liability accounts.',
              fr: 'Chaque facture ou vente validée génère automatiquement des lignes d’écriture pour les produits, créances et TVA.',
              es: 'Cada factura o venta validada genera asientos automáticos conformes para ingresos, clientes y cuentas de IVA.'
            })}
          </p>
        </div>
      )
    },
    {
      id: 'calendar',
      title: getLoc({
        de: 'Kalender & Google Sync',
        en: 'Calendar & Google Sync',
        fr: 'Calendrier & Synchronisation Google',
        es: 'Calendario y sincronización'
      }),
      category: getLoc({
        de: 'Planung & Termine',
        en: 'Planning & Scheduling',
        fr: 'Planning & Rendez-vous',
        es: 'Planificación y citas'
      }),
      icon: Calendar,
      summary: getLoc({
        de: 'Terminkalender mit Google Live Sync, Fälligkeitsterminen und Terminkategorien.',
        en: 'Appointment scheduler with Google Live Sync, invoice due dates, and category views.',
        fr: 'Agenda avec synchronisation Google en temps réel, échéances de factures et vues.',
        es: 'Calendario con sincronización en vivo de Google, vencimientos de facturas y vistas.'
      }),
      content: (
        <div className="space-y-4 text-xs leading-relaxed">
          <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {getLoc({
              de: 'Integrierter Business-Kalender',
              en: 'Integrated Business Calendar',
              fr: 'Calendrier d’entreprise intégré',
              es: 'Calendario empresarial integrado'
            })}
          </h5>
          <p className="text-slate-600 dark:text-slate-300">
            {getLoc({
              de: 'Synchronisieren Sie Termine in Echtzeit mit Google Calendar oder verwalten Sie lokale Zahlungsziele und Kundentermine übersichtlich in Monats- und Wochenansichten.',
              en: 'Sync appointments with Google Calendar or schedule local customer deadlines, invoices, and milestones in full monthly and weekly agenda views.',
              fr: 'Synchronisez vos rendez-vous avec Google Calendar ou gérez vos échéances locales dans des vues mensuelles et hebdomadaires claires.',
              es: 'Sincroniza citas con Google Calendar o gestiona plazos de pago y citas de clientes en vistas mensuales y semanales.'
            })}
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
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3 text-slate-900 dark:text-white flex flex-wrap items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">
                {t('docs.portal_title', currentLang, 'SOCDOF Portal & Dokumentation')}
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('docs.portal_subtitle', currentLang, 'Offizielles Handbuch, Feature-Showcase, Release-Notes & Architektur')}
            </p>
          </div>
        </div>

        {/* Portal Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs overflow-x-auto scrollbar-none">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('showcase');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'showcase' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('docs.tab_showcase', currentLang, 'Showcase & Features')}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('manual');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'manual' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('docs.tab_manual', currentLang, 'Handbuch')}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('releases');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'releases' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t('docs.tab_releases', currentLang, 'Versionen & Updates')}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('shortcuts');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'shortcuts' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>{t('docs.tab_shortcuts', currentLang, 'Tastenkürzel')}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('security');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'security' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('docs.tab_security', currentLang, 'Sicherheit & Offline')}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('community');
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'community' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t('docs.tab_community', currentLang, 'Community')}</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* 1. SHOWCASE & FEATURES TAB */}
        {activeTab === 'showcase' && (
          <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
            {/* Feature Modules Matrix */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>{getLoc({
                    de: 'Integrierte Business-Module im Überblick',
                    en: 'Integrated Business Modules Overview',
                    fr: 'Aperçu des modules métier intégrés',
                    es: 'Módulos de negocio integrados'
                  })}</span>
                </h3>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{getLoc({
                    de: '100% Lokale Datenhaltung & Offline-Betrieb',
                    en: '100% Local Data Sovereignty & Offline Execution',
                    fr: '100% données locales & fonctionnement hors ligne',
                    es: '100% datos locales y funcionamiento sin conexión'
                  })}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Invoices */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-indigo-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {getLoc({
                      de: 'DIN 5008 Fakturierung',
                      en: 'DIN 5008 Invoicing',
                      fr: 'Facturation DIN 5008',
                      es: 'Facturación DIN 5008'
                    })}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {getLoc({
                      de: 'Rechtssichere Rechnungen, individuelle Briefköpfe mit Hintergrundgrafiken, Rabatte, Zahlungsziele und PDF-Export.',
                      en: 'Compliant invoices, custom background letterhead stationery, line discounts, payment terms, and pixel-perfect PDF export.',
                      fr: 'Factures conformes, papier à en-tête personnalisé avec graphisme de fond, remises et export PDF.',
                      es: 'Facturas legales, membrete con gráficos de fondo, descuentos, plazos de pago y exportación a PDF.'
                    })}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{getLoc({ de: 'GoBD & DIN-A4 konform', en: 'Statutory Standards', fr: 'Normes légales DIN-A4', es: 'Conforme a normas oficiales' })}</span>
                  </div>
                </div>

                {/* 2. Contacts CRM */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-teal-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {getLoc({
                      de: 'Kontakte & CRM',
                      en: 'Contacts & CRM',
                      fr: 'Contacts & CRM',
                      es: 'Contactos y CRM'
                    })}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {getLoc({
                      de: 'Zentrales Adressbuch für Kunden und Lieferanten, USt-IdNr., Bonität, Zahlungskonditionen und historische Belege.',
                      en: 'Central master directory for customers and suppliers, VAT IDs, credit terms, and historical sales ledgers.',
                      fr: 'Répertoire centralisé clients et fournisseurs, TVA intracommunautaire, conditions de paiement et historique.',
                      es: 'Directorio maestro de clientes y proveedores, NIF-IVA, solvencia, condiciones de pago e historial.'
                    })}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{getLoc({ de: 'Vollständige Adressprüfung', en: 'Address Verification', fr: 'Vérification d’adresse', es: 'Verificación de dirección' })}</span>
                  </div>
                </div>

                {/* 3. POS Cash Register */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-violet-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-800">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {getLoc({
                      de: 'POS Touch-Kasse',
                      en: 'POS Cash Register',
                      fr: 'Caisse tactile POS',
                      es: 'Caja TPV táctil'
                    })}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {getLoc({
                      de: 'Schnellkasse für Ladengeschäfte, Touch-Eingabe, Barcode-Scanner-Support, Bar-/Kartenzahlung und Bondruck.',
                      en: 'Fast checkout for retail storefronts, touch grid, barcode scanner integration, cash/card tender, and thermal receipts.',
                      fr: 'Encaissement rapide en boutique, saisie tactile, scanner code-barres, espèces/carte et tickets.',
                      es: 'Cobro rápido para tiendas, panel táctil, lector de códigos, efectivo/tarjeta e impresión térmica.'
                    })}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{getLoc({ de: 'Thermobondruck & Kassenjournal', en: 'Thermal Receipts', fr: 'Tickets thermiques', es: 'Tickets de recibo térmico' })}</span>
                  </div>
                </div>

                {/* 4. Accounting & BWA */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-emerald-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {getLoc({
                      de: 'Abrechnung & BWA',
                      en: 'Accounting & Financials',
                      fr: 'Comptabilité & BWA',
                      es: 'Contabilidad y BWA'
                    })}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {getLoc({
                      de: 'Automatische GoBD-Buchungssätze für Rechnungen und Kasse, Einnahmen-Überschuss-Rechnung (EÜR) und BWA.',
                      en: 'Automatic double-entry journal rows for invoices and sales, cash-basis accounting, BWA profit, and tax reporting.',
                      fr: 'Écritures comptables automatisées pour factures et caisse, compte de résultat et états financiers.',
                      es: 'Asientos automáticos para facturas y caja, contabilidad simplificada y cuenta de pérdidas y ganancias.'
                    })}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{getLoc({ de: 'Echtzeit-GuV & Steuerausweis', en: 'Real-time Tax Engine', fr: 'Compte de résultat en temps réel', es: 'Pérdidas y ganancias en tiempo real' })}</span>
                  </div>
                </div>

                {/* 5. Inventory & Stock */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-amber-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {getLoc({
                      de: 'Warenwirtschaft & Lager',
                      en: 'Inventory & Warehouse',
                      fr: 'Gestion des stocks & Entrepôt',
                      es: 'Gestión de inventario y almacén'
                    })}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {getLoc({
                      de: 'Lagerbestandsführung in Echtzeit, Wareneingang und -ausgang, Mindestbestände und Bestandsbewertung.',
                      en: 'Real-time stock ledger, goods receipts and issues, reorder alerts, and valuation metrics.',
                      fr: 'Suivi des stocks en temps réel, entrées et sorties, seuils de réapprovisionnement et valorisation.',
                      es: 'Control de existencias en tiempo real, entradas y salidas, alertas de reposición y valoración.'
                    })}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{getLoc({ de: 'Echtzeit-Bestandsabgleich', en: 'Real-time Tracking', fr: 'Synchronisation des stocks', es: 'Control en tiempo real' })}</span>
                  </div>
                </div>

                {/* 6. Calendar & Google Sync */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-blue-500 transition">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {getLoc({
                      de: 'Kalender & Live Sync',
                      en: 'Calendar & Live Sync',
                      fr: 'Calendrier & Synchronisation',
                      es: 'Calendario y sincronización'
                    })}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {getLoc({
                      de: 'Nahtlose Integration von Google Calendar, Anzeige von Rechnungsfälligkeiten, Terminerstellung und Agenda.',
                      en: 'Seamless Google Calendar synchronization, invoice payment tracking, appointment scheduler, and agenda flyout.',
                      fr: 'Intégration fluide de Google Calendar, échéances de paiement de factures, planification et agenda.',
                      es: 'Sincronización fluida con Google Calendar, vencimientos de facturas, programación de citas y agenda.'
                    })}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{getLoc({ de: 'Google Calendar & Offline-Agenda', en: 'Cloud & Local Calendar', fr: 'Calendrier Cloud & Local', es: 'Calendario en la nube y local' })}</span>
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
                  placeholder={getLoc({
                    de: 'Thema suchen...',
                    en: 'Search documentation...',
                    fr: 'Rechercher un thème...',
                    es: 'Buscar tema...'
                  })}
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
            {/* System Version & Status Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
                    {getLoc({
                      de: '✓ Installiert & Aktiv',
                      en: '✓ Installed & Active',
                      fr: '✓ Installé & Actif',
                      es: '✓ Instalado y activo'
                    })}
                  </span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">SOCDOF Desktop v{APP_VERSION}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {getLoc({
                    de: `SOCDOF Desktop Arbeitsplatz v${APP_VERSION}`,
                    en: `SOCDOF Desktop Workstation v${APP_VERSION}`,
                    fr: `Station de travail SOCDOF v${APP_VERSION}`,
                    es: `Estación de trabajo SOCDOF v${APP_VERSION}`
                  })}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
                  {getLoc({
                    de: '100% Offline-ERP-Betrieb aktiv. Ihre Datenbank, Rechnungen und Kundenprofile verbleiben sicher und lokal auf Ihrem Computer.',
                    en: '100% offline ERP operation active. Your database, invoices, and customer records remain secure and private on your local machine.',
                    fr: 'Fonctionnement ERP 100% hors ligne actif. Vos données, factures et fichiers restent sécurisés localement sur votre machine.',
                    es: 'Operación ERP 100% fuera de línea activa. Tu base de datos, facturas y registros permanecen seguros localmente en tu equipo.'
                  })}
                </p>
              </div>

              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs shadow-xs flex items-center gap-2 shrink-0 transition"
              >
                <Github className="w-4 h-4" />
                <span>{getLoc({
                  de: 'Releases & Changelog (GitHub)',
                  en: 'Releases & Changelog (GitHub)',
                  fr: 'Notes de version (GitHub)',
                  es: 'Notas de versión (GitHub)'
                })}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
            </div>

            {/* Version History Changelog */}
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{getLoc({
                  de: 'Versionshistorie & Release Notes',
                  en: 'Release History & Changelog',
                  fr: 'Historique des versions & Changelog',
                  es: 'Historial de versiones y notas'
                })}</span>
              </h3>

              <div className="space-y-3">
                {VERSION_HISTORY.map((rel) => (
                  <div key={rel.version} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
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
                <span>{getLoc({
                  de: 'Tastaturkürzel & Schnellnavigation',
                  en: 'Keyboard Shortcuts & Quick Navigation',
                  fr: 'Raccourcis clavier & Navigation rapide',
                  es: 'Atajos de teclado y navegación'
                })}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {getLoc({
                  de: 'Steuern Sie die gesamte Desktop-Umgebung noch schneller über die Tastatur.',
                  en: 'Control the entire desktop workspace swiftly using keyboard shortcuts.',
                  fr: 'Contrôlez l’ensemble du bureau rapidement grâce aux raccourcis clavier.',
                  es: 'Controla el entorno de escritorio rápidamente mediante atajos de teclado.'
                })}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* General Shortcuts */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {getLoc({
                    de: 'System & Desktop',
                    en: 'System & Desktop',
                    fr: 'Système & Bureau',
                    es: 'Sistema y escritorio'
                  })}
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">
                      {getLoc({
                        de: 'Spotlight Befehlspalette öffnen',
                        en: 'Open Spotlight Command Palette',
                        fr: 'Ouvrir la palette de commandes',
                        es: 'Abrir paleta de comandos'
                      })}
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {formatShortcut('Ctrl+K', currentLang).split('+')[0] || 'Ctrl'}
                      </kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">K</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">
                      {getLoc({
                        de: 'Startmenü öffnen / schließen',
                        en: 'Toggle Start Menu',
                        fr: 'Afficher / Masquer le menu Démarrer',
                        es: 'Alternar menú de inicio'
                      })}
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Win</kbd>
                      <span className="text-slate-400">/</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {formatShortcut('Ctrl+Space', currentLang)}
                      </kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">
                      {getLoc({
                        de: 'Handbuch & Showcase öffnen',
                        en: 'Open Documentation & Showcase',
                        fr: 'Ouvrir le manuel & Showcase',
                        es: 'Abrir documentación y showcase'
                      })}
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">F1</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">
                      {getLoc({
                        de: 'Vollbildmodus umschalten (bis zu den Rändern)',
                        en: 'Toggle Fullscreen Mode (Edge-to-Edge)',
                        fr: 'Basculer en plein écran (Sans bordures)',
                        es: 'Alternar pantalla completa (Borde a borde)'
                      })}
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">F11</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">
                      {getLoc({
                        de: 'Aktives Fenster / Modal schließen',
                        en: 'Close Active Modal / Window',
                        fr: 'Fermer la fenêtre / modal actif',
                        es: 'Cerrar ventana o modal activo'
                      })}
                    </span>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">Esc</kbd>
                  </div>
                </div>
              </div>

              {/* Taskbar Apps Shortcuts */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {getLoc({
                    de: 'Taskleisten-Apps starten',
                    en: 'Launch Taskbar Apps',
                    fr: 'Lancer les applications de la barre',
                    es: 'Iniciar aplicaciones de la barra'
                  })}
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">
                      {getLoc({
                        de: 'App 1 auf Taskleiste öffnen',
                        en: 'Open Taskbar App 1',
                        fr: 'Ouvrir l’application 1 de la barre',
                        es: 'Abrir aplicación 1 de la barra'
                      })}
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Alt</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">1</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">
                      {getLoc({
                        de: 'App 2 auf Taskleiste öffnen',
                        en: 'Open Taskbar App 2',
                        fr: 'Ouvrir l’application 2 de la barre',
                        es: 'Abrir aplicación 2 de la barra'
                      })}
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Alt</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">2</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">
                      {getLoc({
                        de: 'App 3 auf Taskleiste öffnen',
                        en: 'Open Taskbar App 3',
                        fr: 'Ouvrir l’application 3 de la barre',
                        es: 'Abrir aplicación 3 de la barra'
                      })}
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Alt</kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">3</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">
                      {getLoc({
                        de: 'Apps 4 bis 9 öffnen',
                        en: 'Open Apps 4 to 9',
                        fr: 'Ouvrir les applications 4 à 9',
                        es: 'Abrir aplicaciones 4 a 9'
                      })}
                    </span>
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
                  {getLoc({
                    de: '100% Lokale Datenhoheit & Zero-Cloud-Architektur',
                    en: '100% Local Data Sovereignty & Zero-Cloud Architecture',
                    fr: '100% Souveraineté des données & Zéro Cloud',
                    es: '100% Soberanía de datos y arquitectura sin nube'
                  })}
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-200/90 leading-relaxed">
                  {getLoc({
                    de: 'SOCDOF speichert alle Stammdaten, Rechnungen, Kundenprofile und Finanzbuchungen ausschließlich auf Ihrem lokalen Computer. Keine Übertragung an externe Server, kein Tracking, DSGVO-konform by Design.',
                    en: 'SOCDOF stores all master data, invoices, customer records, and ledger balances exclusively on your local device. No external tracking or unsolicited cloud telemetry.',
                    fr: 'SOCDOF stocke l’ensemble des données, factures et écritures comptables exclusivement sur votre ordinateur. Aucun transfert vers des serveurs tiers, conforme RGPD dès la conception.',
                    es: 'SOCDOF guarda todos los datos maestros, facturas y balances contables exclusivamente en tu equipo local. Sin servidores externos ni telemetría no solicitada.'
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-indigo-500" />
                  <span>{getLoc({
                    de: 'Lokale Speicherung',
                    en: 'Local Storage Engine',
                    fr: 'Stockage local',
                    es: 'Almacenamiento local'
                  })}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  {getLoc({
                    de: 'Dauerhafte Persistenz via lokaler Datenbank und JSON-Backups. Sie behalten die volle Kontrolle über Ihre Dateien.',
                    en: 'Permanent offline database persistence with comprehensive JSON export and restore capabilities.',
                    fr: 'Persistance locale permanente avec fonctionnalités de sauvegarde et restauration JSON complètes.',
                    es: 'Persistencia local permanente con capacidades completas de copia de seguridad y restauración en JSON.'
                  })}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  <span>{getLoc({
                    de: 'DSGVO & Datenschutz',
                    en: 'GDPR & Privacy',
                    fr: 'RGPD & Confidentialité',
                    es: 'RGPD y privacidad'
                  })}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  {getLoc({
                    de: 'Erfüllt höchste Datenschutzstandards, da keine personenbezogenen Daten an Dritte übermittelt werden.',
                    en: 'Meets strict data privacy requirements as zero personal data leaves your local machine.',
                    fr: 'Répond aux normes strictes de confidentialité sans fuite de données personnelles.',
                    es: 'Cumple con estrictos requisitos de privacidad sin transferir datos personales a terceros.'
                  })}
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
                <span>{t('docs.community_title', currentLang, 'Open Source Projekt & Community Support')}</span>
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {t('docs.community_desc', currentLang, 'SOCDOF ist ein freies Open-Source-Projekt. Quellcode, Issues, Versionen und Erweiterungen werden offen auf GitHub gepflegt. Treten Sie unserer Discord-Community bei.')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* GitHub Card */}
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 transition flex items-start gap-3.5 group shadow-xs"
              >
                <div className="p-3 rounded-xl bg-slate-900 text-white shrink-0 shadow-xs">
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
                className="p-5 rounded-2xl bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 transition flex items-start gap-3.5 group shadow-xs"
              >
                <div className="p-3 rounded-xl bg-[#5865F2] text-white shrink-0 shadow-md">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-[#5865F2] dark:text-indigo-300">
                    <span>{t('docs.discord_title', currentLang, 'Hilfe & Support (Discord)')}</span>
                    <ExternalLink className="w-4 h-4 opacity-60" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {t('docs.discord_desc', currentLang, 'Erhalten Sie Hilfe aus der Community und diskutieren Sie neue Features auf unserem offiziellen Discord-Server!')}
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
