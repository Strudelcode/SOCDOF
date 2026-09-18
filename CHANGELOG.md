# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## v23.2.5

### 🚀 Neu / What's New
- **Zentrales Profil- & Benutzerzentrum in den Einstellungen**: Sämtliche Benutzer-, Profil- und Kontofunktionen sind nun strukturiert im Modul *Einstellungen > Benutzer & Konten* gebündelt.
- **Profil-Personalisierung**: Eigenes Profilbild (Upload/Entfernen), individuelles Desktop-Hintergrundbild (Wallpaper), Kontotyp (Geschäftlich/Privat), Inaktivitätssperre und Kennwortänderung direkt im Profil-Reiter anpassbar.
- **Schnellzugriff über das Startmenü**: Klick auf das eigene Profilbild im Startmenü öffnet direkt die Benutzer- & Kontoeinstellungen im Einstellungsfenster.

### 🔄 Geändert / Improved
- **Aufgeräumter Desktop-Arbeitsbereich**: Das schwebende Profil-Icon oben rechts auf dem Desktop wurde entfernt, um ein klares, ungestörtes Desktop-Design zu gewährleisten.
- **Vollständige 4-Sprachen-Übersetzung**: Sämtliche neuen Reiter und Optionen sind lückenlos in Deutsch, Englisch, Französisch und Spanisch übersetzt.

## v23.2.4

### 🛠️ Behoben / Fixed
- **Startmenü- & Energie-Aktionen Übersetzungskorrektur**: Behoben, dass im deutschen Startmenü die Ein/Aus-Schaltflächen auf Französisch angezeigt wurden ("Alimentation", "Verrouiller", "Changer d'utilisateur", etc.) sowie zyklisch vertauschte Übersetzungen in allen Sprachen korrigiert.
- **Flaggen-Darstellung auf Windows (kein "DE DE" mehr)**: Da Windows-Systemschriften Länderflaggen-Emojis als 2-Buchstaben-Codes rendern, werden Flaggen jetzt als scharfe Vektor-SVGs dargestellt (z. B. echte Flagge neben dem Sprachkürzel).
- **Vollständige Sprachkatalog-Parität**: Fehlende Übersetzungen für Speicher-Tooltips in Französisch und Spanisch nachgetragen (100% deckungsgleiche Schlüssel in allen 4 Sprachen).

## v23.2.3

### 🛠️ Behoben / Fixed
- **Dark Mode UI-Konsistenz**: Behoben, dass bei aktivem Dark Mode nach einem Klick Oberflächenelemente unerwartet weiß/hell wurden (Mischung aus Light- & Darkmode).
- **Benutzeraktivitäts-Heartbeat isoliert**: Mausklicks und Tastatureingaben aktualisieren die Inaktivitätszeit jetzt im Hintergrund, ohne globale Authentifizierungs-Events auszulösen oder das Design zurückzusetzen.
- **Synchronisation von Design-Einstellungen**: Umschalten zwischen Hell- und Dunkelmodus synchronisiert nun zuverlässig Unternehmensprofil, Benutzerpräferenzen und DOM-Klassen.

## v23.2.2

### 🚀 Neu / What's New
- **Ersteinrichtung mit Sprachauswahl zuerst**: Beim ersten Start wird zunächst die bevorzugte Sprache festgelegt, bevor das Erstellen des ersten Benutzerkontos erfolgt.
- **Passwort-Sicherheitsanzeige & Pflichtfeld-Markierungen**: Visuelle Sicherheitsleiste (sehr schwach bis sehr stark) mit nützlichen Tipps sowie deutliche rote Sternchen (`*`) für alle Pflichtfelder.
- **Sicherheitsfragen & eigene Fragen**: Dropdown mit vorgefertigten Sicherheitsfragen oder der Option für eigene Fragen samt Hinweistext zur lokalen Passwort-Wiederherstellung.
- **Profilbild direkt hochladen**: Unterstützung für den direkten Upload eines Profilbilds oder die Nutzung der neutralen Standardsilhouette.

### 🔄 Geändert / Improved
- **Optimiert für kleinere Bildschirme**: Die Registrierungs- und Anmeldemaske passt sich nun responsiv an kompaktere Displays und Laptops an (automatische Scrollbereiche, optimierte Abstände).
- **Weiterleitung zum Sperrbildschirm**: Nach erfolgreicher Kontoerstellung erfolgt kein automatischer Sofort-Login mehr, sondern eine saubere Weiterleitung zum Anmeldebildschirm mit Erfolgsbestätigung.

