# ToDo Liste 
* **Anweisungen ToDo**
   * When an item on the todo list is completed, tick it off and DO NOT delete it.
   * If features that have been made are not yet on it, add them and tick them accordingly.
   * If a task is not feasible, ~cross it out.~
   * If you have any questions, just get in touch.


* **General instructions**
   * Any changes to the project must be written down in the "Versions" folder in the corresponding version's file. Everything must also be written in the Status.md file. The versions file should be structured like the status file. Once you understand that, change it so that it's here as a guide. 
      * For each major version (v1, v2... v20), a new file should be created. For small changes to the project, everything still needs to be recorded in the versions file, and the version changes to 'small versions' (19.4.1, 19.3.4...).
   * Each change must be adapted to all languages. 

---

## 🚀 Nächste Features & UX
- [ ] erweiterung als App für Kunden support; man kann diensteleistungen eintragen (datum, von-bis), Kunde vom kontakt Buch auswählen können sodass die e-mail, telefonnummen und alle weiteren details verfügbar sind, wer es bearbeitet hat (falls mehrere Leute daran arbeiten), tags / stichwörter hinzufügen,  beschreibung , zeiterfassung, zeitaufwand (Beispielbild: todo/kunden_support-dienstleistungen-beispiel.png).

- [ ] Beim Dasboard sollte man auch einen benutzerdefinierten zeitraum auswählen können / auch bei abrechnungen...

- [ ] die exe Datei soll im vollbild modus starten oder so etwas. wenn man nämlich eine App öffnet kennen sich manche User nicht mehr aus wie man daraus kommt und dann auf das "x" von der exe klicken anstatt auf das der ing app
   * [ ] Vor dem schließen der App soll nochmal eine aufforderung kommen ob man SOCDOF wirklich schließen will sodass vielleicht konflikte wie das vorher genannte Problem vermieden werden können?

- [ ] Wir benutzen ja electron für unser Projekt. Und ich habe gehört dass es dafür eine Erweiterung gibt die automatisch immer von github schaut ob eine neueste Version verfügbar ist bei Releases und wenn eine neue Version verfügbar ist das ist eine Nutzer fragt ob es sie herunterladen kann und wenn es installiert ist ob die App neu gestartet werden kann können wir das vielleicht auch hin unsere App einfahren damit immer neue Situationen automatisch ich will nicht nur Lisa Stelle und das dann immer zwischen genau V19 V20 oder so heißen und ohne Punkt oder weit Erweiterungen oder v19.1.1 und so sind das immer nur die Haut Releases also nicht priori Release ist nur how to Releases dann immer sozusagen als Update für die App benutzt wird.
 
- [ ] wenn es kostenlos möglich ist z b über firebase oder einen anderen Dienst das man z b sein Microsoft / Google Konto verbinden kann um den Terminkalender zu synchronisieren oder später villeicht auch für andere Features nutzen kannt.
   * [ ] falls das Haupt Feature möglich ist könnte man unten rechts auf die Uhr drauf klicken und es kommt ein Kalender wie bei Windows wo man auch die Termine und so sieht

- [ ] Einen Explorer hinzufügen der so wie der Windows Explorer funktioniert. Dabei wird einfach der standart genutzt bzw über einer Verknüpfung die Ordner Struktur angezeigt ohne den Ordner zu duplizieren. Wie gesagt. Die app soll so schnell, flüssig wie möglich funktionieren und so wenig CPU, gpu, RAM und MB beanspruchen wie möglich

- [ ] Vielleicht einen Ordner, der beim Erstellen der .exe-Datei angelegt wird, mit dem Namen "Languages". Darin befindet sich die Hauptdatei english.dateityp, in der alle Wörter/Sätze stehen, die im Projekt vorkommen. Für andere Sprachen sind die englischen Wörter und daneben die in der jeweiligen Sprache übersetzten. Sobald man eine neue Datei erstellt, z. B. dänisch.datatype, scheint diese Sprache in der App auf. Natürlich kann man dann Flagge und so in der config-Datei festlegen. Aber so ist es möglich, jede Sprache einfach zu ändern.

* [ ] in den Einstellungen gibt es ja einmal das mit Sprache und vielleicht auch ein Datum oder Zeitformat und so und doch dafür dann einfach Zeit wo man hinzufügen ach doch tun das mit der Sprache und dem Datum ist und doch können einstellen dass bei der Zeit mit Sekunden oder ohne Sekunde kann ja zu hören Stromverbrauch kommen oder weil sonst nur Karten minimalen Unterschied macht deswegen macht trotzdem mal her und dass man auch vielleicht trotzdem noch eine Zeitzone ändern kann standardmäßig ist es von der Systemzeit aber sonst ändern kann. 


## 🐛 Bugfixes & Offene Punkte
- [ ] Das die .exe App ein icon hat und nicht die Standard Electron textur.
- [ ] Beim öffnen der App soll nur der startbildschirm kommen ohne das sich direkt eine App (Dashboard/übersicht) öffnet.
- [ ] Wenn ein App name zu lang ist wird ja "..." angezeigt. Wenn ich über die App mit der Maus fahre und dort 0.5 oder 1 sekunde darüber bin wird der ganze name angezeigt so als kleines Fenster darüber wie man es bei Windows & Co. kennt.
- [ ] Alle Apps sollen einwandfrei funktionieren. Alle Buttons sollen anklickbar, ausführbar... sein.
- [ ] Bestimmte Apps müssen verknüpft werden damit z. B. bestellungen oder solche Sachen direkt bei abrechnungen vom Monat oder was eingetragen wird übernommen wird.
- [ ] Wenn man unten links auf das SOCDOF Icon klickt geht ja das klein menu mit übersicht / suche und so wie bei Windows auf. Wenn man dort auf das Suchfeld klickt schlißt sich das klein menu.
- [ ] Wenn man auf das SOCDOF icon klickt damit das startmenu mit den optionen erscheint sieht man dort einige Button für schnell optionen. Dort stehen Sachen wie "exe downloaden", "Windows App"..., jedoch sind wir bereits in einer App sodass wir diese optionen nicht mehr benötigen (siehe todo/socdof_start_menu_auswahl.png)
- [ ] In der App "lagerverwaltung.." steht "odoo Prinzip". Das können wir mal schön entfernen

## 🛠️ GitHub & Workflow
/
