# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

### v23.10.10 — Europäische Zahlenformatierung (DIN 1333) & Therapie Dark-Mode-Feinschliff

🚀 **Neu / What's New**:
- **Europäisches Zahlen- & Währungsformat**: Alle Beträge und Kennzahlen im Therapie-Dashboard, in Abrechnungen und im Kassenbuch folgen nun streng der europäischen DIN-Norm mit Tausender-Punkten und Dezimalkommas (z. B. `1.000.000,00 €` und `10.010,00 €`).

🔄 **Geändert / Improved**:
- **Zentraler Formatierer**: Neues Modul `formatters.ts` für standardisierte Tausender-Punkte (`.`) und Cent-Kommas (`,`).
- **Vorlagen-Verwaltung & Mehrsprachigkeit**: Auslagerung und Absicherung aller Kassenbuch-Texte und Buchungs-Schnellvorlagen in `ledgerTemplates.ts` mit voller Unterstützung für DE, EN, FR und ES sowie Speicherung in den lokalen Einstellungen.

🛠️ **Behoben / Fixed**:
- **Button „+ Neuer Klient (Kundenbuch)“**: Unbeabsichtigtes Umkippen in einen schwarzen Button mit dunkelblauem Text im Dark Mode behoben; der Button bleibt nun sauber weiß mit gut lesbarer marineblauer Schrift hervorgehoben.
- **Tabs im Rechnungsvorlagen-Editor**: Kontrast für inaktive Reiter (`Layout & Variablen`, `Praxisdaten & Logo`, `Echtzeit-Vorschau`) im Dark Mode deutlich verbessert.
- **Schließen-Schaltflächen in Modals**: Farbkontrast der Schließen-Icons im Header optimiert, sodass diese nicht mehr als leere graue Quadrate erscheinen.

---

### v23.10.9 — Kassenbuch-Entrümpelung, Fenster-Zentrierung & Z-Index-Isolation

🔄 **Geändert / Improved**:
- **Z-Index & Hintergrund-Isolation**: Der Modal-Hintergrund liegt nun auf `z-[9999]`, sodass Resize-Griffe und Steuerelemente von im Hintergrund geöffneten Rechnungs- oder Terminfenstern nicht mehr durchscheinen oder bedient werden können.
- **Echte vertikale Fenster-Zentrierung**: Durch Ausgleich der unteren Desktop-Taskleiste (`pb-16`) sitzt das Fenster nun exakt zentriert im sichtbaren Desktop-Bereich.
- **Entrümpelung der Texte**:
  - `(Wirtschaftsberater)` aus allen Titeln und Buttons entfernt – jetzt sauber `Kassenbuch & Einnahmen-Ausgaben`.
  - Entfernung des Subtitels unter der Kopfzeile sowie der überflüssigen `Sync`- und `Erstellt mit ERP`-Schriftzüge in Kopf- und Fußzeile für ein klares, aufgeräumtes Design.

---

### v23.10.8 — Zahlungsarten-Gating für Kassa & Bank in Excel-Formeln

🛠️ **Behoben / Fixed**:
- **Strikte Bindung an Zahlungsart**: Zeilen ohne Angabe von `K` (Kassa) oder `B` (Bank) gelten als unbezahlt/offen und fließen nicht mehr automatisch in den Kassenstand ein.
- **Berechnung erst bei Bezahlung**: Erst sobald in der Spalte `Kassa / Bank` ein `K` oder `B` eingetragen wird, wird der Betrag oben in Kassa bzw. Bank und in den Saldo eingerechnet.

---

### v23.10.7 — Gesamt-Spalte für Wirtschaftsberater & Laufender Saldo

🚀 **Neu / What's New**:
- **Zusätzliche „Gesamt“-Spalte**: In der oberen Verrechnungsbox steht nun neben *Kassa (K)* und *Bank (B)* eine dritte Spalte *Gesamt* – sowohl in der App als auch im Excel-Export. Sie addiert automatisch Übertrag, Einnahmen, Ausgaben und den aktuellen Gesamtstand.
- **Laufender Saldo in Excel**: Die Buchungstabelle im Excel-Export berechnet über eine Live-Formel nach jedem Eintrag sofort den fortlaufenden Saldo.

---

### v23.10.6 — Zebra-Streifen & Direkte Formelberechnung für Excel-Einträge

🚀 **Neu / What's New**:
- **Zebra-Streifen (Weiß/Grau abwechselnd)**: Jede zweite Zeile in der Buchungstabelle besitzt nun einen dezenten grauen Hintergrund (`#F1F5F9`), sowohl im Excel-Export als auch in der App, für optimale Zeilenlesbarkeit und Kontraste.
- **Sofortige automatische Formelberechnung bei manuellen Excel-Einträgen**: Die Spalten- und Zeilenzuordnung in den Formeln (`R11:R150`) wurde korrigiert. Jede selbst eingetragene Zahl in *Einnahmen* (Spalte E) oder *Ausgaben* (Spalte F) wird nun unmittelbar in die Summen- und Standfelder einberechnet – auch wenn die Zahlungsart frei bleibt.

---

### v23.10.5 — Dokumentenblatt-Höhenanpassung & Flexbox-Clipping-Korrektur

🛠️ **Behoben / Fixed**:
- **Überhang des Kassenbuch-Feldes behoben**: Durch Anpassung des Scroll-Containers und Einbettung von `h-fit min-h-full` umschließt das weiße Dokumentenblatt nun den gesamten Inhalt (Verrechnungstabelle, Suchleiste und Transaktionsliste) vollständig.
- **Kein Herausragen über den weißen Hintergrund**: Die blaue Kopf- und Abschlusszeile ("Aktueller Kassastand") bleibt sauber und bündig innerhalb des weißen Dokumentenbereichs.

---

### v23.10.4 — Kassenbuch Dokumentblatt-Suchleiste & Design-Integration

🚀 **Neu / What's New**:
- **Reinweiße Such- & Filterleiste im Kassenbuch-Dokument**: Überarbeitung der Suchleiste und Filterschaltflächen mit weißem Hintergrund und klaren Rändern zur nahtlosen optischen Integration in das Papierblatt.

---

### v23.10.3 — Kassenbuch Tabellen-Layout & Bündige Breiten-Ausrichtung

🚀 **Neu / What's New**:
- **Bündiges Tabellen-Layout im Kassenbuch**: Erweiterung der oberen Verrechnungsbox von bisher `max-w-2xl` auf die volle Dokumentbreite (`w-full`), sodass alle blauen Kopfzeilen (`#1B365D`) und Tabellenränder exakt bündig im weißen Papierblatt verlaufen.

---

### v23.10.2 — Kassenbuch Excel Gridline Elimination & Instant Auto-Summing Ledger Formulas

🚀 **Neu / What's New**:
- **Bereinigter Excel-Hintergrund (`DoNotDisplayGridlines`)**: Einbettung der Gridlines-Unterdrückung in allen 12 Monatsregistern des Excel-XML-Exports für ein sauberes, reinweißes Berichtslayout.
- **Echtzeit-Formeln für jede Zahl**: Optimierte `=SUMIF`-Formeln summieren sowohl Zahlungsarten-Kürzel (`K`/`B`) als auch implizite Einträge sofort beim Eintragen beliebiger Beträge.

🔄 **Geändert / Improved**:
- **Echtzeit-Monatsverrechnung**: Sofortiges Durchrechnen und Aktualisieren der oberen Verrechnungskarten im Web-Kassenbuch bei der Eingabe manueller Buchungen.

---

### v23.9.7 — Wirtschaftsberater Kassenbuch & Einnahmen-Ausgaben (Excel 12-Monate-Sync) & Rechnungsvorlagen-Manager

🚀 **Neu / What's New**:
- **Monatliches Kassenbuch & Einnahmen-Ausgaben für den Wirtschaftsberater**: Vollständige Monatsübersicht mit automatischer Trennung nach Kassa (Bar) und Bank, sortierten Transaktionen, Übertrag vom Vormonat, Summe Einnahmen, Summe Ausgaben und aktuellem Stand.
- **12-Monats-Excel-Export (.xls / .xml)**: 1-Klick-Download einer vorformatierten Microsoft Excel Arbeitsmappe mit allen 12 Monatsregistern (Januar bis Dezember), Navy-Design (#1B365D), Zusammenrechnungs-Kopfzeilen und Währungsformaten.
- **Echtzeit-Synchronisierung von Einnahmen & Ausgaben**: Automatischer Datenabgleich aller Praxis-Honorare, Rechnungen, Praxisfahrten (Kilometergeld), Material- und Wareneinkäufe sowie manuell erfasster Belege.
- **Rechnungsvorlagen-Manager mit Variablen-Erkennung**: Visueller Vorlageneditor mit anpassbarem Logo, Farbthemen, DIN 5008- oder Word-Layout und intelligenter `{Rechnung}`, `{Klient_Name}`, `{Gesamtbetrag}` Platzhalter-Erkennung für Word- und PDF-Export.

🔄 **Geändert / Improved**:
- **Direkter Wirtschaftsberater-Zugang**: Schneller Aufruf der Monatsabrechnung sowohl im Modul "Praxis & Therapie" als auch in der zentralen Buchhaltung ("Accounting").
- **Dauerhafte In-App-Persistenz**: Installierte In-Apps bleiben über Reloads und Neustarts hinweg benutzerbezogen und verlässlich aktiv.

🛠️ **Behoben / Fixed**:
- **Übertragsberechnung**: Nahtloser Saldovortrag (Kassa & Bank) vom Vormonat in den Folgemonat mit konfigurierbarem Jahresanfangsbestand.



🚀 **Neu / What's New**:
- **Praxis & Therapie Neugestaltung**: Direktes Importieren und Verknüpfen von Klienten aus dem zentralen Kundenbuch (CRM) mit automatischer Übernahme aller Stammdaten.
- **Offizielle Rechnungs-Integration**: Direkte 1-Klick-Übertragung von Praxis-Abrechnungsposten in das zentrale Rechnungsmodul inklusive druckbarer Rechnungsvorschau mit Praxiskopf.
- **Interaktives Praxis-Dashboard**: Dynamische 6-Monats-Umsatz- und Sitzungsverlaufsgrafik, Echtzeit-Kennzahlen (Therapiestunden, Honorare, offene Forderungen) und Terminübersichten.
- **Multi-Monitor & Anzeige-Manager**: Unterstützung für mehrere Bildschirme, freie Bildschirmanordnung, Skalierung (100–200%), Ausrichtung, Ausdocken von Fenstern auf zweite Monitore (`Tv`-Button) und Windows 11 Nachtmodus (Nachtlicht mit Farbtemperatur-Regler).
- **Mehrstufiges System-Reset**: 4-stufiger Sicherheitsassistent mit Wort- und Passwortbestätigung zum vollständigen Zurücksetzen des Arbeitsbereichs.

🔄 **Geändert / Improved**:
- **Kompakte Kopfzeilennavigation**: 4 Kern-Tabs mit 3-Linien-Ausklappmenü für Fahrtenbuch und Termine ohne störende Scrollbalken.
- **Authentische Desktop-Vorschau in Einstellungen**: Realistische Kacheln, lebendiges Rechnungsfenster und responsive 4-Spalten-Gitteransicht für Personalisierungseinstellungen ohne horizontales Scrollen.
- **Benutzerkonto- & Profilbildverwaltung**: Saubere Trennung von Profilbild/Kontoeinstellungen in Konten & Profile mit Einsicht in erstellte Dokumente und Dateien für Administratoren.

🛠️ **Behoben / Fixed**:
- **Dauerhafte In-App-Aktivierung & App-Store-Persistenz**: Installierte oder deaktivierte Module (z. B. Praxis & Therapie) sowie angeheftete Desktop- und Taskleisten-Icons bleiben jetzt nach jedem Seiten-Reload und App-Neustart dauerhaft und benutzerbezogen gespeichert.
- **Feste Formularhöhen (`resize-none`)**: Textfelder in der Behandlungsdokumentation und Klientenverwaltung können nicht mehr versehentlich verzerrt werden.

