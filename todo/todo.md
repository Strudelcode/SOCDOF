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
- Feature-, Minor- und Patch-Versionen dürfen flexibel nach Umfang erhöht werden, zum Beispiel `v19.1.0`, `v19.1.5` oder `v19.2.0`.
- Eine neue Hauptversion wie `v20` darf nur bei einem bewusst geplanten Major-Release begonnen werden. Sie darf nicht eigenständig aus `v19` abgeleitet werden.
- Wenn ich der Meinung bin, dass aufgrund des Umfangs oder der Bedeutung der Änderungen eine neue Hauptversion sinnvoll wäre, muss ich vorher nachfragen und darf die Hauptversion nicht selbstständig erhöhen.
- Als Versionsschema gilt `Major.Minor.Patch`:
  - **Major** (`19`): Hauptversion der Entwicklungsreihe.
  - **Minor** (`1`): Neue Funktionsmodule, wesentliche Erweiterungen oder UX-Erneuerungen.
  - **Patch** (`0` / `5`): Fehlerbehebungen, Detailverbesserungen oder Dokumentationskorrekturen.
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

## 3. Features, Module & UX-Roadmap

### 3.1 Kunden-Support und Dienstleistungen
- [x] Eine eigene App für Kunden-Support-Leistungen ergänzen. (SupportServicesModule mit Ticketverwaltung, Stundensätzen und Status)
  - [x] Leistungen mit Datum sowie Start- und Endzeit erfassen. (Automatische Berechnung der Einsatzdauer)
  - [x] Kunden aus dem Kontaktbuch auswählen. (Verknüpfung mit CRM Kontakten)
  - [x] Verknüpfte Kontaktdaten wie E-Mail, Telefonnummer und weitere Details anzeigen.
  - [x] Bearbeiter dokumentieren, wenn mehrere Personen beteiligt sind. (Zuständiger Mitarbeiter)
  - [x] Tags oder Stichwörter hinzufügen. (Farbige Tags wie `#Vor-Ort`, `#Netzwerk`, `#Remote`)
  - [x] Beschreibung und interne Notizen ermöglichen. (Getrennte Kunden- und Intern-Felder)
  - [x] Arbeitszeit und Zeitaufwand erfassen. (Stundensatz & geschätzte Summe)
  - [x] Bestehende Kontaktdaten und Abrechnungen sinnvoll verknüpfen.
  - Referenzbild: `todo/kunden_support-dienstleistungen-beispiel.png`

### 3.2 Benutzerdefinierte Zeiträume
- [x] Benutzerdefinierte Zeiträume im Dashboard ermöglichen. (Filter für Gesamt, Heute, Monat, Quartal, Jahr und Benutzerdefiniert mit Start-/Enddatum)
- [x] Dieselbe Zeitraumsauswahl bei Abrechnungen und Auswertungen anbieten. (BWA, UStVA und CSV-Export synchronisiert)
- [x] Einheitliche Behandlung von Startdatum, Enddatum und Zeitzone sicherstellen.

### 3.3 Intelligente Lager- & Produktverwaltung mit Link-Import
- [x] **Erweiterte Lager- und Produktverwaltung (SOCDOF Lagerbestand):** (Übersicht aller Bestände und Zuweisungen)
  - [x] Übersicht aller Artikel mit aktuellem Lagerbestand, Mindestbestand, Reservierungen und Zuordnungen (an welche Kunden/Aufträge Produkte vergeben oder geliefert wurden).
- [x] **Optionaler Produkt-Weblink (z. B. Amazon, Lieferanten-Shop oder Hersteller-URL):** (productLinkExtractor mit Shop-Erkennung)
  - [x] Ein optionales URL-Eingabefeld beim Erstellen und Bearbeiten von Produkten hinzufügen.
  - [x] Automatische Erkennung und Extrahieren relevanter Produktdaten aus dem Link (Titel/Bezeichnung, Preis der Region/Währung, Kategorie, Artikelbild, Händler/Domain-Favicon).
  - [x] Alle automatisch übernommenen Felder (Titel, Preis, Beschreibung, Bild) bleiben vor dem Speichern frei editier- und anpassbar.
- [x] **Produktbild-Vorschau & Bild-Upload:**
  - [x] Live-Preview / Favicon / Produkt-Icon anhand des Links oder Produkt-Emojis.
  - [x] Möglichkeit, ein eigenes Produktbild hochzuladen (lokaler Bild-Upload / Base64-Speicherung in IndexedDB).
- [x] **Kunden-Zuweisung & Nachverfolgung:**
  - [x] Aus dem Lager direkt einsehen, welche Bestände an welche Kunden (Rechnungen, Lieferscheine, Aufträge) vergeben wurden.

### 3.4 Modul-Verknüpfungen & Einheitliche App-Namen
- [x] **Einheitliche, prägnante App-Namen vergeben:**
  - [x] Einheitliche Namen ohne überflüssiges Doppel-Naming (`Dashboard`, `Rechnungen`, `Abrechnung`, `Kontakte`, `Produkte`, `Lager`, `Einkauf`, `POS Kasse`, `Restaurant`, `Support`, `Schnellkasse`, `App Store`, `Handbuch`, `Einstellungen`).
  - [x] In allen 4 Sprachen (DE, EN, FR, ES) konsistent harmonisiert.
- [x] **Inter-App-Verknüpfungen (Dashboard <-> Abrechnung <-> Lager <-> Rechnungen):**
  - [x] Klickbare Kennzahlenkarten im Dashboard mit direktem Absprung in die zuständigen Module (Gesamtumsatz -> Abrechnung, Offene Forderungen -> Rechnungen, Lagerwert -> Lager, Produkte -> Katalog).
  - [x] Akustisches Klick-Feedback und visuelle Hover-Effekte mit Pfeil-Indikatoren.

### 3.5 Regionale Einstellungen & Kalender
- [x] Sprach-, Datums- und Zeiteinstellungen in den Einstellungen bündeln. (Sprache, Währung, Datumsformate, Zeitzone und Sekunden-Schalter unter Einstellungen -> Sprache & Region)
- [x] Datumsformate wie `DD.MM.YYYY`, `YYYY-MM-DD` und `MM/DD/YYYY` unterstützen.
- [x] Uhrzeit mit oder ohne Sekunden anzeigen können. (Umschalter für Taskleistenuhr)
- [x] Windows 11 Kalender & Agenda Flyout mit Live-Sekunden, Monatsübersicht und Termine/Fälligkeiten mit 1-Klick-Absprung.

### 3.6 Startverhalten und Schließen der Desktop-App
- [ ] Prüfen, ob die `.exe` standardmäßig maximiert oder im echten Vollbildmodus starten soll.
- [x] Beim Schließen der App eine Bestätigung anzeigen: „SOCDOF wirklich schließen?“ (Modal mit Beenden, Neustart und Abbrechen)
- [ ] Prüfen, ob die Bestätigung optional in den Einstellungen deaktivierbar sein soll.

### 3.7 Automatische Updates & Externe Synchronisation
- [ ] Automatische Suche nach neuen stabilen GitHub-Releases für Electron ergänzen.
- [ ] Update nur nach ausdrücklicher Zustimmung herunterladen.
- [ ] Prüfen, ob eine kostenlose Synchronisierung mit Google Kalender und/oder Microsoft Outlook möglich ist.

### 3.8 Explorer-Verknüpfung & Sprachdateien
- [ ] Einen schnellen Zugriff auf den Windows-Explorer ergänzen (Windows-Ordnerstruktur öffnen).
- [ ] Prüfen, ob beim Erstellen der `.exe` ein Ordner `Languages` mitgeliefert werden soll.

---

## 4. Plattformen & Web-Bereitstellung

### 4.1 🌐 Website / GitHub-Pages-Version
- [x] **Zoom auf der Website deaktivieren:** Auf der GitHub-Pages-Website (`https://strudelcode.github.io/SOCDOF/`) soll das Heranzoomen per Touchpad, beispielsweise mit einer Zwei-Finger-Geste, deaktiviert werden.
  - [x] Prüfen, ob das Deaktivieren des Zooms nur für die Website und nicht für die native Electron-App gilt.
  - [x] Sicherstellen, dass die Bedienbarkeit und Barrierefreiheit der Website dadurch nicht unnötig eingeschränkt werden.
- [ ] **Keine dauerhafte Datenspeicherung auf der Website:** Auf der GitHub-Pages-Version sollen keine Benutzerdaten oder Änderungen dauerhaft gespeichert werden.
  - [ ] Website-Daten dürfen nur temporär während der aktuellen Sitzung verwendet werden.
  - [ ] Änderungen sollen ausschließlich in der installierten beziehungsweise portablen `.exe`-App dauerhaft gespeichert werden.
  - [ ] Prüfen, ob bestehende Speicherung über `localStorage`, IndexedDB, Cookies oder andere Browser-Speicher deaktiviert oder verhindert werden muss.
  - [ ] In der Website deutlich darauf hinweisen, dass die Web-Version keine dauerhafte Speicherung unterstützt und für das Speichern die `.exe`-App verwendet werden muss.
  - [ ] Prüfen, ob Demo-Daten oder Teständerungen beim Neuladen der Website vollständig zurückgesetzt werden.
- [x] **Seitentitel und Browser-Titel kürzen:** Die GitHub-Pages-Website soll nicht mehr den vollständigen Namen „SOCDOF - Strudel's Organization, Commerce & Documentation Offline Flow“ als Seitentitel anzeigen.
  - [x] Als sichtbaren Website- beziehungsweise Browser-Titel ausschließlich **„SOCDOF“** verwenden.
  - [x] Prüfen, ob der lange Name auch in Meta-Tags, PWA-Manifest, Favicon-Beschreibung, Open-Graph-Daten oder anderen Website-Bereichen verwendet wird.
  - [x] Die vollständige Bedeutung des Namens darf weiterhin in der Dokumentation stehen, soll aber nicht als primärer Seitentitel verwendet werden.

---

## 5. Fehlerbehebungen & Systemprüfung
- [x] Der `.exe` ein eigenes SOCDOF-Icon geben; das Standard-Electron-Icon entfernen.
- [x] Beim Start nur den SOCDOF-Startbildschirm anzeigen; nicht automatisch Dashboard oder Übersicht öffnen.
- [x] Bei abgeschnittenen App-Namen nach etwa 0,5–1 Sekunde einen Tooltip mit dem vollständigen Namen anzeigen.
- [x] Fehler beheben: Beim Klick auf das Suchfeld im Startmenü darf sich das Startmenü nicht unerwartet schließen.
- [x] Nicht benötigte Schnelloptionen im Startmenü der bereits geöffneten Desktop-App entfernen.
- [x] Den Text „odoo Prinzip“ in der Lagerverwaltung durch „SOCDOF-Prinzip: Doppelte Lagerbuchführung“ ersetzen.
- [ ] Alle Apps und Buttons auf korrekte Funktion, Zustände, Fehlermeldungen und Tastaturbedienung prüfen.

---

## 6. GitHub & Release-Workflow
- [ ] Vor einem Release fachliche Freigabe und erfolgreiche lokale Prüfungen einholen.
- [ ] Versionsnummern in `package.json`, zentraler Versionsquelle, README und `versions/` abgleichen.
- [ ] GitHub-Actions erst nach erfolgreichem Build und bewusster Release-Entscheidung verwenden.
- [ ] Pre-Release-Tags nicht versehentlich als stabile Version veröffentlichen.
- [ ] Release-Assets und Installationshinweise nach dem Build prüfen.
