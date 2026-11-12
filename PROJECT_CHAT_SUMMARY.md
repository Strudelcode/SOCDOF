# SOCDOF – Vollständige Projekt- & Chat-Zusammenfassung (Handover Document)

> **Zweck dieses Dokuments:** Dieses Dokument fasst den gesamten aktuellen Stand, die Historie, die getroffenen Architektur-Entscheidungen, die Arbeitsregeln und die technischen Details der ERP-Suite **SOCDOF** zusammen. Es dient als vollständiger Kontext für eine neue KI oder ein neues AI-Studio-Projekt.

---

## 1. Projekt-Überblick: Was ist SOCDOF?
**SOCDOF** ist eine vollwertige, modulare **ERP-, Kassen-, CRM-, Lager- und Werkstatt-Suite** mit strikter **lokaler Datenhoheit (Offline-First)**.
* **Zielgruppe:** Handwerksbetriebe, Werkstätten, Handel, Dienstleister und kleine bis mittlere Unternehmen.
* **Kernprinzip:** Keine Cloud-Abhängigkeit, alle Daten verbleiben lokal beim Kunden (SQLite mit FTS5-Volltextsuche), blitzschnelle Bedienung, 0 Mock-Daten.
* **Sprachen:** 100% viersprachig ab Werk (**Deutsch `de`**, **Englisch `en`**, **Französisch `fr`**, **Spanisch `es`**).

---

## 2. Aktueller Stand der TypeScript/Electron-Anwendung (Version 25.2.0)
Die primäre Produktions-Applikation in diesem Repository basiert auf React 18, Vite, TypeScript, Tailwind CSS und Electron:

* **Aktuelle Version:** `25.2.0` (synchron in `package.json`, `src/lib/version.ts`, `versions/V25.md` und `todo/completed_todo.md`).
* **Verifizierungs-Status:** 
  * `npm run lint` (`tsc --noEmit`): **0 Fehler / PASSED**
  * `npm run build` (`vite build`): **PASSED**
  * `npm run test:auth`: **PASSED** (alle Authentifizierungs- und Rollen-Regressionstests bestanden).

### Kürzlich implementierte Kern-Features (v25.1.0 – v25.2.0):
1. **Einzel-PC & Werkstatt-Modus (Single-PC Workstation Mode):**
   * Entwickelt für Betriebe, an denen mehrere Mitarbeiter denselben Computer teilen.
   * **1-Klick-Benutzerwechsel:** Mitarbeiter/Sub-User können ohne Passworteingabe sekundenschnell wechseln.
   * **Strikter Administrator-Schutz:** Administratoren müssen zwingend ein Passwort eingeben und können nicht passwortlos geschaltet werden.
   * **Sicherheits-Wiederherstellungsfrage:** Jeder Benutzer richtet beim ersten Login eine persönliche Sicherheitsfrage ein (`RECOVERY_QUESTIONS` in `src/lib/auth.ts`), um den Account im Notfall wiederherzustellen.
   * **Eigen-Reset-Schutz:** Ein eingeloggter Administrator sieht an seinem eigenen Account keine Reset-Buttons für Passwörter/Sicherheitsfragen.
2. **Granulare Rollenverwaltung (Custom Roles):**
   * Frei definierbare Rollen mit exakter Zuweisung von Modul-Berechtigungen (`canUserAccessModule()`).
   * Sperrt unbefugte Apps sowohl im Fenstermanager (`DesktopWindowWorkspace.tsx`) als auch in der Schnellsuche (`CommandPaletteModal.tsx`).
3. **Workspace & Ergonomie:**
   * Einstellungs-Ansicht auf moderne `max-w-[1780px]` erweitert inklusive optimiertem Scroll-Padding.
   * Echtes Multi-Window-System mit minimierbaren, maximierbaren und kachelbaren Fenstern.
   * Dynamisches Anti-Clash-Farbsystem (`var(--accent)` und `var(--accent-companion)` via `getContrastingCompanionColor` in `src/lib/accent.ts`).

---

## 3. Der parallele Rust-Rewrite (Branch `rust-rewrite`)
In parallelen Sitzungen wurde eine vollständige Portierung von SOCDOF auf **100% natives Rust** vorangetrieben:

* **Ziel:** Wegfall von Chromium/Node.js/Electron-Overhead.
* **GUI-Framework:** `egui` + `eframe` (Rendering per Hardware-beschleunigtem WGPU/OpenGL, Frame-Times bei 0.10–0.20 ms selbst bei 50.000 Kontakten / 100.000 Rechnungen).
* **Datenbank:** `rusqlite` (lokales SQLite mit vorkompiliertem FTS5, Triggern und Schema-Migrationen v1–v12).
* **WASM/Web:** Ein `crates/web`-Paket mit `Trunk` und `IndexedDB`-Persistenz für Web-Demos/Vorschauen.
* **Kennzahlen-Vergleich:**
  * **TypeScript-App:** ca. 119.744 Zeilen Code (81k TSX, 33k TS).
  * **Rust-App:** ca. 75.000 Zeilen kompakter, typsicherer Rust-Code.
  * **Installer-Größe:** ≤ 15 MB (statt ca. 85–120 MB bei Electron).
  * **Kaltstart:** 144–248 ms (statt 1.5–3.5 s bei Electron).
  * **RAM-Verbrauch:** ca. 25–45 MB (statt 180–350 MB bei Chromium/Electron).
* **Status des Rewrites (Stand Commit `5b90873` / `RUST_MIGRATION.md`):**
  * ~99% fertig (Phasen 1 bis 9 abgeschlossen).
  * Die Kernmodule (Finanzen, Lager, Werkstatt, Kasse, Kontakte, Einstellungen, SQLite-Engine) sind fertig portiert.
  * Kompatibilität: Der `.socdof.json` Backup-Export/Import ist zwischen beiden Versionen identisch.

---

## 4. Wichtige Themen & Klärungen aus den jüngsten Chats
1. **Zotero vs. Zoho vs. SOCDOF:**
   * Es gab eine kurze Namensverwechslung: Der Nutzer fragte nach *„Zotero“*, meinte aber die ERP-Suite **SOCDOF** (bzw. im Marktvergleich **Zoho**).
   * *Zotero* ist ein Open-Source Zitiermanager (kein ERP).
   * *SOCDOF* ist die vollständige ERP-Suite mit Rechnungen, Mahnwesen, Lager, Werkstatt, POS, Kassenbuch, Zeiterfassung und Rollen.
2. **KI-Vergleich (Gemini 3.8 Flash vs. DeepSeek V4.1 Flash Fast):**
   * *DeepSeek Flash Fast:* Brutale Schreibgeschwindigkeit für kurze, isolierte Codeblöcke & Algorithmen.
   * *Gemini 3.8 Flash:* Enormes Kontextfenster (1–2 Mio. Tokens), behält das gesamte 120k-Zeilen-Projekt im Kopf, unschlagbar bei Refactorings über 20+ Dateien hinweg und im autonomen Agenten-Modus.

---

## 5. Verbindliche Entwicklungsregeln für AI-Agenten (`RULE[AGENTS_md]`)
Jede KI, die an diesem Projekt arbeitet, **MUSS** folgende Regeln strikt einhalten:

1. **Sprachen & Dokumentation:**
   * Alle technischen Dokumentationen, Release-Einträge (`versions/V*.md`), Code-Kommentare und Architektur-Notizen werden auf **Englisch** verfasst.
   * Alle Benutzeroberflächen-Texte (Labels, Dialoge, Buttons, Fehlermeldungen) **MÜSSEN zwingend in allen 4 Sprachen** in `src/lib/i18n.ts` gepflegt werden (`de`, `en`, `fr`, `es`). Keine hardcodierten Strings in Komponenten!
2. **Keine Mock- / Dummy-Daten:**
   * Niemals künstliche Beispieldaten, Fake-Tickets oder Dummy-Kunden in Module vorladen.
   * Immer saubere, intuitive Empty-States mit Direkterstellung anbieten.
3. **Versionierung & Release-Notes:**
   * Vor dem Abschluss von Feature-Änderungen: Patch- bzw. Minor-Version erhöhen (`package.json`, `src/lib/version.ts`, `versions/V25.md`).
   * Niemals eigenmächtig eine neue Major-Version (z. B. `26.0.0`) starten ohne explizite Nutzerfreigabe.
4. **Changelog-System (`CHANGELOG.md`):**
   * Änderungen werden strukturiert gesammelt (Deutsch: 🚀 Neu / 🔄 Geändert / 🛠️ Behoben).
   * Keine ausschweifenden CSS-Aufsätze, sondern knackige, nutzerorientierte Zusammenfassungen.
5. **Aufgabenverwaltung:**
   * Offene Aufgaben verbleiben in `todo/todo.md`.
   * Fertiggestellte Aufgaben wandern nach `todo/completed_todo.md`.
6. **Farb- & Kontrast-System:**
   * Farben müssen dynamisch von `var(--accent)` und der Kontrastfarbe `var(--accent-companion)` (via `getContrastingCompanionColor` in `src/lib/accent.ts`) abgeleitet werden. Keine Farbkollisionen in Charts oder Statusanzeigen.
7. **Qualitätsprüfung:**
   * Vor Abschluss immer `npm run lint` (`tsc --noEmit`) und `npm run build` (`vite build`) prüfen.

---

## 6. Dateien-Übersicht im Workspace
* `src/`: Der gesamte TypeScript/React-Frontend- und Logik-Code.
* `src/lib/i18n.ts`: Das 4-Sprachen-Übersetzungssystem.
* `src/lib/auth.ts`: Benutzerkonten, Custom Roles, Werkstatt-Modus, Sicherheitsfragen.
* `src/components/DesktopWindowWorkspace.tsx`: Der Desktop-Fenster-Manager.
* `src/components/UserManagementSettings.tsx`: Verwaltung von Benutzern, Passwörtern und Berechtigungen.
* `electron/`: Electron-Main- und Preload-Scripts für den Windows/Desktop-Build.
* `versions/`: Vollständiges Versionsarchiv (V1 bis V25.md).
* `todo/`: Offene und archivierte Meilensteine.
* `RUST_MIGRATION.md` (bzw. Asset): Detaillierter Migrationsplan für den nativen Rust-Core (`egui` + `rusqlite`).
