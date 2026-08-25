# SOCDOF – Versions- und Release-Dokumentation

In diesem Ordner werden abgeschlossene Änderungen nach Hauptversion gesammelt.

## Versionsübersicht

- [Version 19 – aktuell](./V19.md)
- [Version 18](./V18.md)
- [Version 17](./V17.md)

## Regeln

- Pro Hauptversion gibt es genau eine Datei: `V17.md`, `V18.md`, `V19.md` usw.
- Feature-, Fix- und Patch-Releases werden in der Datei der jeweiligen Hauptversion ergänzt.
- Die Hauptversion darf nur nach Rückfrage und bewusster Entscheidung erhöht werden.
- Innerhalb der aktuellen Hauptversion dürfen Minor- und Patch-Versionen selbstständig erhöht werden, zum Beispiel `v19.3.1`.
- Jede abgeschlossene Änderung erhält möglichst einen eigenen Abschnitt mit Version und Datum.
- Die Versionshistorie dokumentiert abgeschlossene Änderungen; eine separate Statusdatei kann zusätzlich den aktuellen Projektzustand beschreiben.
- Vor einem Release müssen `package.json`, zentrale Versionsquelle, README und die passende Versionsdatei übereinstimmen.

## Vorlage für einen neuen Eintrag

```md
## v19.x.y – YYYY-MM-DD

### Änderungen
- …

### Betroffene Bereiche
- …

### Einschränkungen oder offene Punkte
- …

### Verifizierung
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Relevante manuelle Prüfung
```

## Neue Hauptversion anlegen

Wenn eine Änderung möglicherweise eine neue Hauptversion rechtfertigt, zuerst nachfragen. Nach der Freigabe:

1. Neue Datei `V{Major}.md` anlegen.
2. Versionsnummern in den relevanten Projektdateien aktualisieren.
3. Die Versionsübersicht in dieser Datei ergänzen.
4. Änderungen, Einschränkungen und Verifizierung dokumentieren.
