# SOCDOF – TODO-Liste & Arbeitsanweisung

> Diese Datei ist die zentrale Liste für geplante Arbeiten. Erledigte Aufgaben bleiben erhalten und werden abgehakt.

## 1. Arbeitsregeln

### 1.1 Vor jeder Änderung

- Bestehende Architektur und betroffene Module prüfen.
- Relevante Einträge in `versions/` und die zentrale Versionsquelle prüfen.
- Vorhandene i18n-Struktur und alle unterstützten Sprachen berücksichtigen.
- Bei fachlichen, technischen oder sicherheitsrelevanten Unklarheiten zuerst nachfragen.

### 1.2 Aufgabenstatus

- `[ ]` **Offen** – noch nicht umgesetzt.
- `[-]` **Blockiert** – aktuell nicht umsetzbar; darunter den Grund notieren.
- `[x]` **Erledigt** – umgesetzt und geprüft.

Erledigte Aufgaben niemals löschen. Wenn sich eine Lösung ändert, die bestehende Aufgabe ergänzen und die Änderung dokumentieren.

### 1.3 Dokumentation nach Änderungen

Nach jeder abgeschlossenen Änderung:

1. Die passende Versionsdatei unter `versions/` aktualisieren.
2. Bei einer neuen Major-Version eine Datei `versions/V{Major}.md` anlegen.
3. Feature-, Fix- und Patch-Änderungen derselben Major-Version in derselben Datei als eigene Abschnitte ergänzen.
4. Betroffene Bereiche, bekannte Einschränkungen und die Verifizierung dokumentieren.
5. README und zentrale Versionsangaben nur dann ändern, wenn die Änderung tatsächlich release-relevant ist.

`Status.md` beziehungsweise eine vergleichbare Handover-Datei darf den aktuellen Projektzustand beschreiben, ist aber kein Ersatz für die Versionshistorie.

### 1.4 Versionierung

- Die Hauptversion bleibt während einer Entwicklungsreihe fest, zum Beispiel `v19`.
- Feature- und Fix-Versionen dürfen selbstständig erhöht werden, zum Beispiel `v19.1.4`, `v19.3.1` oder `v19.4.0`.
- Eine neue Hauptversion wie `v20` darf nur bei einem bewusst geplanten Major-Release begonnen werden. Sie darf nicht eigenständig aus `v19` abgeleitet werden.
- Wenn ich der Meinung bin, dass aufgrund des Umfangs oder der Bedeutung der Änderungen eine neue Hauptversion sinnvoll wäre, muss ich vorher nachfragen und darf die Hauptversion nicht selbstständig erhöhen.
- Als Versionsschema gilt `Major.Feature.Fix`:
  - **Major** (`19`): Hauptversion der Entwicklungsreihe.
  - **Feature** (`3`): neue Funktionen oder größere Änderungen innerhalb der Hauptversion.
  - **Fix** (`1`): Fehlerbehebungen, kleine Verbesserungen oder Dokumentationskorrekturen.
- Wenn nicht klar ist, ob eine Änderung eine neue Hauptversion rechtfertigt, bei `v19` bleiben und nachfragen.
- `package.json`, zentrale Versionsquelle, README und Release-Dokumentation müssen vor einem Release übereinstimmen.
- Pre-Releases und stabile Releases klar voneinander unterscheiden.

### 1.5 Mehrsprachigkeit

- Neue sichtbare Texte ausschließlich über das vorhandene i18n-System hinzufügen.
- Alle aktuell unterstützten Sprachen berücksichtigen.
- Fehlende Übersetzungen als offen dokumentieren; keine scheinbar fertige Übersetzung vortäuschen.
- Sprachänderungen auf langen Texten, Fehlermeldungen, Tooltips und Dialogen prüfen.

### 1.6 Qualitätssicherung

- Bestehende Projektkonventionen und bereits verwendete Bibliotheken bevorzugen.
- Änderungen möglichst klein und fokussiert halten.
- Nach Codeänderungen mindestens ausführen:
  - `npm run lint`
  - `npm run build`
  - relevante Tests oder manuelle Prüfungen
- Prüfergebnisse und nicht ausführbare Prüfungen in der Versionsdokumentation festhalten.
- Keine Änderungen an Produktionssystemen, externen Konten oder Releases ohne ausdrückliche Freigabe.

### 1.7 Abschluss einer Aufgabe

Eine Aufgabe darf erst als `[x]` markiert werden, wenn:

- die Umsetzung abgeschlossen ist,
- die betroffenen Sprachen berücksichtigt wurden,
- die Dokumentation aktualisiert wurde,
- die relevanten Prüfungen erfolgreich waren oder deren Fehlen begründet ist.

### 🌐 Website / GitHub-Pages-Version

- [ ] **Zoom auf der Website deaktivieren:** Auf der GitHub-Pages-Website (`https://strudelcode.github.io/SOCDOF/`) soll das Heranzoomen per Touchpad, beispielsweise mit einer Zwei-Finger-Geste, deaktiviert werden.
  - [ ] Prüfen, ob das Deaktivieren des Zooms nur für die Website und nicht für die native Electron-App gilt.
  - [ ] Sicherstellen, dass die Bedienbarkeit und Barrierefreiheit der Website dadurch nicht unnötig eingeschränkt werden.

- [ ] **Keine dauerhafte Datenspeicherung auf der Website:** Auf der GitHub-Pages-Version sollen keine Benutzerdaten oder Änderungen dauerhaft gespeichert werden.
  - [ ] Website-Daten dürfen nur temporär während der aktuellen Sitzung verwendet werden.
  - [ ] Änderungen sollen ausschließlich in der installierten beziehungsweise portablen `.exe`-App dauerhaft gespeichert werden.
  - [ ] Prüfen, ob bestehende Speicherung über `localStorage`, IndexedDB, Cookies oder andere Browser-Speicher deaktiviert oder verhindert werden muss.
  - [ ] In der Website deutlich darauf hinweisen, dass die Web-Version keine dauerhafte Speicherung unterstützt und für das Speichern die `.exe`-App verwendet werden muss.
  - [ ] Prüfen, ob Demo-Daten oder Teständerungen beim Neuladen der Website vollständig zurückgesetzt werden.

- [ ] **Seitentitel und Browser-Titel kürzen:** Die GitHub-Pages-Website soll nicht mehr den vollständigen Namen „SOCDOF - Strudel's Organization, Commerce & Documentation Offline Flow“ als Seitentitel anzeigen.
  - [ ] Als sichtbaren Website- beziehungsweise Browser-Titel ausschließlich **„SOCDOF“** verwenden.
  - [ ] Prüfen, ob der lange Name auch in Meta-Tags, PWA-Manifest, Favicon-Beschreibung, Open-Graph-Daten oder anderen Website-Bereichen verwendet wird.
  - [ ] Die vollständige Bedeutung des Namens darf weiterhin in der Dokumentation stehen, soll aber nicht als primärer Seitentitel verwendet werden.

---

## 2. Dokumentationsvorlage für neue Versionen

```md
# SOCDOF – Version v19.x.y

- **Datum:** YYYY-MM-DD
- **Status:** geplant | in Arbeit | veröffentlicht

## Änderungen
- [ ] …

## Betroffene Bereiche
- …

## Bekannte Einschränkungen und Entscheidungen
- …

## Verifizierung
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Relevante Tests oder manuelle Prüfung
```

---

## 3. Nächste Features & UX

### 3.1 Kunden-Support und Dienstleistungen

- [ ] Eine eigene App für Kunden-Support-Leistungen ergänzen.
  - Leistungen mit Datum sowie Start- und Endzeit erfassen.
  - Kunden aus dem Kontaktbuch auswählen.
  - Verknüpfte Kontaktdaten wie E-Mail, Telefonnummer und weitere Details anzeigen.
  - Bearbeiter dokumentieren, wenn mehrere Personen beteiligt sind.
  - Tags oder Stichwörter hinzufügen.
  - Beschreibung und interne Notizen ermöglichen.
  - Arbeitszeit und Zeitaufwand erfassen.
  - Bestehende Kontaktdaten und Abrechnungen sinnvoll verknüpfen.
  - Referenzbild: `todo/kunden_support-dienstleistungen-beispiel.png`

### 3.2 Benutzerdefinierte Zeiträume

- [ ] Benutzerdefinierte Zeiträume im Dashboard ermöglichen.
- [ ] Dieselbe Zeitraumsauswahl bei Abrechnungen und Auswertungen anbieten.
- [ ] Einheitliche Behandlung von Startdatum, Enddatum und Zeitzone sicherstellen.

### 3.3 Startverhalten und Schließen der Desktop-App

- [ ] Prüfen, ob die `.exe` standardmäßig maximiert oder im echten Vollbildmodus starten soll.
- [x] Beim Schließen der App eine Bestätigung anzeigen: „SOCDOF wirklich schließen?“ (Modal mit Beenden, Neustart und Abbrechen)
- [ ] Prüfen, ob die Bestätigung optional in den Einstellungen deaktivierbar sein soll.

### 3.4 Automatische Updates

- [ ] Automatische Suche nach neuen stabilen GitHub-Releases für Electron ergänzen.
- [ ] Pre-Releases standardmäßig ignorieren.
- [ ] Update nur nach ausdrücklicher Zustimmung herunterladen.
- [ ] Nach erfolgreicher Installation einen Neustart anbieten.
- [ ] Festlegen, ob nur Major-Releases wie `v19`/`v20` oder auch stabile Minor-/Patch-Releases angeboten werden.

### 3.5 Kalender-Integration

- [ ] Prüfen, ob eine kostenlose Synchronisierung mit Google Kalender und/oder Microsoft Outlook möglich ist.
- [ ] Datenschutz, Offline-Anforderung, OAuth und notwendige API-Berechtigungen klären.
- [x] Optional einen Kalender beim Klick auf die Uhr unten rechts anzeigen. (Windows 11 Kalender & Agenda Flyout mit Live-Sekunden, Monatsübersicht und Termine/Fälligkeiten)
- [x] Termine, Erinnerungen und Synchronisationsstatus übersichtlich darstellen. (Anzeige von offenen Posten und Fälligkeitsdaten mit 1-Klick-Rechnungsabsprung)

### 3.6 Explorer-Verknüpfung

- [ ] Einen schnellen Zugriff auf den Windows-Explorer ergänzen.
- [ ] Die vorhandene Windows-Ordnerstruktur öffnen, ohne Dateien zu duplizieren.
- [ ] CPU-, GPU-, RAM- und Speicherverbrauch möglichst gering halten.
- [ ] Eine integrierte Dateiansicht nur nach gesonderter Prüfung von Sicherheit und Wartungsaufwand umsetzen.

### 3.7 Erweiterbares Sprachsystem

- [ ] Prüfen, ob beim Erstellen der `.exe` ein Ordner `Languages` mitgeliefert werden soll.
- [ ] Ein einheitliches Sprachdateiformat definieren.
- [ ] Englische Ausgangstexte und Übersetzungen strukturiert ablegen.
- [ ] Neue Sprachdateien automatisch erkennen und in der App anbieten.
- [ ] Flagge, Sprachname und regionale Einstellungen konfigurierbar machen.
- [ ] Fehlende oder ungültige Übersetzungsschlüssel melden.

### 3.8 Regionale Einstellungen

- [ ] Sprach-, Datums- und Zeiteinstellungen in den Einstellungen bündeln.
- [ ] Datumsformate wie `DD.MM.YYYY`, `YYYY-MM-DD` und `MM/DD/YYYY` unterstützen.
- [ ] Uhrzeit mit oder ohne Sekunden anzeigen können.
- [ ] Standardmäßig die Systemzeitzone verwenden.
- [ ] Eine manuelle Zeitzone optional auswählbar machen.
- [ ] Einstellungen in Taskleiste, Dashboard, Kalendern und Abrechnungen konsistent anwenden.

---

## 4. Fehlerbehebungen & offene Punkte

- [x] Der `.exe` ein eigenes SOCDOF-Icon geben; das Standard-Electron-Icon entfernen. (Konfiguriert in `electron-builder.json` und `electron/main.cjs`)
- [x] Beim Start nur den SOCDOF-Startbildschirm anzeigen; nicht automatisch Dashboard oder Übersicht öffnen.
- [x] Bei abgeschnittenen App-Namen nach etwa 0,5–1 Sekunde einen Tooltip mit dem vollständigen Namen anzeigen. (Doppelter nativer OS-Tooltip behoben durch Entfernen der HTML `title`-Attribute)
- [ ] Alle Apps und Buttons auf korrekte Funktion, Zustände, Fehlermeldungen und Tastaturbedienung prüfen.
- [ ] Module miteinander verknüpfen, damit Bestellungen, Leistungen und andere Vorgänge korrekt in Abrechnungen und Monatsauswertungen erscheinen.
- [x] Fehler beheben: Beim Klick auf das Suchfeld im Startmenü darf sich das Startmenü nicht unerwartet schließen.
- [x] Nicht benötigte Schnelloptionen im Startmenü der bereits geöffneten Desktop-App entfernen, zum Beispiel „EXE downloaden“ oder „Windows App“. Referenzbild: `todo/socdof_start_menu_auswahl.png`
- [x] Den Text „odoo Prinzip“ in der Lagerverwaltung entfernen oder durch eine passende SOCDOF-Bezeichnung ersetzen. (Auf `SOCDOF-Prinzip: Doppelte Lagerbuchführung` umgestellt)

---

## 5. Offene Entscheidungen vor der Umsetzung

- [ ] **Kunden-Support:** Nur lokale Erfassung oder zusätzlich E-Mails und Benachrichtigungen? Werden Rollen und Rechte benötigt?
- [ ] **Zeiträume:** Soll die Auswahl gespeichert oder nur temporär verwendet werden?
- [ ] **Startmodus:** Maximiertes Fenster oder echter Vollbildmodus?
- [ ] **Schließen:** Ist eine deaktivierbare Schließen-Bestätigung gewünscht?
- [ ] **Updates:** Nur stabile Major-Releases oder auch stabile Minor-/Patch-Releases? Automatischer Download oder immer vorher fragen?
- [ ] **Kalender:** Google, Microsoft oder beide? Ist eine externe Anmeldung trotz Offline-Grundprinzip akzeptabel?
- [ ] **Explorer:** Nur den Windows-Explorer öffnen oder eine integrierte Dateiansicht entwickeln?
- [ ] **Sprachdateien:** Nur beim Build mitliefern oder auch während der Laufzeit editierbar machen?
- [ ] **Zeit/Region:** Welche zusätzlichen Formate und Zeitzonen werden benötigt?

---

## 6. GitHub & Release-Workflow

- [ ] Vor einem Release fachliche Freigabe und erfolgreiche lokale Prüfungen einholen.
- [ ] Versionsnummern in `package.json`, zentraler Versionsquelle, README und `versions/` abgleichen.
- [ ] GitHub-Actions erst nach erfolgreichem Build und bewusster Release-Entscheidung verwenden.
- [ ] Pre-Release-Tags nicht versehentlich als stabile Version veröffentlichen.
- [ ] Release-Assets und Installationshinweise nach dem Build prüfen.
