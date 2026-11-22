# Übergabe-Notizen für die nächste AI

Stand: Rust-Edition (SOCDOF) im Browser, Port 3000, Ziel 1512 × 982.
Diese Datei beschreibt nur den aktuellen Zustand und die offenen Punkte. Nichts hier ist eine
Produktentscheidung – offene Entscheidungen sind ausdrücklich markiert.

## Build & Start

```bash
# Natives UI (schneller Compile-Check, keine Web-Ausgabe)
cargo build -p socdof-ui
cargo test -p socdof-ui --lib          # zuletzt 367 Tests grün, nach Layout-Änderungen erneut laufen lassen

# WASM-Host bauen (SQLite-WASM braucht clang)
cd crates/web
export HOME=<dein HOME> \
       PATH="/tmp/clangroot/usr/lib/llvm-18/bin:$HOME/.cargo/bin:$PATH" \
       LD_LIBRARY_PATH=/tmp/clangroot/usr/lib/x86_64-linux-gnu
CC_wasm32_unknown_unknown=clang AR_wasm32_unknown_unknown=ar trunk build --release
# Ausgabe landet in crates/web/dist (gitignored)

# Statischer Server für den Preview-Proxy
setsid nohup python3 /tmp/webserve.py > /tmp/serve3000.log 2>&1 < /dev/null &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

**Nicht** `pkill -f webserve.py` benutzen: das Muster matcht die eigene Shell des Agenten und
killt den laufenden Turn. Stattdessen `ss -ltnp | grep 3000` und die PID gezielt beenden.

Preview-URL: `https://pv-f61d5e079be0-3cd93ec5-3b13-4137-bcae-3e48e5a996ee.style.dev/`
Auth läuft über das Cookie `__Host-freebuff-cloud-preview`. Wenn die Seite
„This preview is private …" zeigt: Dev-Server neu starten, `cloud_show_dev_server(3000)` und
`preview_open(mode: "browser")` aufrufen – das hat die Session wiederhergestellt.
**Nie** `context.clearCookies()` im Playwright-Context: das löscht die Preview-Session und sie
kommt auch durch erneutes `preview_open` nicht zuverlässig zurück.

## Was in diesem Arbeitsblock geändert wurde

| Datei | Änderung |
|---|---|
| `crates/web/index.html` | Canvas fest auf `width="1512" height="982"`; CSS skaliert ihn in den Viewport. Kein Resize-Following mehr. |
| `crates/web/src/lib.rs` | `CANVAS_WIDTH/HEIGHT` + `sync_canvas_size()` pinnt nur noch diese feste Größe (vorher folgte der Backing-Store der CSS-Box → Pointer-Mapping lief aus dem Ruder). Außerdem: Dark-Start, Konto-Chip unten rechts. |
| `crates/ui/src/chrome.rs` | Leerzeichen vor dem Fenster-Badge (`Dashboard [DASHBOARD]`): das Theme setzt `item_spacing.x = 0`, daher `ui.add_space(6.0)`. |
| `crates/ui/src/desktop.rs` | Taskbar: Studio-/Zahnrad-Button entfernt, nur Tray-Glocke + Helligkeit; Versions-Pill ersetzt; Uhr 24 h + Datum; DE-Pille; Widget-Spalte weg; Doppelklick öffnet Icons. |
| `crates/ui/src/auth_screens.rs` | Wizard: Body und Fußzeile bekommen jetzt **getrennte, explizit berechnete Rechtecke** (`available_rect_before_wrap()` → `footer_rect` unten, `body_rect` darüber) statt `available_height() - footer_height`. Dazu eine Verdichtungsstufe für Fenster < 1000 px Höhe (Padding 20, Header-Icon 36, kleinere Abstände, Avatar 48). |
| `crates/ui/src/auth_kit.rs` | App-Kacheln: Titel wrapsen auf 2 Zeilen (kein Ellipsis-Abschneiden mehr, `one_line()` entfernt), Beschreibung bis 5 Zeilen, Kachelhöhe einheitlich 136 px. |
| `crates/ui/src/components.rs` | Karten-Schatten neutral (schwarz) statt Akzentfarbe → kein violetter Halo um jede Karte. |
| `crates/ui/src/app_store.rs`, `crates/ui/src/gallery.rs` | Vier Tests an den neuen Referenz-Startzustand angepasst (14 aktive Module statt 18, Startmenü 17 statt 21, Escape-Test nutzt `calendar` statt des deaktivierten `fleet`). |
| `crates/core/src/app_store.rs` | `REFERENCE_STARTUP_DISABLED` ist jetzt `pub`, damit UI/Tests dieselbe Quelle nutzen. |

## Offene Punkte (Priorität von oben nach unten)

1. **Assistent Schritt 2 im echten Browser zu Ende verifizieren.**
   Layout ist repariert: bei 1512 × 982 sind Karte 4..978, Body-Viewport 190..890, Feld
   „Passwort wiederholen" 741..808, Regel-Box 817..850, Fußzeile (Back/Continue) 873..925 –
   nichts überlappt mehr. Belegt in `artifacts/b-06-password-typed.png`.
   Offen: der komplette Durchlauf bis „Create administrator".
2. **Validierungsfehler sind unsichtbar.** `validate_account()` setzt `state.error`, und
   `messages()` rendert den Fehler **im gescrollten Body** – bei vollem Formular liegt er unter
   dem Viewport. Ein Klick auf „Continue" wirkt dadurch wie „nichts passiert".
   Fix: Fehlermeldung oberhalb der Fußzeile (oder im Footer-Band) rendern.
3. **Klick auf untere Formularfelder prüfen.** Im Browser ist unklar, ob Klicks auf
   Passwort-/Wiederholungsfeld den Fokus setzen: Text landete mehrfach weiter im vorher
   fokussierten Feld. Tastatur (Tab) funktioniert zuverlässig. Deterministisch testen
   (z. B. Klick → Screenshot → prüfen, ob der Fokusring am erwarteten Feld hängt), sonst
   Fokus-Handling in `kit::input` / `kit::password_input` (`focus.set_focus` vs. egui-TextEdit)
   untersuchen.
4. **Restliche drei Abweichungen im Browser belegen** (bisher nur als gerenderte egui-Renders
   aus `target/debug/socdof-ui-preview` bei exakt 1512 × 982):
   Fenstertitel-Leerzeichen (`crates/ui/src/chrome.rs`), App-Kacheln-Wrap (`auth_kit.rs`),
   fehlendes Zahnrad in der Taskbar (`desktop.rs`).
   Renders erzeugen:
   `SOCDOF_PREVIEW_OUT=/tmp/p SOCDOF_PREVIEW_SIZE=1512x982 cargo run -q -p socdof-ui --bin socdof-ui-preview dashboard`
   (Szenen: `auth-setup`, `auth-apps`, `dashboard`, `desktop` …). Das zählt **nicht** als
   Browser-Beleg.
5. **Doppelter Aufruf:** in `crates/web/src/lib.rs::update()` steht `sync_canvas_size();` zweimal
   direkt hintereinander – eine Zeile entfernen.
6. **Produktentscheidung offen – nicht raten:** Das Startraster zeigt die 12 Rust-*Module*,
   nicht die 12 Apps des TS-Originals (App Store, Handbuch, Taschenrechner fehlen als Kacheln,
   dafür erscheinen Point of sale/Users/Text editor/Projects). Der Renderer-Scene `desktop`
   zeigt, dass App Store, Handbuch und Taschenrechner als Desktop-Symbole technisch gehen
   (`DesktopIcon::new(AppId::new("settings"), …)`-Muster in `desktop.rs`). Entscheidung des
   Nutzers abwarten; Modulliste nicht anfassen.

## Praktische Hinweise für Browser-Tests (Playwright)

* Viewport **innerhalb** eines Aufrufs setzen (`page.setViewportSize({width:1512,height:982})`),
  er fällt zwischen Aufrufen auf 432 × 826 zurück. Das ist jetzt unkritisch, weil der Canvas fest
  gepinnt ist – aber Screenshots nur im selben Aufruf machen.
* Pointer-Mapping ist bei 1512 × 982 1:1 (verifiziert mit einer Debug-Marker-Zeichnung).
* Gemessene Klickziele bei 1512 × 982 (Deutsch, Schritt 2, Personal):
  Sprache-Karte Continue ≈ (756, 745), Willkommen-Continue ≈ (756, 669),
  Feld Anzeigename ≈ 238..273, Benutzername ≈ 331..366, Passwort ≈ 620..688,
  Passwort wiederholen ≈ 741..808, Footer-Buttons y ≈ 873..925 (Back x ≈ 630, Continue x ≈ 862).
  Mit aufgeklapptem Business-Panel verschiebt sich alles nach unten.
* Texteingabe: `page.keyboard.type(text, { delay: 90 })` funktioniert; `insertText` wird
  gelegentlich ignoriert. Sonderzeichen (z. B. `!`) einzeln per `Shift+Digit1` schicken und mit
  einem Screenshot verifizieren, sonst fehlt das Zeichen und die Passwort-Validierung schlägt fehl.
* `artifacts/` ist gitignored; Screenshots dort sind Arbeitsbelege, nicht Teil des Commits.
* Test-Admin (falls die DB neu aufgesetzt wird): Benutzer `admin`, Passwort `Socdof2026!`.
* Datenbank leeren: nur IndexedDB/OPFS löschen, **nicht** Cookies (siehe Preview-Auth oben).
