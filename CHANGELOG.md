# 📝 Pending Updates / Changelog
<!-- 
Updates written here accumulate across versions and are broadcast to Discord on the next release or workflow run.
Once sent, this file is automatically reset so you can accumulate the next batch of updates.
Format guidelines:
- Keep it concise: what is new, what changed/improved, what was fixed.
- Avoid exhaustive UI/visual layout breakdowns.
-->

## Neu
- Die Dokumentation zeigt die aktuellen Hauptversionen (V25 & V24) auch in der Schnellsuche und beim Zurücksetzen der Filter.
- Das Startfenster erscheint bei jedem Start, auch bei der Portable-Version. Man sieht sofort, dass SOCDOF startet.
- Portable-Version aktualisiert sich selbst: nach dem Update wird die neue Portable-EXE übernommen und SOCDOF startet neu.
- Andere Arbeitsplätze im gemeinsamen Datenordner sehen einen Hinweis und schließen SOCDOF, wenn ein Update startet.
- Lesbare Sitzungs-Logs im Ordner `logs` des Datenordners: jeder Start erzeugt eine Datei, die letzten 20 bleiben erhalten. Abstürze und unbehandelte Fehler werden mit Zeitstempel protokolliert.

## Geändert
- Der Quellcode für Oberflächenkomponenten ist in Fachbereiche gegliedert; die Funktion bleibt unverändert.

## Behoben
- Die Ersteinrichtung zeigt die Sprachauswahl sofort im System-Dunkelmodus.
- Der Firmendaten-Kopf in der Ersteinrichtung bricht auf schmalen Bildschirmen sauber um.
- Die Dokumentation beschriftete die aktuellen Versionen fest als V24 & V23.
- Update in der Portable-Version startete nicht neu, weil immer das Setup installiert wurde.
- Die Sprachauswahl beim ersten Start blieb hell, auch wenn das System dunkel war. Sie folgt jetzt dem System-Design.
