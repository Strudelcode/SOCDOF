# Übergabe-Notizen für die nächste AI

Stand: Rust-Edition (SOCDOF) im Browser, Port 3001, Ziel 1512 × 982. Der First-Run-Wizard ist
im echten Browser vollständig bis zum Desktop durchlaufen (Belege und Befehle unten).
Diese Datei beschreibt nur den aktuellen Zustand und die offenen Punkte. Nichts hier ist eine
Produktentscheidung – offene Entscheidungen sind ausdrücklich markiert.

## Build & Start

Die Toolchain liegt **im Home** (kein sudo/apt, `clang` fehlte in der Umgebung):

```bash
# Rust (rustup, war nicht installiert)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal

# clang 18 ohne root: die Ubuntu-24.04-.debs nach ~/.local/llvm18 entpacken
mkdir -p /tmp/debs ~/.local/llvm18 && cd /tmp/debs
BASE=http://archive.ubuntu.com/ubuntu/pool/main/l/llvm-toolchain-18
for p in clang-18_18.1.3-1ubuntu1_amd64.deb libclang-common-18-dev_18.1.3-1_amd64.deb \
         libclang-cpp18_18.1.3-1ubuntu1_amd64.deb libllvm18_18.1.3-1_amd64.deb; do curl -fsSLO $BASE/$p; done
for p in *.deb; do dpkg-deb -x "$p" ~/.local/llvm18; done

# trunk als Release-Binary (Alternative: cargo install trunk --locked)
cargo install trunk --locked        # landet in ~/.cargo/bin/trunk (0.22.2)
```

```bash
export PATH="$HOME/.local/llvm18/usr/lib/llvm-18/bin:$HOME/.cargo/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.local/llvm18/usr/lib/x86_64-linux-gnu:$HOME/.local/llvm18/usr/lib/llvm-18/lib"
export CC_wasm32_unknown_unknown=clang AR_wasm32_unknown_unknown=ar

cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

# WASM-Host bauen und servieren
cd crates/web
trunk build                          # Ausgabe in crates/web/dist (gitignored)
setsid nohup trunk serve --address 0.0.0.0 --port 3001 > /tmp/trunk_serve.log 2>&1 < /dev/null &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/
# danach cloud_show_dev_server(3001) und preview_open(mode: "browser")
```

**Nicht** `pkill -f webserve.py` benutzen: das Muster matcht die eigene Shell des Agenten und
killt den laufenden Turn. Stattdessen `ss -ltnp | grep 3000` und die PID gezielt beenden.

Preview-URL dieses Blocks:
`https://pv-e459060ed0e3-916a16dd-71e6-4563-aef6-cb939dea07dd.style.dev/` (Hostname je Worktree/
Restore anders; immer den von `cloud_show_dev_server` gelieferten nehmen).
Auth läuft über das Cookie `__Host-freebuff-cloud-preview`. Wenn die Seite
„This preview is private …" zeigt: Dev-Server neu starten, `cloud_show_dev_server(3001)` und
`preview_open(mode: "browser")` aufrufen – das hat die Session wiederhergestellt.
**Nie** `context.clearCookies()` im Playwright-Context: das löscht die Preview-Session und sie
kommt auch durch erneutes `preview_open` nicht zuverlässig zurück.

## Was in diesem Arbeitsblock geändert wurde

| Datei | Änderung |
|---|---|
| `crates/web/index.html` | Canvas füllt den Viewport (`width`/`height` nur als Startwert), `tabindex="0"` damit der Canvas Tastaturfokus halten kann. |
| `crates/web/src/lib.rs` | `sync_canvas_size()` setzt den Backing-Store auf `client size × devicePixelRatio` (vorher fixe 1512 × 982, was bei DPR 1.25 Klick- und Layout-Drift erzeugte). Außerdem: Dark-Start, Konto-Chip unten rechts. |
| `crates/ui/src/chrome.rs` | Leerzeichen vor dem Fenster-Badge (`Dashboard [DASHBOARD]`): das Theme setzt `item_spacing.x = 0`, daher `ui.add_space(6.0)`. |
| `crates/ui/src/desktop.rs` | Taskbar: Studio-/Zahnrad-Button entfernt, nur Tray-Glocke + Helligkeit; Versions-Pill ersetzt; Uhr 24 h + Datum; DE-Pille; Widget-Spalte weg; Doppelklick öffnet Icons. |
| `crates/ui/src/auth_screens.rs` | Wizard: Body und Fußzeile bekommen jetzt **getrennte, explizit berechnete Rechtecke** (`available_rect_before_wrap()` → `footer_rect` unten, `body_rect` darüber) statt `available_height() - footer_height`. Dazu eine Verdichtungsstufe für Fenster < 1000 px Höhe (Padding 20, Header-Icon 36, kleinere Abstände, Avatar 48). |
| `crates/ui/src/auth_kit.rs` | App-Kacheln: Titel wrapsen auf 2 Zeilen (kein Ellipsis-Abschneiden mehr, `one_line()` entfernt), Beschreibung bis 5 Zeilen, Kachelhöhe einheitlich 136 px. |
| `crates/ui/src/components.rs` | Karten-Schatten neutral (schwarz) statt Akzentfarbe → kein violetter Halo um jede Karte. |
| `crates/ui/src/app_store.rs`, `crates/ui/src/gallery.rs` | Vier Tests an den neuen Referenz-Startzustand angepasst (14 aktive Module statt 18, Startmenü 17 statt 21, Escape-Test nutzt `calendar` statt des deaktivierten `fleet`). |
| `crates/core/src/app_store.rs` | `REFERENCE_STARTUP_DISABLED` ist jetzt `pub`, damit UI/Tests dieselbe Quelle nutzen. |

## Folgeblock: Validierungsfehler, Feld-Fokus, Tests

| Datei | Änderung |
|---|---|
| `crates/ui/src/auth_screens.rs` | Der Wizard reserviert bei gesetztem `state.error` ein eigenes Band direkt über der Fußzeile und malt den Fehler dort (Danger-Fläche + Rahmen). Der scrollende Body endet oberhalb des Bandes. |
| `crates/ui/src/auth.rs` | `messages()` hat einen `show_error`-Parameter; die Wizard-Body-Ausgabe übergibt `false` (der Fehler steht im Band), alle anderen Screens `true`. |
| `crates/ui/src/auth_kit.rs` | `focus_from_padding()` (im Browser-Block unten durch die `TextEdit`-Margin abgelöst): ein Klick auf die 16/11-Punkt-Polsterung eines Feldes fokussiert das Textfeld (egui meldet Klicks nur auf dem Glyphenlauf). `register_field()` gibt den Fokus eines gerade geklickten Feldes nicht mehr im selben Frame an egui zurück (`surrender_focus`), wodurch Tippen im vorher fokussierten Feld landete. |
| `crates/web/src/lib.rs` | Doppelter `sync_canvas_size()`-Aufruf entfernt. |
| `crates/ui/tests/wizard.rs` (neu) | Drei Headless-Tests: (a) `a_rejected_continue_shows_the_error_above_the_footer` – der Validierungsfehler wird genau einmal und im Band über der Fußzeile gemalt (y > 780 bei 1512 × 982), (b) `clicking_a_field_padding_focuses_that_field` – ein Klick auf die Feld-Polsterung setzt den Fokus, (c) `typing_reaches_a_clicked_password_field` – der folgende Tastendruck landet im geklickten Feld. Die Datei ist ein Integrationstest-Target (`cargo test --workspace` listet `Running tests/wizard.rs`). |
| `crates/ui/tests/visual.rs` | Uhr-Assertion der Shell-Szenen auf das aktuelle 24-h-Format mit Sekunden (`00:00:01`) umgestellt; die Goldens aller Modul-/Desktop-Szenen neu erzeugt (Badge-Abstand +6 px, neutrale schwarze Kartenschatten, entfernte Widget-Spalte). |

Gates in diesem Block: `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`,
`cargo test -p socdof-ui` (367 Lib-Tests, 10 Keyboard, 2 Visual, 2 Wizard – grün).
Hinweis zur Umgebung: diese Zeilen sind historisch – `clang`/`trunk` waren damals nicht vorhanden.
Inzwischen ist die Toolchain im Home installiert (siehe „Build & Start"), der WASM-Build und der
Browser-Lauf funktionieren; die aktuellen Gates stehen am Ende dieser Datei.

## Browser-Block: echter Wizard-Durchlauf

### Im Browser belegt (Screenshots in `artifacts/browser-wizard/`, gitignored)

| Punkt | Datei | Was zu sehen ist |
|---|---|---|
| Vollständiger Durchlauf | `110-step1.png` … `118-after-create.png` | Sprache → Willkommen → Konto (2) → Darstellung (3) → Apps (4) → Abschluss (5) → Desktop mit „Yuri Strudel @admin" und 12 Kacheln |
| Fehlerband ohne Scrollen | `111-error-band.png`, `114-username.png` | „A display name is required." bzw. „The username needs at least 3 characters." als Band direkt über der Fußzeile; Back/Continue bleiben sichtbar |
| Klick in die Polsterung setzt den Caret | `96-filled.png` (Anzeigename), `135-padding-password.png` (Passwortfeld) | Klick 8 px innerhalb der Feldkante = in der 16-Punkt-Polsterung, danach landet die Eingabe im geklickten Feld; `135` zeigt drei Maskierungspunkte im Passwortfeld |
| Passwort maskiert | `104-both.png` | 11 Punkte je Feld, Auge-Toggle daneben |
| Desktop/Fenster | `118-after-create.png`, `121-dashboard-enter.png` | 12 Kacheln, Taskbar ohne Zahnrad, Fensterband „Dashboard  [DASHBOARD]" |

### Reproduktion

```bash
# Terminal 1 (Toolchain-PATH siehe „Build & Start")
cd crates/web && trunk serve --address 0.0.0.0 --port 3001
```

Playwright im Cloud-Browser-Panel – **alles in einem** `preview_playwright`-Aufruf, weil der
Viewport-Override zwischen Aufrufen zurückfällt. Das folgende Skript ist am 2026-11-22 genau so
ausgeführt worden und endete auf dem Desktop (`178-doc-snippet-start`, `179-doc-snippet-filled`,
`180-taborder-final`, `181-desktop-doc-recipe`):

```js
const client = await context.newCDPSession(page);
await client.send('Emulation.setDeviceMetricsOverride',
  {width: 1512, height: 982, deviceScaleFactor: 1, mobile: false});
await client.send('Network.setCacheDisabled', {cacheDisabled: true});
// Voraussetzung: frische Datenbank, sonst startet die App auf der Anmeldung.
// Nur 'indexeddb' löschen – 'all' löscht auch das Preview-Cookie.
const origin = await page.evaluate(() => location.origin);
await client.send('Storage.clearDataForOrigin', {origin, storageTypes: 'indexeddb'});
await client.send('Page.reload', {ignoreCache: true});
await page.waitForTimeout(9000);
const tap = async (x, y, wait = 700) => { await page.mouse.move(x, y); await page.waitForTimeout(90);
  await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
  await page.waitForTimeout(wait); };
await tap(756, 745);   // Sprachschritt: Continue
await tap(756, 669);   // Willkommen: Continue
await tap(876, 936);   // leerer Konto-Schritt → Fehlerband
await tap(527, 258); await page.keyboard.type('Yuri Strudel', {delay: 25});   // 8 px in der Polsterung
await page.keyboard.press('Tab'); await page.keyboard.type('admin', {delay: 25});
// Tab-Reihenfolge ab Benutzername: Personal, Business, Upload photo, Password, Repeat password.
for (let i = 0; i < 4; i += 1) { await page.keyboard.press('Tab'); await page.waitForTimeout(150); }
await page.keyboard.type('Socdof2026', {delay: 30});
await page.keyboard.press('Shift+Digit1');
await page.keyboard.press('Tab'); await page.waitForTimeout(200);
await page.keyboard.type('Socdof2026', {delay: 30});
await page.keyboard.press('Shift+Digit1');
await tap(876, 936);   // Schritt 3 (Darstellung)
await tap(876, 936);   // Schritt 4 (Apps)
await tap(876, 936);   // Schritt 5 (Abschluss)
await tap(876, 936);   // „Create administrator" → Desktop
```

### Fehler, die dieser Lauf im Produktivcode gefunden hat

| Ort | Fehler | Fix |
|---|---|---|
| `crates/web/src/lib.rs` | `Tab` lief in die Browser-Fokussierung: der DOM-Fokus verließ den Canvas, die UI malte den Caret weiter, jede weitere Taste kam nie an. | `keep_keyboard_focus()` hängt einen `keydown`-Listener an `window`, der `Tab` per `preventDefault()` abfängt (neues `web-sys`-Feature `KeyboardEvent`). |
| `crates/ui/src/auth_kit.rs` | Felder ohne stabile ID: Auto-IDs kollidierten, der Fokus sprang beim Tippen zwischen Feldern. | `TextEdit::id(Id::new(("socdof-field", label)))`. |
| `crates/ui/src/auth_kit.rs` | Polsterung lag im Frame – ein Klick auf die 16/11-Punkt-Polsterung setzte keinen Caret. | Polsterung als `TextEdit::margin` (links 16, rechts 12, oben/unten `padding`), Frame ohne Innenabstand; `focus_from_padding()` entfällt. |
| `crates/ui/src/auth_kit.rs` | Passwortfeld zeigte Klartext, wenn `reveal: Some(false)`. | `masked = !reveal_flag`. |
| `crates/core/src/app_store.rs` (Tests) | Zwei Tests erwarteten alle lizenzierten Module aktiv, obwohl `REFERENCE_STARTUP_DISABLED` vier Module aus dem Startraster nimmt – **auf HEAD nachweislich rot** (Lauf im separaten Worktree, Exit 101, siehe Prüfung unten). | Assertions auf das dokumentierte Startset präzisiert **und verschärft** (inaktive Module namentlich gepinnt, 14 aktive Module); Produktivcode unverändert. |

## Prüfung des Endstands (Audit)

### 1. Waren die zwei Core-Tests auf HEAD wirklich rot?

Ja. Gegen den unveränderten HEAD-Stand (`640c36d`) in einem separaten Worktree:

```bash
git worktree add --detach /tmp/headwt HEAD
cd /tmp/headwt && cargo test -p socdof-core --lib app_store
# test app_store::tests::defaults_include_licensed_modules_and_hide_locked_ones ... FAILED
# test app_store::tests::rejects_repeat_required_and_unknown_modules ... FAILED
# test result: FAILED. 2 passed; 2 failed; 0 ignored; 0 measured; 377 filtered out
echo $?   # 101
cd - && git worktree remove --force /tmp/headwt   # Worktree wieder wegräumen
```

`git diff HEAD -- crates/core/src/app_store.rs` zeigt ausschließlich Hunks im `mod tests` (alle
`@@`-Bereiche > Zeile 388) – der Produktivcode ist identisch zu HEAD. Die Tests wurden also nicht
abgeschwächt, sondern auf das dokumentierte Startset präzisiert **und verschärft**:

* die inaktiven Module müssen jetzt **namentlich** genau `["reports", "support", "therapy", "fleet"]`
  sein (vorher wurde nur „alle lizenzierten aktiv“ geprüft),
* genau **14** Module sind aktiv,
* unverändert: `Locked` nie aktiv, `Required` immer aktiv.

Schärfe-Probe (Konstante testweise `therapy` → `restaurant`):
`left: ["reports", "support", "fleet", "restaurant"]`, `right: ["reports", "support", "therapy", "fleet"]`
→ Test rot; zurückgesetzt → grün. Eine Drift der Konstanten fällt damit auf, vorher nicht.

Nebenbefund: der Doc-Kommentar von `REFERENCE_STARTUP_DISABLED` behauptete, das Startset passe das
Raster exakt an das TS-Original an. Tatsächlich sind 14 Module aktiv, das Raster zeigt 12 Kacheln –
welches Raster gilt, ist Punkt 6 und bleibt offen. Der Kommentar beschreibt jetzt nur noch das
Verhalten und verweist auf die offene Entscheidung.

### 2. Existieren die Belege?

`artifacts/browser-wizard/` enthält 227 PNGs (Stand 2026-11-22): 103 davon in 1890 × 1228
(= 1512 × 982 CSS bei DPR 1.25), die Serie `178`–`181` mit zurückgesetztem DPR in 1512 × 982, der
Rest ältere Teilausschnitte (u. a. 1280 × 960, 540 × 960) aus früheren Blöcken.
Geprüft am 2026-11-22: `110-step1`, `111-error-band`, `112-filled`, `113-appearance`, `115-step3`,
`116-step4`, `117-step5`, `118-after-create`, `121-dashboard-enter`, `96-filled`, `104-both`,
`135-padding-password` – alle vorhanden und inhaltlich gesichtet (Durchlauf, Fehlerband über der
Fußzeile, Caret nach Polsterungs-Klick).

### 3. Reload vs. Sign out (früher Punkt 7) – geklärt

Der damals beobachtete Setup-Neustart (`130-login`, `133-after-reload`, `134-login-fields`,
`136-reload-state`) ist mit dem heutigen Build **nicht reproduzierbar**. Belege und Ursache stehen
im Abschnitt „Punkt 7: Persistenz geklärt“: ein Reload mit vorhandenem Snapshot landet auf der
Anmeldung desselben Kontos (`165-after-reload.png`), „Sign out“ ebenfalls (`147-after-signout.png`),
und ein unlesbarer Snapshot wird nicht mehr mit einem leeren Stand überschrieben
(`167-corrupt-snapshot.png`).

### 4. Umfang des Arbeitsbaums (Abnahme)

`git status --porcelain` listet 136 Einträge: 135 modifizierte Dateien und eine ungetrackte. Jede
ist unten einem Punkt des Auftrags zugeordnet (`artifacts/browser-wizard/` ist gitignored und
erscheint deshalb nicht in `git status`).

| Datei(en) | Rolle im Auftrag |
|---|---|
| `NEXT_STEPS_AI.md` | dieser Bericht |
| `crates/core/src/store/mod.rs` | `SNAPSHOT_DEBOUNCE_MS`, `snapshot_due(now, last_check, user_acted)`, neuer Test (Punkt 7) |
| `crates/core/src/app_store.rs` | Startset-Assertions präzisiert/verschärft, Kommentar verweist auf Punkt 6 |
| `crates/ui/src/auth_kit.rs` | stabile Feld-IDs (`socdof-field`), Polsterung im `TextEdit`-Margin, Maskierung bei `reveal: Some(false)`, `centered`/`page_width` gegen die Fensterbreite geklemmt |
| `crates/ui/src/auth_screens.rs` | Fehlerband über der Fußzeile, `messages(..., show_error)`, Sprachwechsel im Assistenten, `ScrollArea` in `language_step`, umbrechender Passwort-Hinweis |
| `crates/ui/src/focus.rs` | `focus_ring_round(rect, radius)`, damit der Ring dem Radius des Controls folgt |
| `crates/ui/src/dashboard.rs` | KPI-Karten füllen ihre Spalte, zwei Spalten bei schmalem Fenster |
| `crates/ui/src/chrome.rs` | Modul-Kopf: gemessene Reserve für den Back-Button, Untertitel bricht um |
| `crates/ui/src/components.rs` | `tabs` bricht um statt rechts abzuschneiden; `kpi_cards` (KPI-Reihen mit fester Kartenbreite), `empty_state` bleibt innerhalb des Viewports |
| `crates/ui/src/invoice_templates.rs` | Dialog-Mindestbreite folgt dem Fenster, Liste/Editor stapeln |
| `crates/ui/src/auth.rs` | `show_error`-Parameter an `messages()` |
| `crates/ui/tests/visual.rs` | Uhr-Assertion der Shell-Szenen **verschärft** auf `00:00:01` |
| `crates/ui/tests/wizard.rs` (neu, ungetrackt) | drei Headless-Tests (siehe Browser-Block); läuft als Integrationstest-Target `Running tests/wizard.rs` in `cargo test --workspace` |
| `crates/web/src/lib.rs` | `persist(now, user_acted)`, `protect_snapshot`, doppelter `sync_canvas_size()`-Aufruf entfernt, Sprachwechsel |
| `crates/web/src/storage.rs` | `decode_snapshot()` (Uint8Array/ArrayBuffer), `undefined` = Erststart, unlesbarer Wert = Lesefehler |
| `crates/web/index.html` | Kommentar zur Canvas-Größe |
| `Cargo.toml` | `web-sys`-Feature `KeyboardEvent` für den `Tab`-Fokus |
| `crates/ui/tests/golden/*.txt` (112) | neu erzeugte Szenen-Goldens (Badge-Abstand +6 px, neutrale schwarze Kartenschatten, entfernte Widget-Spalte); nur `M`, keine neuen/gelöschten Dateien, reine Textdiffs |

Keine `.orig`/`.rej`/`.bak`-Dateien, keine Editor- oder Temp-Dateien, keine Build-Artefakte im
Repo; `/tmp`-Helfer (`store_backup.rs`, `headwt`) liegen außerhalb und sind entfernt.

## Offene Punkte (Priorität von oben nach unten)

1. ~~**Assistent im echten Browser zu Ende verifizieren.**~~ **Erledigt:** kompletter Durchlauf bis
   zum Desktop (Belege oben). Damit sind auch die Punkte aus dem letzten Block belegt.
2. ~~**Validierungsfehler sind unsichtbar.**~~ **Erledigt:** Fehlerband im Code, Test in
   `crates/ui/tests/wizard.rs` und Browser-Beleg `111-error-band.png`.
3. ~~**Klick auf untere Formularfelder prüfen.**~~ **Erledigt:** `register_field()` gibt den Fokus
   eines geklickten Feldes nicht mehr ab, die Polsterung gehört jetzt zum `TextEdit`; Headless-Tests
   (`clicking_a_field_padding_focuses_that_field`, `typing_reaches_a_clicked_password_field`) und
   Browser-Beleg `96-filled.png` (Anzeigename) / `135-padding-password.png` (Passwortfeld, Klick
   8 px innerhalb der Kante → drei Maskierungspunkte) / `104-both.png`.
4. ~~**Restliche drei Abweichungen im Browser belegen.**~~ **Erledigt:** Fensterband
   (`121-dashboard-enter.png`), App-Kacheln-Wrap (Schritt 4, `116-step4.png`), Taskbar ohne Zahnrad
   (`118-after-create.png`).
5. ~~**Doppelter Aufruf:** `sync_canvas_size();` zweimal in `crates/web/src/lib.rs::update()`.~~
   **Erledigt.**
6. **Produktentscheidung offen – nicht raten:** Das Startraster zeigt die 12 Rust-*Module*,
   nicht die 12 Apps des TS-Originals (App Store, Handbuch, Taschenrechner fehlen als Kacheln,
   dafür erscheinen Point of sale/Users/Text editor/Projects). Der Renderer-Scene `desktop`
   zeigt, dass App Store, Handbuch und Taschenrechner als Desktop-Symbole technisch gehen
   (`DesktopIcon::new(AppId::new("settings"), …)`-Muster in `desktop.rs`). Entscheidung des
   Nutzers abwarten; Modulliste nicht anfassen.
7. ~~**Reload startet im Setup-Assistenten.**~~ **Erledigt und belegt:** ein Reload mit vorhandenem
   Snapshot landet auf der Anmeldung desselben Kontos (`165-after-reload.png`, `166-desktop-after-login.png`),
   „Sign out“ zeigt die Anmeldemaske (`147-after-signout.png`). Ursache des alten Befunds war das
   Speicher-Zeitfenster (Schreiben höchstens alle 400 ms): behoben durch
   `socdof_core::store::snapshot_due` (Schreiben im Frame der Benutzeraktion), dazu
   `protect_snapshot` gegen das Überschreiben eines unlesbaren Snapshots (`167-corrupt-snapshot.png`).
   Details im Abschnitt „Punkt 7: Persistenz geklärt“.

## Punkt 7: Persistenz geklärt – Reload intakt, Sign out sauber, Snapshot geschützt

### Belege (echter WASM-Build, 1512 × 982)

| Fall | Belege | Ergebnis |
|---|---|---|
| Reload mit vorhandenem Snapshot | `164-desktop-created.png`, `165-after-reload.png`, `166-desktop-after-login.png` | Nach dem Anlegen des Admins zeigt ein Reload die **Anmeldung für „Yuri Strudel“** statt des Assistenten; nach Eingabe des Passworts steht der Desktop mit denselben Daten (12 Kacheln, `Yuri Strudel @admin`, DE). Snapshot vor **und** nach dem Reload identisch: 1 122 304 Bytes, enthält `admin` und `Yuri`. |
| Sign out | `147-after-signout.png` | „Sign out“ führt auf die **Anmeldemaske** (Badge „Signed out“, Avatar „YS“, Kacheln „Yuri“ / „Other user“) – kein Setup-Assistent. |
| Kaputter Snapshot | `167-corrupt-snapshot.png` | 34 Bytes Müll im Snapshot → Fehlerband „The local browser storage is unavailable; changes are lost on reload.“, der Snapshot bleibt **unverändert** (34 Bytes, `GARBAGE…`) – kein Überschreiben mit einem leeren Stand. |
| Sauberer Erststart | `161-setup-no-banner.png`, `168-clean-first-run.png` | Ohne Snapshot startet der Assistent ohne Fehlerband. |

Der alte Befund (`130`–`136`) war ein **Speicher-Zeitfenster**: geschrieben wurde höchstens alle
400 ms, ein Tab, der in diesem Fenster neu geladen oder versteckt wurde, verlor die letzte Änderung
(den angelegten Admin).

### Änderungen

| Datei | Änderung |
|---|---|
| `crates/core/src/store/mod.rs` | `snapshot_due(now, last_check, user_acted)`: schreibt im Frame einer Benutzeraktion sofort, Leerlauf-Frames warten die 400 ms ab. Test `a_user_action_is_saved_without_waiting_for_the_debounce` (schlägt fehl, wenn die Aktion wieder in die Debounce fällt). |
| `crates/web/src/lib.rs` | `persist(now, user_acted)` nutzt `snapshot_due`; `protect_snapshot` verhindert jedes Schreiben, wenn der gelesene Snapshot nicht angewendet werden konnte. |
| `crates/web/src/storage.rs` | Snapshot wird als `Uint8Array` **oder** `ArrayBuffer` gelesen; ein fehlender Eintrag (`undefined`) gilt als Erststart, ein vorhandener, aber unlesbarer Wert als Lesefehler statt „leer“ – dadurch wird er nie überschrieben. |

Ehrlicher Zwischenstand: die erste Fassung der Lese-Härtung stufte das `undefined` einer leeren
IndexedDB als Lesefehler ein und blockierte damit das Speichern (Fehlerband). Der Fix derselben
Runde (`is_undefined()`/`is_null()` → Erststart) behebt das; `161-setup-no-banner.png` zeigt den
sauberen Erststart.

### Gegencheck des Tests (Mutation)

Der `user_acted`-Term wurde testweise aus `snapshot_due` entfernt:

```bash
cp crates/core/src/store/mod.rs /tmp/store_backup.rs
sed -i 's/^    user_acted || now\.saturating_sub(last_check) >= SNAPSHOT_DEBOUNCE_MS$/    now.saturating_sub(last_check) >= SNAPSHOT_DEBOUNCE_MS/' crates/core/src/store/mod.rs
cargo test -p socdof-core --lib a_user_action_is_saved_without_waiting_for_the_debounce
# → FAILED: assertion failed: snapshot_due(1_000, 999, true)
cp /tmp/store_backup.rs crates/core/src/store/mod.rs   # diff -q ohne Ausgabe = identisch
cargo test -p socdof-core --lib a_user_action_is_saved_without_waiting_for_the_debounce
# → ok
```

Damit ist belegt: der Test pinnt genau die Korrektur (sofortiges Schreiben bei Benutzeraktion) und
wird rot, sobald sie zurückgenommen wird.

## GUI-Runde: Fokusring, Sprachliste, Hinweis-Überlauf

Gemeldet wurden „viele GUI-Fehler, Dinge die nicht gleich aussehen" und „man konnte oft nicht
scrollen" (mit Screenshot der Sprachkarte). Geprüft und behoben:

| Befund | Ursache | Fix | Beleg |
|---|---|---|---|
| Die gewählte Sprachkarte zeigte zwei Akzent-Rahmen (der innere Kartenrahmen + ein außenliegender Fokusring mit abweichendem Eckenradius). | `focus_ring()` malte immer mit `RADIUS_CONTROL` und wurde auch auf der bereits ausgewählten Zeile gezeichnet. | Neues `focus_ring_round(rect, radius)`; `language_row`/`choice` zeichnen den Ring nur noch, wenn die Zeile **nicht** ausgewählt ist, und mit dem eigenen Radius (16). | vorher: `182-language-ring.png`, nachher: `202-language.png` |
| Der Passwort-Hinweis lief bei schmalem Fenster waagerecht aus der Karte und riss die ganze Spalte mit (Felder wurden rechts abgeschnitten). | Der Hinweis malte seinen Text in `ui.horizontal_top` – dort ist die verfügbare Breite unbegrenzt, `Label` bricht nicht um, und die Scrollfläche wuchs über die Bandbreite. | Text bekommt eine eigene, breitenbegrenzte Spalte (`allocate_ui_with_layout`) mit `Label::wrap(true)`. | `200-account-warning.png` (alt) vs. `204-account-scrolled.png` (neu, zweizeilig innerhalb der Karte) |
| Der Sprachschritt scrollte nicht, obwohl der Code-Kommentar eine scrollende Liste beschreibt. | Als einziger Wizard-Schritt hatte `language_step()` **keine** `ScrollArea`; bei niedrigem Fenster wurden die unteren Zeilen abgeschnitten und das Mausrad hatte kein Ziel. | Liste in eine vertikale `ScrollArea` (max_height = Listenband, `auto_shrink [false,false]`) wie in `setup()`. | Code: `crates/ui/src/auth_screens.rs` |
| Mausrad-Scrollen im Konto-Formular | funktionierte bereits korrekt, hier nur belegt (kein Fix nötig) | – | `196-form-before.png` → `197-form-after.png` |

Wichtig für die Reproduktion: der Watcher des laufenden `trunk serve` hatte seit 15:52 nicht mehr
neu gebaut, sodass frühe Browser-Prüfungen gegen einen alten WASM-Stand liefen. Nach `kill` und
Neustart von `trunk serve` (Build 16:43) sind alle obigen Bilder mit dem neuen Stand entstanden.

`cargo test -p socdof-ui`: 367 Tests + Goldens + `tests/wizard.rs` grün, keine Golden-Änderung
nötig (der Fokusring betrifft nur die Auth-Screens, die nicht in den Szenen-Goldens liegen).

## Modul-Runde: alle Ansichten bei 432 × 768 (natürlicher Panel-Viewport)

Nach der Wizard-Runde wurden alle 12 Launcher-Apps im frisch gebauten WASM geöffnet
(`255-dashboard` … `266-projects`, Sammelbild `267-sweep.png`). Gefunden und behoben:

| Befund | Ursache | Fix | Beleg |
|---|---|---|---|
| Dashboard: die vier KPI-Karten liefen rechts aus dem Fenster („Inventory value" und die zweite Kartenreihe abgeschnitten). | `kpi_card` setzte `min_width(150)`; `ui.columns(4)` verteilt aber nur ~95 Punkte pro Spalte, die Karten wuchsen über die Spalte hinaus. | `kpi_card` füllt die Spalte (`available_width`), und die Reihe wird bei < 700 Punkten auf zwei Karten pro Zeile umgestellt. | nachher `255-dashboard.png` (2 × 3 Karten, alles im Fenster) |
| Modul-Kopf: Untertitel lief unter den „Back"-Button bzw. aus der Karte (z. B. „Browse items, stock levels and replenish…"). | Der Untertitel stand in `ui.horizontal`, dort ist die Breite unbegrenzt — `Label` bricht nicht um. | Textspalte mit exakt reservierter Breite (Back-Button vorher gemessen) + `wrap(true)`. | vorher `256-contacts.png`, `257-products.png`, `259-accounting.png`, `260-purchases.png`; nachher `269-contacts-fixed.png`, `270-accounting-fixed.png` |
| Tab-Leiste (Accounting: „Journal · Cash book · BWA · Business report · V…") wurde abgeschnitten. | `components::tabs` nutzte `ui.horizontal` ohne Umbruch. | `horizontal_wrapped` — die restlichen Tabs rutschen in die nächste Zeile. | Code (`crates/ui/src/components.rs`); im schmalen Fenster nicht mehr nachgestellt |
| Vorlagen-Dialog (Rechnungen) war breiter als ein schmales Fenster. | `ui.set_min_width(760)` im Dialog, Liste und Editor starr nebeneinander. | Mindestbreite auf `available_width().min(760)` geklemmt, Liste/Editor mit `horizontal_wrapped`. | Code (`crates/ui/src/invoice_templates.rs`); nicht nachgestellt |

Goldens: nur die `*dashboard*`-Szenen wurden neu erzeugt (`UPDATE_SNAPSHOTS=1 cargo test -p socdof-ui --test visual`),
alle anderen Szenen bleiben unverändert — der Header-Fix reserviert die Breite des Back-Buttons jetzt
gemessen statt pauschal, damit Untertitel, die noch passen, nicht umbrechen.

### Offen (Produkt-/Designentscheidung nötig)

In den Modul-Toolbars sind einzelne Buttons breiter als die Restzeile und werden deshalb rechts
abgeschnitten (sichtbar: „All contacts" in `256-contacts.png`, „All suppliers" in `260-purchases.png`).
`button()` rendert Labels ohne Umbruch (`layout_no_wrap`), damit ist die Breite fix. Drei Wege:
(a) Label im Button umbrechen (Button wird zweizeilig/höher), (b) den Filter in eine eigene Zeile
setzen, (c) Label mit Ellipse kürzen. Das ändert das Erscheinungsbild aller Toolbars — deshalb
bleibt die Entscheidung beim Nutzer.

### Fixes dieser Runde (432 × 768, je mit Vorher/Nachher)

| # | Befund | Ursache | Fix | Belege |
|---|---|---|---|---|
| 1 | Settings: unter der Tab-Leiste blieb der Inhaltsbereich leer, „General" war aktiv. | `ScrollArea::horizontal().auto_shrink([false, false])` — die Tab-Leiste schrumpfte **nicht** in der Höhe, belegte den ganzen Rest-Viewport und schob Überschrift + Inhalt unter den sichtbaren Bereich. | `.auto_shrink([false, true])` (Breite füllen, Höhe am Inhalt). | `zz-settings-before-empty.png` → `zz-settings-content-visible.png` |
| 2 | Settings-Header: das Badge „02 / 11" lag über dem Untertitel. | Badge wurde per `right_to_left` **nach** dem Textblock platziert, der bereits die volle Restbreite beansprucht hatte. | Badge-Breite vorab gemessen (`layout_no_wrap` + 20 px) und dem Textblock per `set_max_width` als Reserve abgezogen. | `zz-settings-before-badge.png` → `zz-settings-after-badge.png`; 1512 px unverändert: `zz-settings-1512.png` |
| 3 | Text-Editor bei 432 px: rechte Spalte (Neues Dokument, Toolbar „Bold/Italic/…") war rechts abgeschnitten. | Feste Zweispalten-Anordnung: linke Spalte `set_width(310)` + rechte Spalte mit `set_min_width(available_width)`; zusammen breiter als das Fenster, äußere ScrollArea nur vertikal. | Unter 720 px verfügbarer Breite stapeln (Liste über Editor), darüber unverändert zweispaltig. | `zz-editor-before-clip.png` → `zz-editor-after-stacked.png` |
| 4 | **Projects** bei 432 px: die Kachel öffnete kein Modul — ein leeres Fenster mit dem Desktop-Hinweis, ohne Back. | Der **Web-Host** (`crates/web/src/lib.rs`) hatte für `projects` (und `fleet`) **weder** einen Arm in `open_screen` **noch** in `render_screen`; der `_`-Zweig kehrte still zurück, und das von der Shell gezeichnete Fenster blieb ohne Inhalt. Die Kachel-Registry (`desktop_icons`) listet beide Slugs, die Screens fehlten. | Beide Slugs vollständig verdrahtet: State-Felder (`ProjectsState`, `FleetState`), `reset_for_open` in `open_screen`, `app_window`-Arme mit Back/Close in `render_screen`. | `zz-projects-stub-432.png` → `zz-projects-kpi-after.png`, Back: `zz-projects-back-after.png` |
| 5 | Projects-KPI-Reihe: die dritte Karte („Completed tasks") wurde zu einer Zeichenspalte gequetscht bzw. lief rechts aus dem Fenster. | `horizontal_wrapped` mit inhaltsgroßen Karten: die letzte Karte bekam den Reststreifen. | Explizite Reihen mit berechneter Spaltenzahl (4 ab 900 px, sonst 2) und fester Kartenbreite. | `zz-projects-kpi-before.png` → `zz-projects-kpi-after.png` |
| 6 | Projects-Portfolio: Liste und Detail lagen in `ui.columns(2)` und wurden bei 432 px auf ~190 px je Spalte gequetscht („Select a pro…"). | Zwei Spalten ohne Rücksicht auf die verfügbare Breite. | Unter 760 px eine Spalte (`columns(1)`), Detail unter der Liste; darüber unverändert zweispaltig. | `zz-projects-after-stacked.png` |
| 7 | Registry und Dispatch waren nicht deckungsgleich: `desktop_icons` listete 16 der 18 `ALL_MODULES` (ohne `documentation`, `restaurant`), im Web-Host fehlten zusätzlich `projects`/`fleet`. `documentation` hatte gar keinen Vollbild-Screen und keine Back-Taste. | Die Modul-Liste (`ALL_MODULES`), die Kachel-Registry (`desktop_icons`) und die Screens (`open_screen`/`render_screen`) wurden getrennt gepflegt. | Alle 18 Module sind jetzt in Kachel-Registry und Screen-Dispatch vorhanden; `documentation` bekam `back` und einen Vollbild-Wrapper mit `module_header`. | Kompiliert + Gates; **kein Browser-Beleg** (siehe unten) |
| 8 | **Restaurant** bei 432 px: dritte KPI-Karte („Menu items") auf eine Zeichenspalte gequetscht. | KPI-Reihe als `horizontal_wrapped` mit inhaltsgroßen Karten. | Gemeinsamer Helfer `components::kpi_cards` (4 Spalten ab 900 px, sonst 2, feste Kartenbreite). | `zz-restaurant-kpi-before.png` → `zz-restaurant-432.png` |
| 9 | **Fleet** bei 432 px: dieselbe gequetschte KPI-Karte („Fuel costs") **und** die Zeile „From … To" lief rechts aus dem Fenster, das Suchfeld fehlte. | KPI-Reihe wie oben; Datums-/Suchfelder lagen **innerhalb** der umbrechenden Tab-Zeile, wo kein Platz mehr war. | `kpi_cards` für die KPIs; Datumsbereich und Suche in eigene `ui.horizontal`-Zeilen **außerhalb** der Tab-Zeile. | `zz-fleet-kpi-before.png` → `zz-fleet-432.png` |
| 10 | **Manual (Documentation)** bei 432 px: Titel und Untertitel erschienen doppelt (Header + Fenster-Renderer). | Der neue Vollbild-Wrapper rief `documentation_window` auf, das selbst Titel/Untertitel zeichnet. | Body in `documentation_body` extrahiert; Header-Wrapper und Fenster-Renderer nutzen ihn ohne eigene Überschrift. | `zz-documentation-432.png` (keine doppelte Überschrift) |
| 11 | Nach dem Schließen des App Store blieb ein leeres Fenster „Dashboard" mit dem Desktop-Hinweis stehen. | Der Web-Host zeichnet Module als Vollbild-Screens, ließ aber die Fenster-Einträge des `WindowManager` stehen; der content-lose Desktop-Pfad malt dafür den Hinweis. | `render_desktop` setzt den `WindowManager` nach jedem Frame zurück. | `zz-fleet-back.png` (Desktop ohne Fensterrest) |


Build-Frische nach jedem Fix geprüft (PID-Neustart, `sha256` dist == ausgelieferte Datei, im Browser
geladene URL): `42a1d4baedc070ae` → `949f72b88498579a` → `7b3e7198440f5293` → `cdbc4aed4b4111e3` →
`b39413092126e134` → `156f9f0f73e7a5d8` → `d82d3b93b4a09feb` → `e0de80df4d0d8f21`.

### Abdeckung 432 × 768 — belegt

* Startraster ohne Start-Panel: `c1-desktop-432.png`, `r1-desktop-432.png`
* Start-Panel: `c2-launcher-432.png`
* Module (jeweils Ansicht + `-back`-Beleg mit geschlossenem Panel): `p-dashboard`, `p-contacts`,
  `p-products`, `p-invoices`, `p-accounting`, `p-purchases`, `p-pos`, `p-calendar`, `p-users`,
  Editor → `zz-editor-after-stacked.png` (`r-editor-back.png`), Settings → `zz-settings-after-badge.png`
* Dialog „Neuer Kontakt": `zz-contact-dialog-432.png`
* Sprachkarte: `zz-language-after.png` (vorher `zz-before-language-clip.png`)

### Runde 3: Durchlauf über alle 18 Kacheln (432 × 768)

Build dieser Runde: `socdof-web-2b81ec906efae0e2_bg.wasm`; `sha256` der Datei in `crates/web/dist`,
über HTTP und der im Browser geladenen URL ist identisch (`81cffdd125691822…`). Aufgenommen wurde
jeweils direkt nach dem PID-Neustart von `trunk serve` (Build-Wechsel: `ecbc24516712b20` →
`48670af581db12f5` → `6dd301ec3fc735c0` → `2b81ec906efae0e2`).

Pro Modul zwei Belege: `zz-<modul>-432.png` (Kachel-Doppelklick → Vollbild mit Icon, Titel, Untertitel
und echtem Inhalt) und `zz-<modul>-back.png` (Back → 18er-Kachelraster, kein `_`-Zweig, kein
Fensterrest).

| Modul | Ansicht | Back | Modul | Ansicht | Back |
|---|---|---|---|---|---|
| Dashboard | `zz-dashboard-432.png` | `zz-dashboard-back.png` | Reports | `zz-reports-432.png` | `zz-reports-back.png` |
| Contacts | `zz-contacts-432.png` | `zz-contacts-back.png` | Therapy | `zz-therapy-432.png` | `zz-therapy-back.png` |
| Products | `zz-products-432.png` | `zz-products-back.png` | Users | `zz-users-432.png` | `zz-users-back.png` |
| Invoices | `zz-invoices-432.png` | `zz-invoices-back.png` | Settings | `zz-settings-432.png` | `zz-settings-back.png` |
| Accounting | `zz-accounting-432.png` | `zz-accounting-back.png` | Text editor | `zz-editor-432.png` | `zz-editor-back.png` |
| Purchases | `zz-purchases-432.png` | `zz-purchases-back.png` | Projects | `zz-projects-432.png` | `zz-projects-back.png` |
| Point of sale | `zz-pos-432.png` | `zz-pos-back.png` | Fleet | `zz-fleet-432.png` | `zz-fleet-back.png` |
| Calendar | `zz-calendar-432.png` | `zz-calendar-back.png` | Restaurant | `zz-restaurant-432.png` | `zz-restaurant-back.png` |
| Support | `zz-support-432.png` | `zz-support-back.png` | Manual | `zz-documentation-432.png` | `zz-documentation-back.png` |

**Freischaltung über den echten App-Store-Pfad** (Auslieferungs-Defaults unverändert): frisches
Konto startet mit 14 Kacheln; Dashboard → Quick actions → App Store (`zz-appstore-432.png`); dort
`reports`, `support`, `therapy` und `fleet` über „Activate“ freigeschaltet; die Kacheln erscheinen
sofort nach dem Verlassen des Stores (`zz-desktop-18-tiles.png`, 18 Kacheln; aktueller Endstand
derselben Strecke aus Runde 4: `zz-grid-18.png`). Ältere Belege derselben Strecke:
`zz-appstore-fleet-inactive.png`, `zz-fleet-activated.png`, `zz-desktop-15-tiles.png`.

**Dashboard- und Modul-Vollbild:** Der Web-Host zeichnet Module als Vollbild-Screens mit `app_chrome`
(Icon, Titel, Untertitel, Back/Close). `documentation`/`restaurant` sind ab Werk aktiv und haben seit
Zeile 7 auch Kachel und Screen — aktiv = Kachel, deaktiv = keine Kachel, geprüft auf beiden Seiten
(14er-Raster nach Setup, 18er-Raster nach Freischaltung).

### Fixes der Runde 3

| # | Befund | Ursache | Fix | Beleg |
|---|---|---|---|---|
| 12 | Reports: die KPI-Zeile lief 24 px über die Panelkante (Hintergrundrect endete bei 1024 statt 1000; Golden `light-*-reports.txt` rot). | `kpi_cards` rechnete die Kartenbreite ohne die Lücke, die `ui.horizontal` selbst zwischen den Karten einfügt, und addierte zusätzlich 8 px — bei vier Spalten 24 px Overflow. | Kartenbreite aus `ui.spacing().item_spacing.x` berechnet, zusätzliches `add_space` entfernt; die vier `*reports`-Goldens neu erzeugt (`UPDATE_SNAPSHOTS=1 cargo test -p socdof-ui --test visual`), alle anderen Szenen unverändert. | `zz-reports-432.png` (7 KPIs 2 × 2 lesbar) |
| 13 | Purchases: die Empty-State-Karte war breiter als der Viewport — rechter Rahmen fehlte, der Hinweis war abgeschnitten („…and the“). | Die Toolbar-Zeile (Suche + „All suppliers“) ist breiter als das Panel und vergrößert die Mindestbreite des Parents; die Karte erbte sie und malte über die Kante. | `empty_state` begrenzt seine Breite auf `clip_rect().right() - cursor().min.x - 2 * CARD_PADDING`; Karte und Hinweis passen wieder. Die Toolbar selbst bleibt unangetastet (offene Entscheidung a/b/c). | `zz-purchases-432.png` |
| 14 | `cargo clippy -- -D warnings` rot: `reports::kpi` war nach der Umstellung auf `kpi_cards` unbenutzt. | toter Helfer. | entfernt. | `CLIPPY=0` |

### Fixes der Runde 4 (432 × 768 und Home-Grid)

Öffnungsbreite der Module: 432 px, Web-Host-Build `bf039b6012d425ed`, WASM-SHA256
`d6867c6d99fd9b58` (das ist derselbe Build, aus dem alle Belege unten stammen).

| # | Befund | Ursache | Fix | Beleg |
|---|---|---|---|---|
| 15 | Toolbar-Zeile lief bei 432 px rechts aus dem Panel: „All contacts", „All suppliers", „All payment methods", „Export" (Accounting), „New" (Therapy) — Labels halb sichtbar, teils außerhalb. | Die Module bauten Suchfeld und Aktionen je selbst in einer `ui.horizontal`-Zeile und gaben dem Suchfeld nur eine kleine Reserve; bei 432 px blieb für die Aktionen kein Platz. | Neuer gemeinsamer Helfer `components::toolbar(ui, focus, reserve, search, actions)`: unter `TOOLBAR_STACK_WIDTH` (560 px) steht das Suchfeld in einer eigenen Zeile, die Aktionen rutschen darunter und brechen selbst um. In allen fünf Modulen verdrahtet (Contacts, Purchases, POS, Accounting, Therapy); `reserve` ist die echte Aktionsbreite, damit die Zeile oberhalb 560 px wie bisher einzeilig bleibt. | `zz-contacts-432.png`, `zz-purchases-432.png`, `zz-pos-432.png`, `zz-accounting-432.png`, `zz-therapy-432.png`; Wide: `zz-wide-contacts.png`, `zz-wide-purchases.png`, `zz-wide-pos.png`, `zz-wide-accounting.png`, `zz-wide-therapy.png` |
| 16 | POS „Daily close" und die Users-Tabelle waren breiter als 432 px: Werte („Cash", Rollen/Badges) wurden abgeschnitten bzw. die Zeile scrollte horizontal. | Beide Tabellen legten alle Spalten in eine feste Rasterzeile, die die Panelbreite überschritt. | Unter 560 px stapeln beide: POS zeigt Bon-Nr. + Zeit + Zahlungs-Badge, darunter Positionen/Total/Wechselgeld; die Daily-Close-Kachel nutzt `day_summary` (2–5 Spalten je Breite) statt einer umbrechenden Zeile. Users zeigt Name + `@user`, darunter Rolle, Status und Badges. Ab 560 px bleibt das bisherige Raster unverändert. | `zz-pos-432.png`, `zz-users-432.png`, `zz-(pos|users)-back.png`; Wide: `zz-wide-pos.png`, `zz-wide-users.png` |
| 17 | Home-Grid: Control-Leiste oben rechts lag über der Kachel „Products", der Konto-Chip über den Labels der sechsten Reihe (Fleet/Restaurant/Manual). | Das kompakte Raster startete bei `y = 0` mit festem Zeilenabstand (114 px) und kannte das Chip-Band nicht; der Chip war im Web-Host mit `-76` verankert. | `COMPACT_ORIGIN_Y = DESKTOP_CONTROL_HEIGHT + 8` (Grid beginnt unter der Leiste), neue `compact_step_y(desktop)` (min. 96 / max. 114, an die verfügbare Höhe angepasst) und `SESSION_CHIP_BAND = 60` halten die sechste Reihe frei; `cell_rect`/`cell_at` nutzen beides. Der Web-Host verankert den Chip bei `-(TASKBAR_HEIGHT + 8)` statt bei `-76`. Zwei Grid-Tests decken 14 und 18 Kacheln ab. | `zz-grid-14.png`, `zz-grid-18.png`, `zz-wide-desktop.png` |
| 18 | `*purchases.txt`-Goldens zeigten die alte, über den Rand laufende Toolbar. | Beabsichtigte Layout-Änderung aus #15. | Nur die 8 `*purchases`-Goldens neu erzeugt; alle übrigen Szenen byte-gleich (per `sha256sum`-Vergleich belegt). | `crates/ui/tests/golden/*purchases.txt` |

Neue Tests: `the_narrow_panel_keeps_the_whole_receipt_list_inside` (POS rendert mit `seed_pos` bei 432 px
und prüft Bon-Nr., Zahlungsart und `painted_right_edge <= 432.5`),
`the_compact_grid_matches_the_legacy_phone_layout`,
`the_compact_grid_stays_clear_of_the_control_bar_and_the_session_chip` (14 und 18 Kacheln).

### Fixes der Runde 5 (Erstlauf-Wizard bei 432 px)

Build `c0c5d30d1ad09fe1`, WASM-SHA256 `5fd4ee5459dceb58` — alle Belege dieser Runde stammen aus
diesem Build.

| # | Befund | Ursache | Fix | Beleg |
|---|---|---|---|---|
| 19 | Schritt 4 „Apps": die Zeile „Choose individual apps" und der Hilfetext „Selected apps appear on your desktop." lagen bei 432 px übereinander (der Hilfetext stand mitten in der Überschrift). | Überschrift links, Hilfe per `Layout::right_to_left` rechts in derselben `ui.horizontal`-Zeile; bei zu schmalem Panel nimmt die rechte Seite die Restbreite und malt über die Überschrift. | Die Zeile entscheidet jetzt anhand gemessener Textbreiten (`layout_no_wrap` + 24 pt Luft), ob beide nebeneinander passen; sonst steht die Hilfe in einer eigenen Zeile unter der Überschrift. Ab 1512 px bleibt die einzeilige Referenz erhalten. | `zz-wizard-apps-432.png`, `zz-wizard-apps-wide.png` |
| 20 | Die Vorlagen-Kacheln („Personal", „Business", „Practice & therapy", „Retail") zeigten den Auswahl-Haken **über** dem Titel, der Titel war zusätzlich abgeschnitten. | Der Titel bekam `max(80.0)` px Breite, während der Haken bei `rechte Kante − 36` beginnt — bei ~154 px Kachelbreite liegt der Textbereich damit unter dem Haken. | Neue Regel `TILE_STACK_WIDTH = 210.0` / `tile_stacks(width)`: unterhalb dieser Breite stapeln die Kacheln Icon-Zeile (mit Haken rechts) und Textspalte über die volle Breite; darüber bleibt das Referenz-Layout (Icon links, Titel rechts). | `zz-wizard-apps-432.png`, `zz-wizard-apps-wide.png` |

Neue Tests: `the_apps_step_keeps_the_hint_below_the_heading_on_a_phone` (rendert Schritt 4 bei 432 und
1512 px, misst die y-Position beider Texte: gestapelt ≥ 12 px Abstand bzw. gleiche Zeile) und
`narrow_tiles_stack_their_copy_below_the_icon` (Kachelbreiten 154/260 px).

### Fixes der Runde 6 (interaktive Formulare und Dialoge, 432 × 768)

Build `ff2478de930f1c7a` (Port 3001); Wide-Belege stammen aus demselben Build nach `Page.reload`
bei 1512 × 982 und erneuter Anmeldung.

| # | Ablauf | Ursache | Fix | Test | Beleg |
|---|---|---|---|---|---|
| 21 | POS → „New receipt" → Positionszeile (Quantity · Unit price · VAT · Remove): „Unit price" war bei 432 px buchstabenweise zusammengepresst, das dritte Feld lief über die Panelkante (gemessene rechte Kante **616,19 px**). Die Aktionsbuttons des Bons lagen dadurch unter dem Feldstapel. | `controls::text_field` setzt `desired_width(f32::INFINITY)`; in einer `ui.horizontal`-Zeile beansprucht das erste Feld die gesamte Restbreite, die übrigen bekommen einen Rest von wenigen Pixeln. | Neuer gemeinsamer Breakpoint `components::FORM_STACK_WIDTH = 560.0`: darunter steht jedes Feld in einer eigenen Zeile, der Entfernen-Button darunter; darüber bleibt die Zeile horizontal. | `the_receipt_form_fits_the_phone_panel` (`crates/ui/tests/forms.rs`, rendert das Formular bei 432 und prüft die gemalten Ränder) | `zz-form-pos-432.png`, `zz-form-pos-bottom-432.png` |
| 22 | Purchases → „New purchase order" → Positionszeile (Quantity · Unit cost · VAT · Remove): gleiches Muster, die Card wuchs auf **588 px** (rechte Kante 616,19 px). | Wie Zeile 21. | Derselbe Breakpoint in `purchases::form_view`. | `the_purchase_form_fits_the_phone_panel` | `zz-form-purchases-432.png` |
| 23 | Derselbe Ablauf bei **1512 × 982**: die Zeile blieb auch im Referenz-Layout unbrauchbar — „Unit price" und „VAT" standen als Buchstabensäule am rechten Rand. Das Referenzlayout war also schon vor dieser Runde defekt, nur ungemessen. | Ohne Breakpoint gewinnt in der horizontalen Zeile ebenfalls das erste Feld die volle Breite; die Spalten waren nie explizit breit. | Neuer Helfer `components::form_column_widths(available, spacing, columns, action_width)` / `form_columns(ui, …)`: drei gleich breite Spalten, 110 px für den Entfernen-Button, 12 px Luft gegen den Zeilenumbruch (`MIN_FORM_COLUMN_WIDTH = 120`). Bei 432 px bleibt die gestapelte Variante aus Zeile 21/22. | `form_columns_keep_a_usable_width` (Unit-Test: 1400 px → drei Spalten > 400 px, Summe passt; 380 px → keine Spalte unter 120 px) | `zz-form-pos-wide.png` |
| 24 | POS → „New receipt" → „Cancel": ein leerer Bon schließt **ohne** Rückfrage (kein Dialog im Browser); der Verwerfen-Dialog (Titel, Text, zwei Buttons) wurde deshalb headless bei 432 px geprüft. | Kein Layout-Defekt gefunden — Dialog und beide Buttons liegen innerhalb des Panels. | — (nur abgesichert) | `the_discard_dialog_fits_the_phone_panel` | `zz-dialog-pos-cancel-432.png` (Runde 7: echter „Cancel receipt"-Dialog, siehe #28) |

Geprüft ohne Befund (jeweils real geöffnet, 432 × 768):

* Contacts „New contact" (`zz-form-contacts-432.png`), Users „Create user" (zweispaltige Zeilen
  Name/Benutzername und Passwort/Wiederholung bleiben lesbar, `zz-form-users-432.png`),
  Accounting „New booking" (`zz-form-accounting-432.png`), Therapy „New client"
  (`zz-form-therapy-432.png`). Therapy war ab Werk nicht im Startraster und wurde für diese Runde
  über den App Store freigeschaltet (`zz-flow-therapy-list.png`).
* Therapy-Mileage-Log (Datumsfeld + numerische Felder) und das Therapy-Fehlerband nach leerem
  Speichern („Please enter a name." oben + Inline-Fehler über den Buttons) passen bei 432 px
  (`zz-form-therapy-432.png`, `zz-form-therapy-error-432.png`).
* Wide-Stichprobe 1512 × 982 nach Reload: POS-Formular (`zz-form-pos-wide.png`) zeigt die drei
  Spalten wieder nebeneinander, Labels auf einer Zeile; POS- und Contacts-Liste unverändert
  (`zz-flow-pos-wide-list.png`, `zz-flow-contacts-wide-list.png`).
* Beim Setup-Schritt 2 (Passwort-Wiederholung) saß das Fehlerband zwischen Body und Fußzeile, in
  einer Scrollposition berührte die letzte Body-Zeile den oberen Bandrand um ~3 px. **Behoben in
  Runde 7 (#25)** — das Band reserviert jetzt 16 px Abstand (`ERROR_BAND_GAP`).

Neue Tests dieser Runde: `crates/ui/tests/forms.rs` mit sechs Formular-Tests
(`the_contact_form_fits_the_phone_panel`, `the_purchase_form_fits_the_phone_panel`,
`the_receipt_form_fits_the_phone_panel`, `the_booking_form_fits_the_phone_panel`,
`the_user_form_fits_the_phone_panel`, `the_client_form_fits_the_phone_panel`) plus
`the_discard_dialog_fits_the_phone_panel`, dazu `components::tests::form_columns_keep_a_usable_width`.
Die zwei Formular-Tests für POS und Purchases waren vor dem Fix rot („a painted element reaches
616.19 px").

### Fixes der Runde 7 (Abschluss der drei offenen Punkte)

Build `488e6bfec28a7450` (Port 3001); die Browser-Belege dieser Runde stammen aus diesem Build,
432 × 768 direkt nach dem Erstlauf-Setup bzw. 1512 × 982 nach `Page.reload` und Anmeldung.

| # | Befund | Ursache | Fix | Test | Beleg |
|---|---|---|---|---|---|
| 25 | Setup-Schritt 2 bei 432 px: Nach „Continue" mit zwei verschiedenen Passwörtern saß das Fehlerband direkt auf der zuletzt sichtbaren Formularzeile — im Wide-Lauf berührte die Zeile „Recovery question" den oberen Bandrand, weil der Body-Viewport nur 5 px über dem Band endete. | Die Höhenreservierung arbeitete mit Magic Numbers (`+16.0` Polster, `- 8.0` Abstand). Der Scroll-Body endete damit 5 px über dem Band, eine angeschnittene Zeile klebte am Bandrahmen; im Wide-Layout ragte der Body ungeclippt in den Bandbereich. | Neue benannte Konstanten `ERROR_BAND_PADDING = 8.0` und `ERROR_BAND_GAP = 16.0`: das Band reserviert 16 px Abstand zum Body (statt 8), die Nachricht sitzt über `ERROR_BAND_PADDING` statt über eine zentrierte Rechnung. Kein Pixel-Nudge am Screenshot. | `the_error_band_stays_clear_of_the_form_rows_on_a_phone` (rendert Schritt 2 mit `auth_error_password_mismatch` bei 432 × 768, misst Body-Clip und Bandoberkante: ≥ 12 px Abstand, keine Textzeile im Band, Fehler genau einmal gemalt). Gegenprobe: mit `ERROR_BAND_GAP = 8.0` schlägt der Test fehl („the body ends 5.0 px above the error band"). | `zz-setup-error-432.png` (Band, „Recovery question" und beide Antwortzeilen mit sichtbarem Abstand) |
| 26 | POS → Bon öffnen → „Receipt details" bei 432 px: die Positions-Tabelle (6 Spalten) lief rechts aus dem Panel — „2.299,00 €" und die Spalte „VAT" waren abgeschnitten (gemessen 522,35 px). | Feste `egui::Grid` mit `num_columns(6)` ohne Breakpoint; fünfstellige Beträge brauchen mehr Breite als das Panel bietet. | Unter `FORM_STACK_WIDTH` steht jede Position gestapelt: Beschreibung als eigene Zeile, darunter `Menge × Einzelpreis = Brutto · MwSt` in kleiner Schrift; darüber bleibt das Referenz-Grid unverändert. | `the_receipt_detail_fits_the_phone_panel` (Bon mit 14.399,00 € Brutto rendert bei 432; Gegenprobe mit abgeschaltetem Breakpoint: „a painted element reaches 522.35 px") | `zz-detail-pos-432.png` |
| 27 | Punkt 2 der Aufgabe — Wide-Beleg fürs Contacts-Formular: **Contacts hat keine mehrspaltige Zeile.** Das Formular ist bei jeder Breite einspaltig (Name, Firma, E-Mail, Telefon, Adresse, …), der `form_columns`-Pfad existiert nur in den Positionszeilen von POS und Purchases. | Kein Defekt, sondern die Form des Formulars; die Annahme „dreispaltig" traf auf Contacts nicht zu. | Kein Codeeingriff. Belegt: Contacts-Formular bei 1512 × 982 nach Reload, alle Labels einzeilig, Felder über die volle Breite; die dreispaltige Anordnung desselben Code-Pfads zeigt `zz-form-pos-wide.png`. | — (bestehender Test `the_contact_form_fits_the_phone_panel` deckt das 432-Layout) | `zz-form-contacts-wide.png`, `zz-form-pos-wide.png` |
| 28 | Punkt 3 der Aufgabe — POS-Verwerfen-Dialog im Browser: „Cancel receipt" öffnet bei einem **gespeicherten** Bon den Bestätigungsdialog; bei einem leeren, ungespeicherten Bon schließt „Cancel" ohne Rückfrage (bewusst: es gibt nichts zu verwerfen). | Kein Defekt — der Dialog hing nie am leeren Bon, sondern an der Stornierung eines gespeicherten Bons. | Kein Codeeingriff; der Ablauf wurde real durchgeklickt (Bon mit Position anlegen → speichern → Detail → „Cancel receipt"). | `the_discard_dialog_fits_the_phone_panel` (headless, 432) | `zz-dialog-pos-cancel-432.png` |

Reproduktion der drei Punkte im Browser (432 × 768, Englisch, frisches Konto):

1. IndexedDB `socdof` löschen, Seite neu laden → Sprache „English" → Continue → Continue.
2. Schritt 2: Display name + Username tippen, nach unten scrollen, Passwort `Socdof2026!` und
   Wiederholung `Socdof2025!` eintragen → Continue → Band „The passwords do not match." steht mit
   Abstand unter „Recovery question"/den Antwortzeilen (`zz-setup-error-432.png`).
3. Wiederholung korrigieren, weiter bis „Create administrator" → Desktop.
4. POS → „New receipt" → Beschreibung + Preis → „Save receipt" → Detail → „Cancel receipt" →
   Dialog mit Titel, Text und den beiden Buttons (`zz-dialog-pos-cancel-432.png`); darunter liegt die
   gestapelte Positionszeile (`zz-detail-pos-432.png`).

### Belegt (Module) und offene Punkte

* **Projects, Fleet, Restaurant und Manual sind belegt** (Zeilen 4–11): Kachel → Vollbild mit echtem Inhalt
  → Back → Desktop ohne Fensterrest. `zz-desktop-18-tiles.png` zeigt alle 18 freigeschalteten Kacheln
  inklusive Fleet, Restaurant und Manual; die ältere 15er-Aufnahme ist `zz-desktop-15-tiles.png`.
* **Freischalt-Pfad ist funktionsfähig** — vollständige Strecke mit diesem Build in „Runde 3" oben
  (`zz-appstore-432.png` → `zz-desktop-18-tiles.png`). Für die 14er-Aufnahme in `zz-grid-14.png`
  wurden Reports, Support, Therapy und Fleet im App Store deaktiviert und danach wieder aktiviert
  (Endstand: `zz-grid-18.png` mit 18 Kacheln).
  `documentation`/`restaurant` waren ab Werk aktiv, fehlten aber in der Kachel-Registry (Zeile 7).
* **Erledigt in Runde 4 (#15):** die Toolbar-Reihe passt bei 432 px in das Panel — Suchfeld eigene
  Zeile, Aktionen darunter, alle Labels vollständig lesbar. Belege: `zz-contacts-432.png`,
  `zz-purchases-432.png`, `zz-pos-432.png`, `zz-accounting-432.png`, `zz-therapy-432.png`.
* **Erledigt in Runde 4 (#16):** POS „Daily close" und die Users-Tabelle passen ohne horizontales
  Scrollen in 432 px. Belege: `zz-pos-432.png`, `zz-users-432.png`.
* **Erledigt in Runde 4 (#17):** auf dem Home-Grid überlappt nichts mehr — weder die Control-Leiste
  mit „Products" noch der Konto-Chip mit der sechsten Reihe, bei 14 und 18 Kacheln.
  Belege: `zz-grid-14.png`, `zz-grid-18.png`.
* **Offen — Nutzerentscheidung:** Punkt 6 (12 Rust-Module vs. 12 TS-Apps).
* **Geklärt in Runde 5 — die helle Linie im Wide-Desktop:** Der Browser-Canvas zeichnet bei
  Viewports ab ~1000 px eine ~2 px breite, fast weiße Linie von der Oberkante bis y ≈ 120 CSS-Pixel
  bei x ≈ 290 CSS-Pixel (im Screenshot x = 363 bei Faktor 1.25), also am rechten Rand der
  Settings-Kachel. Messungen: identische Position bei 1490, 1511 und 1512 px Breite; auf dem
  Lock-Screen und in den Modul-Vollbildern fehlt sie; bei 432 px tritt sie nicht auf. Im
  Headless-Render (`snapshot::signature` bei 1512 × 982) existiert keine solche Form — es ist also
  kein Layout-Element der App, sondern ein Compositing-Artefakt des Canvas unter der fraktionalen
  DPR 1.25 des Cloud-Browsers. Sie überdeckt weder Labels noch Klickziele; die drei Punkte der
  Runde 4 sind davon unberührt (`zz-wide-desktop.png`, `zz-wide-contacts.png` usw. zeigen den
  Desktop bzw. die Module nach einem Reload bei 1512 px).
* `support`, `reports`, `therapy` fehlen als Kacheln, weil `REFERENCE_STARTUP_DISABLED` sie ab Werk
  deaktiviert — das ist gewollter Auslieferungszustand; über den App Store sind sie aktivierbar.

### Hinweis zur Testführung (wichtig für die nächste Runde)

Die App rendert vollständig in **ein** `<canvas>`: `document.querySelectorAll('canvas').length == 1`,
`0` Elemente mit `role`/`aria-label`, `getByRole('button', {name:'Settings'})` findet nichts.
DOM-/Text-Locators sind hier also technisch unmöglich; Navigation läuft über Kachel-Doppelklick,
Rückweg über die Kopf-Taste „Back" (CSS ≈ 341,128 bei 432 px) oder `Escape` (nur Settings reagiert),
mit Screenshot-Verifikation nach jedem Schritt. Ein `Page.reload` führt in den Lock-Screen; bei
gelöschter IndexedDB startet die App im Setup (Testkonto `admin` / `Socdof2026!`).

## Praktische Hinweise für Browser-Tests (Playwright)

* Der echte Viewport des Cloud-Browsers ist **432 × 768** (`innerWidth`), die Screenshots sind
  dagegen 1890 × 1228. Der Override (`Emulation.setDeviceMetricsOverride`) gilt nur **pro
  `preview_playwright`-Aufruf** und fällt danach zurück. Deshalb: Override + Navigation + Klicks +
  Screenshots immer in einem Aufruf, Laufzeit < 120 s.
* Pointer-Mapping ist bei aktivem 1512 × 982-Override 1:1 zu CSS-Pixeln.
* `page.mouse.click(x, y)` wird von diesem Canvas oft verschluckt; zuverlässig ist
  `move → down → 70 ms → up → 200 ms` (siehe `tap()` oben).
* Gemessene Klickziele bei 1512 × 982 (Englisch, Schritt 2, Personal):
  Sprache-Karte Continue ≈ (756, 745), Willkommen-Continue ≈ (756, 669),
  Anzeigename ≈ y 258, Benutzername ≈ y 357, Passwort ≈ y 700, Passwort wiederholen ≈ y 810,
  Fußzeile y ≈ 936 (Back x ≈ 636, Continue x ≈ 876). Mit aufgeklapptem Business-Panel verschiebt
  sich alles nach unten.
* Tab-Reihenfolge: Anzeigename → Benutzername → Personal → Business → Upload photo → Passwort →
  Passwort wiederholen. Vom Benutzernamen sind es also **4** Tabs bis zum Passwort, von dort **1**
  bis zur Wiederholung (gemessen in `172-tab-order` / `180-taborder-final`).
* Einzelne Zeichen direkt nach einem Tab gehen im Canvas manchmal verloren; ganze Strings mit
  `delay: 25–40` tippen (so verifiziert).
* Texteingabe: `page.keyboard.type(text, { delay: 20–90 })` funktioniert; `insertText` wird
  gelegentlich ignoriert. Sonderzeichen (z. B. `!`) einzeln per `Shift+Digit1` schicken und mit
  einem Screenshot verifizieren, sonst fehlt das Zeichen und die Passwort-Validierung schlägt fehl.
* `artifacts/` ist gitignored; Screenshots dort sind Arbeitsbelege, nicht Teil des Commits.
* Test-Admin (falls die DB neu aufgesetzt wird): Benutzer `admin`, Passwort `Socdof2026!`.
* Datenbank leeren: nur IndexedDB/OPFS löschen, **nicht** Cookies (siehe Preview-Auth oben).

### Fixes der Runde 8 (alle Modul-Screens bei 432 px)

Die Runde prüft die noch nicht abgedeckten Modul-Listen und -Details bei 432 × 768. Die Belege sind
**Headless-Renderings** derselben Screen-Funktionen (`socdof-ui-preview`, 432 × 771 bzw. 1512 × 982),
keine Browser-Aufnahmen; die Geometrie stammt aus dem echten Paint-Code.

| # | Befund | Ursache | Fix | Test | Beleg |
|---|---|---|---|---|---|
| 29 | Produkte, Support, Kalender, Berichte und Rechnungen liefen bei 432 px rechts aus dem Panel (382–714 px). | Feste `egui::Grid`s mit 3–5 Spalten; die Namens-/Betreff-Buttons brechen nicht um und treiben die Spalte auf. | Unter `FORM_STACK_WIDTH` steht jede Zeile gestapelt: Name/Betreff als Button, darunter die Werte in kleiner Schrift, Badges in einer umbrechenden Zeile. Darüber bleibt das Grid unverändert. | `the_products_screen_fits_the_phone_panel`, `the_support_screen_fits_the_phone_panel`, `the_appointments_screen_fits_the_phone_panel`, `the_reports_screen_fits_the_phone_panel`, `the_invoices_screen_fits_the_phone_panel` | `zz-phone-products-432.png`, `zz-phone-support-432.png`, `zz-phone-calendar-432.png`, `zz-phone-reports-432.png`, `zz-phone-invoices-432.png` |
| 30 | Die gemeinsamen KPI-Karten liefen bei 432 px auf 448–557 px (Fleet, Projekte, Restaurant, Berichte, Dashboard); zwei Spalten waren nicht lesbar. | `kpi_cards` rechnete die Spaltenbreite aus `available_width`, der Kartenrahmen addiert danach `CARD_PADDING` je Seite; zusätzlich sind deutsche Komposita („Kilometerpauschale") nicht umbrechbar. | Die Kartenbreite ist jetzt der Slot **minus** beider Rahmenpolster (der Inhalt trägt die Breite), und unter `FORM_STACK_WIDTH` bekommt jede Karte eine eigene Zeile. | Modul-Sweep deckt die Aufrufer ab; `the_dashboard_fits_the_phone_panel` prüft die eigene Dashboard-Zeile | `zz-phone-dashboard-432.png`, `zz-phone-reports-432.png`, `zz-wide-dashboard-1512.png` (4 Spalten unverändert) |
| 31 | Projekte: Kopfzeile (Titel, Export, „Neues Projekt") und die drei Filterboxen liefen bei 432 px bis 557 px. | `ui.horizontal` mit rechtsbündigem Button plus `horizontal_wrapped`, in dem die ComboBoxes nicht umbrechen. | Unter `FORM_STACK_WIDTH` stehen Export und „Neues Projekt" in einer eigenen umbrechenden Zeile; die Filterboxen haben generell eine eigene Zeile (vorher teilten sie sich die Tab-Zeile). | `the_projects_screen_fits_the_phone_panel` | — (kein Gallery-Scene; headless Test) |
| 32 | Editor: die Formatierungsleiste (7 Buttons) lief bei 432 px bis 703 px. | `ui.horizontal` ohne Umbruch. | `horizontal_wrapped`; bei 1000 px zeigte das Golden denselben Überlauf (1059 px), deshalb wurden `*-editor*.txt` als beabsichtigte Layoutänderung neu erzeugt. | `the_editor_screen_fits_the_phone_panel` | `zz-phone-editor-432.png` |
| 33 | Fleet: zweite Filterbox bei x 480, Suchfeld bis x 447. | Filterboxen teilten sich die umbrechende Tab-Zeile; das Suchfeld rechnete `available_width() - 8` in einer `ui.horizontal`, wo `available_width` die **Zeilenbreite** ist, nicht der Rest neben dem Label. | Filterboxen in eigener Zeile; Suchfeldbreite abzüglich Labelbreite und Abstand. | `the_fleet_screen_fits_the_phone_panel` | — (kein Gallery-Scene; headless Test) |
| 34 | Restaurant: das 4-spaltige Tischraster und beide Suchfelder liefen bis 448 px. | `Grid` mit vier Tischkarten bzw. TextEdit mit Default-Breite neben einem Label. | Unter `FORM_STACK_WIDTH` zwei Tische pro Zeile; beide Suchfelder nehmen die Restbreite neben dem Label. | `the_restaurant_screen_fits_the_phone_panel` | — (kein Gallery-Scene; headless Test) |
| 35 | Einstellungen: Personalisierung bis 504 px, Benutzer-Tabelle bis 630 px, Rollen bis 700 px. | Zwei `ui.columns`, 5-Spalten-Grids und eine Toolbar, deren Suchfeld den Aktionsbutton verdrängte. | Unter `FORM_STACK_WIDTH` eine Spalte statt zwei, gestapelte Benutzer-/Rollenzeilen, reservierte Breite für die Toolbar-Aktion. | `every_settings_tab_fits_the_phone_panel` (alle 13 Tabs) | `zz-phone-settings-appearance-432.png`, `zz-phone-settings-users-432.png` |
| 36 | Detailansichten: Produkt bis 523 px (Titel + drei Badges), Rechnung bis 1338 px (Aktionsreihe und 6-Spalten-Positionen), Ticket (Badges, 5 Aktionen, Zeit-Grid). | `ui.horizontal`-Reihen ohne Umbruch und Grids ohne Breakpoint. | Titel/Badges und Aktionsreihen umbrechen; Rechnungs- und Zeitpositionen stapeln unter `FORM_STACK_WIDTH` mit Betrag/MwSt in kleiner Schrift. | `the_product_detail_fits_the_phone_panel`, `the_invoice_detail_fits_the_phone_panel`, `the_ticket_detail_fits_the_phone_panel` | `zz-phone-support-432.png`, `zz-phone-users-detail-432.png` |
| 37 | Im neuen gestapelten Zeit-Bereich des Tickets stand `support_time_remove` statt der Beschriftung. | Der Schlüssel existiert nicht; der Grid-Pfad nutzt `support_time_delete`. | Schlüssel korrigiert; der Ticket-Test verlangt die übersetzte Beschriftung und verbietet den Rohschlüssel im Paint-Output. | `the_ticket_detail_fits_the_phone_panel` | `zz-phone-support-432.png` |
| 38 | Dashboard-KPIs blieben bei 432 px zweispaltig und quetschten „Bestand zu Einstandspreisen". | Die Dashboard-Zeile hat eine eigene 4/2-Spalten-Logik und nutzte `kpi_cards` nicht. | Unter `FORM_STACK_WIDTH` eine Karte pro Zeile; ab 560 px zwei, ab 700 px vier wie bisher. | `the_dashboard_fits_the_phone_panel` | `zz-phone-dashboard-432.png` |

Neue Testdatei `crates/ui/tests/phone.rs` (17 Tests): Sie rendert die Modul-Screens, alle 13
Einstellungs-Tabs und vier Detailansichten bei 432 × 768 und schlägt fehl, wenn ein Shape über
432,5 px hinausragt. Schatten (6 px außerhalb der Karte) und Inhalte, die von einem **schmaleren**
Clip-Rechteck beschnitten werden (horizontale Scroll-Bereiche wie die Settings-Tab-Leiste), zählen
nicht als Überlauf — nur am Panel abgeschnittene Inhalte.

## Gates am Ende dieses Blocks

```bash
export PATH="$HOME/.local/llvm18/usr/lib/llvm-18/bin:$HOME/.cargo/bin:$PATH"
cargo fmt --all -- --check                              # exit 0
cargo clippy --workspace --all-targets -- -D warnings  # exit 0
cargo test --workspace                                  # exit 0, alle Ergebnisblöcke „ok"
```

Letzter Lauf (2026-11-23, Runde 8, nach der letzten Codeänderung dieses Blocks — Modul-Screens,
KPI-Karten, Detailansichten und Dashboard bei 432 px): `FMT=0`, `CLIPPY=0`, `TESTS=0`,
41 Ergebnisblöcke „ok“, zusammen **927 Tests** (910 + 17 Tests in `crates/ui/tests/phone.rs`).

* `socdof-core`: 382 Lib-Tests grün (381 + neuer `a_user_action_is_saved_without_waiting_for_the_debounce`);
  zwei Assertions an `REFERENCE_STARTUP_DISABLED` angepasst und verschärft (siehe Prüfung oben).
* `socdof-ui`: 371 Lib-Tests (`form_columns_keep_a_usable_width`), 10 Keyboard, 2 Visual, 5 Wizard,
  8 Forms und 17 Phone-Tests (`the_products_screen_fits_the_phone_panel` …
  `the_ticket_detail_fits_the_phone_panel`, `every_settings_tab_fits_the_phone_panel`) grün.
* Wide-Goldens: nur `*-editor*.txt` wurden neu erzeugt, weil die Formatierungsleiste dort schon bei
  1000 px über den Rand lief (1059 px im alten Golden); alle anderen Goldens blieben byte-gleich.
* Belege der Runde 5 wurden auf einem frischen Konto erzeugt (Setup-Wizard komplett durchlaufen,
  Konto `admin` / `Socdof2026!`, 14 Kacheln ab Werk; Reports, Support, Therapy und Fleet danach im
  App Store freigeschaltet → `zz-grid-18.png`).
* Gegenprobe gegen HEAD (`640c36d`, separater Worktree): dieselben zwei Core-Tests rot, Exit 101 –
  die Änderung ist eine Assertion-Angleichung, keine verdeckte Regression.
* WASM: `trunk build` exit 0, `trunk serve` auf Port 3001; Browser-Lauf und Persistenzfälle wie oben
  belegt (Reload → Anmeldung desselben Kontos → Desktop mit denselben Daten; kaputter Snapshot wird
  nicht überschrieben).
* Nichts committet, nichts gepusht; `NEXT_STEPS_AI.md` und die Codeänderungen liegen als
  Arbeitsstand im Worktree.

### Runde 9: Sweep über alle Views bei 432 px

Die Runde ersetzt die Stichproben aus Runde 8 durch einen **vollständigen Sweep**. Das neue
In-Crate-Testmodul `crates/ui/src/phone_sweep.rs` (eingebunden über `#[cfg(test)] mod phone_sweep;`
in `lib.rs`) rendert **142 Fälle** bei 432 × 768 und misst dieselbe Überlauf-Metrik wie
`crates/ui/tests/phone.rs`: Shapes, die am Panelrand (432,5 px) abgeschnitten werden. Schatten
(`Color32([0, 0, 0, 5])`) und der Panelhintergrund zählen nicht; ein **schmaleres** Clip-Rechteck
(horizontale Scroll-Bereiche) gilt als scrollbar und nicht als Überlauf.

Abgedeckt sind 18 Module mit Listen, Tabs, Details, Formularen und Dialogen, dazu Auth (6 Views,
6 Setup-Schritte, Fehlerband), die Settings-Flows (Benutzer-/Rollen-Editor, Neuanlage, Lösch- und
Restore-Bestätigung, Sprach-Popup), vier Dropdowns, der Toast-Stack und die Desktop-Shell
(Basis, Startmenü, Power-Flyout, Befehlspalette, Tray, Onboarding, Task-View, Overflow-Variante,
drei Studio-Tabs).

**Vollständigkeit ist erzwungen**, nicht dokumentiert:

* `report.covered` wird gegen `ALL_MODULES` (18 Einträge) geprüft — ein neues Modul ohne
  Sweep-Fall bricht `every_screen_fits_the_phone_panel`.
* Jedes View-Enum (`PurchasesView`, `AccountingTab`, `AppointmentsView`, `SettingsTab`, die
  Auth-Schritte, die Desktop-Overlays …) wird in einer exhaustiven `match`-Funktion abgedeckt;
  eine neue Variante ist damit ein Kompilierfehler.
* Zusätzlich verlangt der Test `cases > 80`, damit Fälle nicht stillschweigend verschwinden.
* Ein Fall gilt als gemalt, wenn mindestens ein `text(`-Primitive im Frame liegt (der Header
  wechselt pro View); `_painted` bleibt nur dokumentarisch.

Gefundene und an der Ursache behobene Überläufe (gemeinsamer Breakpoint `FORM_STACK_WIDTH` = 560):

| Bereich | Befund bei 432 px | Fix |
|---|---|---|
| Bestellungen | Liste, Positionszeilen und Aktionsreihe liefen bis 480–557 px | Zeilen und Aktionen stapeln, Beträge in kleiner Schrift |
| Lagerbewegungen | `ScrollArea` mit breitem Journal und vier Summenkarten bis 600 px | Journal gestapelt, Summenkarten einspaltig |
| Buchhaltung | Journal, UStVA-Tabelle und benutzerdefinierte Datumsfelder | Tabellen stapeln, Datumsfelder untereinander, `available_width().min(clip_rect().width())` |
| Rechnungen | Positionsfelder (Menge/Preis/MwSt) in einer Zeile | Felder gestapelt |
| Kalender | Wochenraster (561 px) und Formularzeilen | Tage als Blöcke, Formularfelder einspaltig |
| Benutzer | Detailkarte und Aktionsreihe | Aktionen umbrechen, Werte unter den Labels |
| Kontakte | Importfenster mit fester `default_width` | Fensterbreite folgt der Panelbreite |
| Einstellungen | Rollenformular und Permission-Zeilen bis 504 px | Formular und Zeilen gestapelt |
| Therapie | KPI-Karten, Sitzungszeilen und Datumszeile | einspaltig bzw. umbrechend |
| Projekte | Kanban mit einer Spalte pro Status, Task-Zeilen | eine Spalte, Tasks gestapelt |
| Restaurant | Gerichteliste und Gerichteformular | Zeilen/Formular gestapelt |
| Fehlerband | langes Validierungs-Badge bis 729 px | `badge` bricht Text unter 560 px um (Höhe wächst), kurze Badges bleiben byte-gleich |
| Shell | Befehlspalette 458 px / x −26, Onboarding 448 px / x −16, Power-Flyout 444 px | Breiten folgen `screen_rect()`, Flyout-Klemmung berücksichtigt das Frame-Padding |

Beim Sichten der neuen 432-px-Belege kamen drei weitere Defekte dazu, die reine Breitenmessung
nicht sieht (Überlappung statt Überlauf):

| Bereich | Befund | Fix |
|---|---|---|
| Produkte → Lagerbewegungen | Kopfzeile: Titel verdrängt, „CSV exportieren" und „Bewegung erfassen" übereinander | unter 560 px Titelzeile und Aktionszeile getrennt |
| Kalender → Woche | Datumsbereich am rechten Rand abgeschnitten | unter 560 px eigene Zeile unter der Navigation |
| Kalender → Woche | Tageskarte nur ~180 px breit, Termintitel gequetscht | Tageskarte füllt die Panelbreite |

Wichtig für die Goldens: `badge` misst zuerst einzeilig und bricht **nur** unter 560 px und nur
dann um, wenn der Text nicht passt. Dadurch bleiben alle breiten Goldens byte-gleich; ein erster
Versuch mit unbedingtem Umbruch änderte 15 Goldens und wurde verworfen.

### Gates am Ende von Runde 9

```bash
export PATH="$HOME/.local/llvm18/usr/lib/llvm-18/bin:$HOME/.cargo/bin:$PATH"
cargo fmt --all -- --check                              # exit 0
cargo clippy --workspace --all-targets -- -D warnings  # exit 0
cargo test --workspace                                  # exit 0, alle Ergebnisblöcke „ok"
```

Letzter Lauf (2026-11-23, Runde 9, nach dem letzten Fix): `FMT=0`, `CLIPPY=0`, `TESTS=0`,
41 Ergebnisblöcke „ok", zusammen **928 Tests** (927 aus Runde 8 + `every_screen_fits_the_phone_panel`).
Der Sweep selbst meldet 0 von 142 Fällen über der Panelgrenze; `crates/ui/tests/phone.rs` bleibt
unverändert und grün.

### Belege der Runde 9

Alle Belege sind **Headless-Renderings** von `socdof-ui-preview` bei 432 × 771 (hell, Deutsch) und
wurden einzeln mit `cloud_read_image` geprüft — keine Browser-Aufnahmen, keine Interaktion:

* `zz-sweep-purchases-detail-432.png`, `zz-sweep-purchases-form-432.png`
* `zz-sweep-accounting-vat-432.png`, `zz-sweep-accounting-custom-432.png`
* `zz-sweep-invoices-form-432.png`, `zz-sweep-products-journal-432.png`
* `zz-sweep-calendar-week-432.png`, `zz-sweep-calendar-form-432.png`
* `zz-purchases-432.png`, `zz-accounting-432.png`, `zz-users-detail-432.png`, `zz-therapy-432.png`
* `zz-palette-432.png`, `zz-onboarding-432.png`, `zz-power-flyout-432.png`

Die neuen Szenen (`purchases-detail`, `purchases-form`, `accounting-vat`, `accounting-custom`,
`invoices-form`, `products-journal`, `calendar-week`, `calendar-form`) stehen dafür in
`crates/ui/src/bin/preview.rs` und sind dort auch in der Szenenliste registriert.

Grenzen der Belege: Der Settings-Rollen-Editor und die Lösch-/Restore-Bestätigungen waren in
Runde 9 nur sweep-geprüft; Runde 12 macht sie über den öffentlichen Intent-Pfad zu echten Szenen
(siehe unten).
Ebenso sind nicht alle 142 Sweep-Fälle als Bild abgelegt — die Bilder zeigen je Modul die
reparierten Listen/Details/Formulare und alle vier Shell-Overlays.

### Runde 10: alle echten Handy-Breiten, hell und dunkel

Der Sweep aus Runde 9 läuft jetzt als Matrix: **360, 390, 412 und 432 px × hell/dunkel**. Jede
Kombination startet mit frischen Beispieldaten und rendert dieselben **143 Fälle**; zusammen sind
das **1144 Fälle** bei 432,5 px Panel-Grenze (relativ zur jeweiligen Breite). Die Metrik ist
unverändert: nur Shapes, die am Panel abgeschnitten werden; Schatten und schmaler geclippte
Scroll-Bereiche bleiben ausgenommen (der Wizard-Schatten ist jetzt als getönter Schatten
`Color32([0, 0, 1, 5])` explizit mit erfasst).

Die Vollständigkeitsgarantie ist breiter geworden:

* `ALL_MODULES` (18) wird **pro Breite/Theme-Kombination** gegen `report.covered` geprüft.
* Jede Kombination muss dieselbe Fallzahl liefern (`per_combo`-Assertion) — ein nur für eine
  Breite gebauter Fall bricht den Test.
* Die exhaustiven `match`-Funktionen je View-Enum bleiben unverändert scharf.
* `cases > 80` pro Kombination bleibt bestehen.

Gefundene und behobene Defekte (alle unter `FORM_STACK_WIDTH` = 560):

| # | Bereich / Breite | Befund | Fix |
|---|---|---|---|
| 39 | Alle Modul-Header, 360 px | Titel („Benutzerkonto") lief unter den reservierten „Zurück"-Button; Admin-Badges überdeckten ihn | unter 560 px gestapelter Header: Icon + umbrechender Titel/Badges, Untertitel, „Zurück" in eigener Zeile |
| 40 | Benutzer-Detail, 360 px | Langer Kontoname + zwei Badges trieben die Karte auf 370,9 px | Namenszeile `horizontal_wrapped` |
| 41 | Therapie-Liste, 360/390 px | 4-Spalten-Grid 397,1 px; Karte blieb außerdem ein schmaler Streifen | gestapelte Klientenblöcke, Karte füllt die Panelbreite |
| 42 | Rechnungen-Liste, 360/390/412 px | Suchfeld + „Vorlagen" + „Neue Rechnung" endeten bei 431,6 px | unter 560 px Suchfeld eigene Zeile, Buttons umbrechend; Listenkarte füllt die Breite |
| 43 | Kalender Monat, 360/390/412 px | 7×Tagesbuttons mit festem Padding: 415,8 px Inhalt | kompaktes eigenes Raster, Zellenbreite aus `available_width`, Klick/„heute"-Markierung erhalten |
| 44 | Editor, 360 px | Aktionszeile 369,9 px: `add_enabled_ui` ist nicht umbruchfähig, „Löschen" blieb in Zeile 1 | unter 560 px Buttons direkt in `horizontal_wrapped`, Statistik in eigener Zeile |
| 45 | Editor, Rechtschreibprüfung, 360 px | Wörterbuch-Hinweis malte über Titel und Badge | unter 560 px Hinweis in eigener Zeile, Titel umbricht |
| 46 | Produkte-Formular, 360 px | Switch „Vom Nachbestellvorschlag ausnehmen" (Layout ohne Umbruch) trieb die Karte auf 365,2 px | `switch` bricht lange Labels in die Restbreite um, Zeilenhöhe wächst |
| 47 | Kontakte-Sammelanlage, 360/390 px | Fenster mit `default_width(720)` schrumpfte nur auf 372/392,9 px | Startbreite `(screen - 64).clamp(280, 720)` |
| 48 | Bestätigungsdialoge (Therapie, POS), 360 px | Auto-Size ignorierte `max_width`; Fenster 363–371 px, linke Kante bei −6 px | `modal` begrenzt zusätzlich die Inhaltsbreite auf `screen - 48`; Fließtext bricht um |
| 49 | Auth-Wizard, 360 px | Der 6-px-Card-Schatten endete bei 366 px | getönter Schatten als dokumentierter Schatten ausgenommen; Karte selbst endet bei 354 px |
| 50 | Badge-Regel, 360 px | Prüfung der Regel: langes Fehlerband (`accounting_error_period`, 116 Zeichen) | neuer Sweep-Fall + Szene `purchases-error`; Badge bricht in 3 Zeilen, nichts wird abgeschnitten (siehe Belege) |

Die Badge-Regel selbst bleibt: einzeilig messen, nur unter 560 px und nur bei zu langem Text
umbrechen, Höhe wächst. Dadurch sind alle breiten Goldens unverändert; der Visual-Test mit den
900/1000-px-Goldens läuft byte-gleich (`2 passed`).

### Gates am Ende von Runde 10

```bash
export PATH="$HOME/.local/llvm18/usr/lib/llvm-18/bin:$HOME/.cargo/bin:$PATH"
cargo fmt --all -- --check                              # exit 0
cargo clippy --workspace --all-targets -- -D warnings  # exit 0
cargo test --workspace                                  # exit 0, 41 Ergebnisblöcke „ok"
```

Letzter Lauf (2026-11-23, Runde 10): `FMT=0`, `CLIPPY=0`, `TESTS=0`, **928 Tests** (unverändert
zur Runde 9; der Sweep ist ein Test mit 1144 Fällen). Der Sweep meldet **0 Überläufe** über alle
8 Breiten-/Theme-Kombinationen.

### Belege der Runde 10 (360 px, hell und dunkel)

Headless-Renderings von `socdof-ui-preview` bei 360 px Breite, einzeln mit `cloud_read_image`
geprüft. Die `-full`-Bilder sind absichtlich höher (1300/1900 px), damit die unterhalb des
Viewports liegenden reparierten Zeilen sichtbar sind:

* `zz-360-badge-light.png`, `zz-360-badge-dark.png` — 116-Zeichen-Fehlerband bricht in 3 Zeilen
* `zz-360-users-detail-light.png`, `zz-360-users-detail-dark.png` — gestapelter Header, lange Namenszeile
* `zz-360-therapy-list-light.png`, `zz-360-therapy-list-dark.png` — gestapelte Klienten, volle Kartenbreite
* `zz-360-invoices-light.png`, `zz-360-invoices-dark.png` — Suchfeld/Buttons getrennt, volle Karte
* `zz-360-editor-light.png`, `zz-360-editor-dark.png` sowie `-full-*` — Aktionszeile umbrochen, Statistik separat
* `zz-360-calendar-light.png`, `zz-360-calendar-dark.png` — kompaktes Monatsraster
* `zz-360-products-form-light.png`, `zz-360-products-form-dark.png` sowie `-full-*` — Switch-Label umbrochen
* `zz-360-palette-light.png`, `zz-360-palette-dark.png` — Palette innerhalb 360 px
* `zz-360-start-menu-power-light.png`, `zz-360-start-menu-power-dark.png` — Power-Flyout innerhalb 360 px

Neue Szenen dafür: `therapy-list`, `products-form`, `purchases-error` in
`crates/ui/src/bin/preview.rs`.

Grenzen: Dialoge (Löschbestätigung, Sammelanlage) und die Auth-Schritte waren in Runde 10 nur
sweep-geprüft; Runde 11 ergänzt dafür eigene Szenen und Belege. 768-px-Bilder zeigen naturgemäß nur
den oberen Viewport, deshalb die hohen `-full`-Bilder.
Nichts gestaged, nichts committet.

### Runde 11: unabhängige Nachprüfung und Falsifikation der Garantien

Der Sweep-Report wird jetzt vom Test selbst ausgegeben (`-- --nocapture`). Nach `cargo clean -p
socdof-ui` und frischem Clippy-/Test-Build meldet er für alle acht Kombinationen dieselben Zahlen:

```text
phone sweep: 360 px Light: 18 modules, 143 cases, 0 overflows
phone sweep: 360 px Dark:  18 modules, 143 cases, 0 overflows
phone sweep: 390 px Light: 18 modules, 143 cases, 0 overflows
phone sweep: 390 px Dark:  18 modules, 143 cases, 0 overflows
phone sweep: 412 px Light: 18 modules, 143 cases, 0 overflows
phone sweep: 412 px Dark:  18 modules, 143 cases, 0 overflows
phone sweep: 432 px Light: 18 modules, 143 cases, 0 overflows
phone sweep: 432 px Dark:  18 modules, 143 cases, 0 overflows
phone sweep total: 1144 cases across 8 width/theme combinations, 0 overflows
```

Die 18 Module sind pro Kombination geprüft (`report.covered.len()`), die Fallzahl ist mit 143 pro
Kombination identisch (`per_combo`-Assertion), die Gesamtzahl 1144 = 143 × 8.

#### Falsifikationsprobe A: Modul ohne Sweep-Fall

`report.cover(AppModule::Restaurant);` wurde aus `sweep_restaurant` entfernt. Ergebnis: **Exit 101**,
der Test bricht vor jeder Layout-Auswertung mit dem exakten Text:

```text
thread 'phone_sweep::every_screen_fits_the_phone_panel' panicked at crates/ui/src/phone_sweep.rs:455:17:
Restaurant is registered in ALL_MODULES but the phone sweep does not cover it at 360 px, Light
```

Damit ist belegt: die Modul-Abdeckung wird nicht durch einen Default-Zweig oder eine gesammelte
Modul-Liste umgangen. Datei per Backup wiederhergestellt, `sha256sum -c` → `OK`; danach Sweep grün.

#### Falsifikationsprobe B: View-Enum-Wert ohne Abdeckung

`ProductsView::Journal => …` wurde aus der exhaustiven `match`-Funktion `products_case` entfernt.
Ergebnis: **Exit 101** schon beim Kompilieren, exakt:

```text
error[E0004]: non-exhaustive patterns: `products::ProductsView::Journal` not covered
   --> crates/ui/src/phone_sweep.rs:240:11
    |           ^^^^ pattern `products::ProductsView::Journal` not covered
```

Kein `_ => {}` fängt die neue Variante ab; ein neuer Enum-Wert bricht den Test-Crate-Build.
Datei per Backup wiederhergestellt, `sha256sum -c` → `OK`.

#### Weitere Nachweise

* Gates aus aufgeräumtem Zustand (`cargo clean -p socdof-ui`, 1291 Dateien/2,1 GiB entfernt):
  `FMT=0`, `CLIPPY=0`, `TESTS=0`, **928 Tests** in 41 „ok"-Blöcken.
* Breite Goldens: `sha256sum` über alle `crates/ui/tests/golden/*.txt` vor und nach der Runde
  identisch (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`); der
  Visual-Test (900/1000 px) ist Teil des Workspace-Laufs und grün.
* `git status --short`: Pfadliste vor/nach der Runde identisch (`diff` leer), nichts gestaged
  (`git diff --cached` leer), nichts committet.

#### Neue Belege (360 px, hell/dunkel)

Zusätzliche Szenen: `purchases-delete`, `contacts-batch` sowie die Auth-Schritte
(`auth-language`, `auth-welcome`, `auth-setup`, `auth-appearance`, `auth-apps`, `auth-unlocked`).
Einzeln geprüft: `zz-360-purchases-delete-light/dark.png` (Dialog 340 px breit, Text umbrochen),
`zz-360-contacts-batch-light/dark.png` (Fenster 344 px, drei Kontaktzeilen lesbar),
`zz-360-auth-setup-light/dark.png` und `zz-360-auth-appearance-light/dark.png` (Karte 348 px,
kein Panel-Austritt). Die übrigen Auth-Bilder liegen als Beleg daneben.

Verbleibende Grenzen: Die Belege sind Renderings, keine Browser-Interaktion; sehr hohe Dialoge
scrollen vertikal, was die 768-px-Bilder nicht zeigen. Nichts gestaged, nichts committet.

### Runde 12: Rollen-Editor und Lösch-/Restore-Dialoge über den öffentlichen Pfad

Die letzten drei Flows wurden bisher über `#[cfg(test)]`-Hooks geöffnet. Diese Hooks sind entfernt.
Der Produktivcode hat jetzt einen echten Reduzer:

* `pub enum SettingsIntent` mit `NewUser`, `EditUser(Uuid)`, `NewRole`, `EditRole(Uuid)`,
  `DeleteUser(Uuid)`, `DeleteRole(Uuid)`, `RequestRestore { archive, target }`,
  `OpenLanguagePopup`.
* `SettingsState::dispatch(intent, store)` ist der einzige Pfad; **die Buttons im Screen rufen ihn
  selbst auf** (Benutzer-/Rollen-Tab, Löschen im Editor, „Wiederherstellen" im Backup-Tab).
* `SettingsState::users()` und `roles()` sind schreibgeschützte Zugriffe, damit Host, Szenen und
  Sweep die Intents mit echten IDs adressieren können.
* Der Sweep und die neuen Preview-Szenen benutzen ausschließlich `dispatch` — kein Test-Konstruktor,
  kein direkter Feldzugriff.

Zusätzlich hat der Sweep eine eigene **Flow-Registry**: `SettingsFlow` mit sieben Einträgen
(`UserEditor`, `NewUser`, `RoleEditor`, `NewRole`, `DeleteConfirm`, `RestoreConfirm`,
`LanguagePopup`). Pro Breite/Theme wird `report.covered_flows` gegen `SETTINGS_FLOWS` geprüft.
Der Report lautet jetzt:

```text
phone sweep: 360 px Light: 18 modules, 7 settings flows, 143 cases, 0 overflows
phone sweep: 360 px Dark:  18 modules, 7 settings flows, 143 cases, 0 overflows
phone sweep: 390 px Light: 18 modules, 7 settings flows, 143 cases, 0 overflows
phone sweep: 390 px Dark:  18 modules, 7 settings flows, 143 cases, 0 overflows
phone sweep: 412 px Light: 18 modules, 7 settings flows, 143 cases, 0 overflows
phone sweep: 412 px Dark:  18 modules, 7 settings flows, 143 cases, 0 overflows
phone sweep: 432 px Light: 18 modules, 7 settings flows, 143 cases, 0 overflows
phone sweep: 432 px Dark:  18 modules, 7 settings flows, 143 cases, 0 overflows
phone sweep total: 1144 cases across 8 width/theme combinations, 0 overflows
```

#### Falsifikation 1: echter Überlauf im Restore-Dialog

Temporär `ui.set_min_width(600.0);` im Inhalt von `restore_modal` ergänzt. Der Sweep bricht mit
**Exit 101** und nennt Flow, Breite und Theme:

```text
16 of 1144 phone cases (360/390/412/432 px, light/dark) overflow their panel:
settings restore dialog at 360 × 768 px, Light: a painted element reaches 496 px, the panel ends at 360.5 px
settings restore dialog at 360 × 768 px, Dark: a painted element reaches 496 px, the panel ends at 360.5 px
```

Datei aus Backup zurückgespielt, `sha256sum -c` → `OK`; danach Sweep wieder 0 Überläufe.

#### Falsifikation 2: neuer, nicht abgedeckter Dialog

Temporär `SettingsFlow::FutureDialog` in Enum und `SETTINGS_FLOWS` ergänzt (ohne Fall). Der Test
bricht mit **Exit 101**:

```text
FutureDialog is a settings editor or dialog flow but the phone sweep does not cover it at 360 px, Light
```

Damit ist das Vollständigkeits-Gate auch für Dialoge falsifiziert, nicht nur für Module.
Datei aus Backup zurückgespielt, `sha256sum -c` → `OK`.

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 41 Blöcke „ok", **928 Tests** (unverändert)
* Golden-Hash aller `crates/ui/tests/golden/*.txt` unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`), Visual-Test 900/1000 px
  byte-gleich.
* `git status --short` Pfadliste vor/nach identisch, **155** Einträge; `git diff --cached` leer.

#### Belege (360 px, hell/dunkel)

Neue Szenen `settings-role-form`, `settings-delete`, `settings-restore`, geöffnet über
`SettingsIntent`:

* `zz-360-settings-role-form-light/dark.png` und `zz-360-settings-role-form-full-light/dark.png`
  (1400 px hoch: Rollenname, Beschreibung und die gestapelten Permission-Zeilen)
* `zz-360-settings-delete-light/dark.png` (Dialog 314 px breit, Text umbrochen)
* `zz-360-settings-restore-light/dark.png` (314 px, langer Archivpfad bricht auf zwei Zeilen)

Alle sechs wurden einzeln mit `cloud_read_image` geprüft; zusätzlich die `-full`-Bilder.

Verbleibende Grenzen: Die Belege sind Renderings; die destruktiven Aktionen werden über den
öffentlichen Reduzer bestätigt und zustandsgeprüft (Runde 13) und seit Runde 14 über echte
Pointer-Ereignisse auf dem Dialog-Button ausgelöst.
Nichts gestaged, nichts committet.

### Runde 13: Bestätigung von Löschen und Wiederherstellen als öffentliche Aktion

`SettingsIntent` hat jetzt `ConfirmDelete` und `ConfirmRestore`. Die Dialog-Buttons rufen
`state.dispatch(...)` auf, der Reduzer führt `delete_confirmed` bzw. `restore_backup` aus. Damit ist
die Bestätigung dieselbe Aktion wie im UI, kein Test-Hook.

Drei neue Tests belegen die Zustandsänderung (931 Tests gesamt):

* `confirming_account_deletion_removes_it_through_public_intents`: `DeleteUser` öffnet nur den
  Dialog (Kontenzahl unverändert), `ConfirmDelete` entfernt das Konto aus Store und Liste,
  `delete_target` ist verbraucht, Status `settings_user_deleted`.
* `confirming_role_deletion_removes_it_through_public_intents`: analog für eine neu angelegte
  Rolle, Status `settings_role_deleted`.
* `confirming_restore_writes_the_archive_through_public_intents`: `RequestRestore` + `ConfirmRestore`
  schreibt die Zieldatenbank, `Store::open` findet dort die zwei geseedeten Konten, Status
  `settings_backup_restored`.

Der Sweep führt dieselben drei Bestätigungen pro Breite/Theme auf einem isolierten Store aus und
deckt sie in der Flow-Registry ab (`ConfirmDeleteUser`, `ConfirmDeleteRole`, `ConfirmRestore`).
Report unverändert 143 Fälle, jetzt **10 settings flows**:

```text
phone sweep: 360 px Light: 18 modules, 10 settings flows, 143 cases, 0 overflows
...
phone sweep total: 1144 cases across 8 width/theme combinations, 0 overflows
```

#### Falsifikation: neutralisierte Bestätigungswirkung

Temporär beide Reduzer-Arme auf `{}` gesetzt. Die Prüfungen schlagen mit **Exit 101** und konkreter
Meldung fehl:

```text
user delete confirmation: expected 1 accounts, got 2
role delete confirmation: expected 2 roles, got 3
restore confirmation: expected a restored database at /tmp/socdof-restore-…/restored.db, found none
```

`settings.rs` byte-gleich aus Backup zurückgespielt, `sha256sum -c` → `OK`.

#### Falsifikation: neuer, ungesicherter Bestätigungs-Flow

Temporär `SettingsFlow::ConfirmDeleteBackup` in Enum und `SETTINGS_FLOWS` ergänzt (ohne
Bestätigungsfall):

```text
ConfirmDeleteBackup is a settings editor or dialog flow but the phone sweep does not cover it at 360 px, Light
```

Datei zurückgespielt, `sha256sum -c` → `OK`.

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 41 Blöcke „ok", **931 Tests**
* Golden-Hash unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`), Visual-Test 900/1000 px
  byte-gleich, Sweep unverändert 1144 Fälle / 0 Überläufe.
* `git status --short` Pfadliste unverändert, **155** Einträge; `git diff --cached` leer.

Nichts gestaged, nichts committet.

### Runde 14: Bestätigung über den echten Dialog-Button

Die Bestätigung wird nicht mehr direkt über den Intent ausgelöst. Ein Test-Harness rendert den
echten Settings-Screen mit `headless_context`, lässt das Dialogfenster zwei Frames setzen, liest die
zuletzt registrierten Controls aus der Fokus-Ordnung (`FocusState::order`, neuer schreibgeschützter
Zugriff) und holt sich die Button-Rect über `Context::read_response`. Dann werden echte
`PointerMoved`-/`PointerButton`-Ereignisse (Press und Release) auf die Mitte des **linken
Bestätigen-Buttons** geschickt. Kein Intent-Aufruf im Test, kein Test-Hook.

Dabei kam ein echter Defekt heraus: `delete_modal` leerte `delete_target`, sobald der Dialog durch
die Bestätigung schloss, **bevor** `ConfirmDelete` lief. Der Klick auf „Endgültig löschen" tat
dadurch nichts. Die Reihenfolge ist jetzt: erst `dispatch(ConfirmDelete)`, dann das Aufräumen des
Dialogzustands; `restore_modal` analog.

Drei Tests (931 gesamt):

* `the_delete_dialog_confirm_button_removes_an_account` – Klick entfernt das Konto, Liste und Store
  sind aktualisiert, `delete_target` verbraucht, Status `settings_user_deleted`.
* `the_delete_dialog_confirm_button_removes_a_role` – analog für eine Custom-Rolle, Status
  `settings_role_deleted`.
* `the_restore_dialog_confirm_button_writes_the_database` – Klick schreibt die Zieldatenbank
  (`Store::open` findet die zwei Konten), `restore_confirm` ist gelöscht, Status
  `settings_backup_restored`.

Der Sweep benutzt dieselbe Klick-Routine (`click_settings_confirm`) für alle drei
Bestätigungs-Flows pro Breite/Theme und deckt sie weiter über die Flow-Registry ab. Report
unverändert `18 modules, 10 settings flows, 143 cases, 0 overflows`, total 1144/0.

#### Falsifikation: neutralisierte Button-Anbindung

Temporär den `dispatch(ConfirmDelete)`/`dispatch(ConfirmRestore)`-Aufruf in den beiden
Dialog-Handlern entfernt (Kommentar statt Aufruf). Die Button-Tests schlagen mit **Exit 101** fehl:

```text
user delete dialog confirm button: expected 1 accounts, got 2
role delete dialog confirm button: expected 2 roles, got 3
restore dialog confirm button: expected restored database at /tmp/socdof-dialog-…/dialog-restored.db, found none
```

`settings.rs` byte-gleich aus Backup zurückgespielt, `sha256sum -c` → `OK`.

#### Falsifikation: neuer, ungesicherter Bestätigungs-Button

Temporär `SettingsFlow::ConfirmDeleteBackup` in Enum und `SETTINGS_FLOWS` ergänzt, ohne ihn zu
klicken:

```text
ConfirmDeleteBackup is a settings editor or dialog flow but the phone sweep does not cover it at 360 px, Light
```

Datei zurückgespielt, `sha256sum -c` → `OK`.

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 41 Blöcke „ok", **931 Tests**
* Golden-Hash unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`), Visual-Test 900/1000 px
  byte-gleich, Sweep 1144 Fälle / 0 Überläufe.
* `git status --short` Pfadliste unverändert, **155** Einträge; `git diff --cached` leer.

Nichts gestaged, nichts committet.

### Runde 15: Editor-Aktionen über den echten Button

Die Bestätigungs-Dialoge aus Runde 14 hatten die Formulare nur gemalt, nie abgeschickt. Jetzt gehen
auch die Aktionen der Editoren durch den öffentlichen Eingabepfad: Klick auf den sichtbaren
Speichern-Button, geprüft am Store, nicht am Dialogzustand.

Neu in `settings::tests` (das `DialogInput`-Harness lässt sich jetzt über `DialogInput::at` auf jede
Viewport-Größe und jedes Theme stellen):

* `the_user_form_save_button_creates_an_account` – neues Konto, Status `settings_user_saved`.
* `the_user_form_save_button_updates_an_account` – Bearbeiten speichert unter derselben Id statt
  ein zweites Konto anzulegen, Status `settings_user_saved`.
* `the_role_form_save_button_creates_a_role` – neue Rolle inklusive gesetzter Berechtigung
  (`Invoices: Edit`), Status `settings_role_saved`.
* `the_role_form_save_button_updates_a_role` – geänderte Beschreibung landet im Store.
* `the_user_editor_delete_button_opens_and_confirms_the_dialog` – der Löschen-Button **im Editor**
  öffnet den Dialog, dessen Bestätigung entfernt das Konto.
* `the_user_form_fields_fit_the_phone_panel` – tippt in alle vier Felder per Klick und
  `Event::Text`, prüft damit die Feldreihenfolge und dass jedes Feld im 360/390/412/432-px-Panel
  endet.
* `the_user_form_save_button_saves_at_every_phone_width` und
  `the_role_form_save_button_saves_at_every_phone_width` – je vier Breiten × zwei Themes: der
  Speichern-Button wird per Rad-Input in den Viewport gescrollt und dann geklickt; der Datensatz
  muss im Store liegen.

Der erste Versuch, die Felder über ihre absolute Position in der Fokus-Ordnung anzusteuern, traf auf
360 px die Tab-Leiste: sie liegt dort absichtlich in einer horizontalen Scrollfläche und ragt bis
438 px über die Kante, wird also beschnitten statt umgebrochen. Das ist kein Formularfehler, und der
Sweep ignoriert solche Formen bewusst. Der Tipp-Test spricht die Felder deshalb vom Ende der
Fokus-Ordnung an und belegt: alle vier Felder enden bei 360/390/412/432 px innerhalb der Kante, und
jeder getippte Marker landet im richtigen Draft-Feld. Das Konto-Formular bleibt bei zwei Spalten
(auf 360 px rund 146 px pro Feld).

Zwei Eigenheiten von egui 0.27, die das Harness jetzt dokumentiert: ScrollArea reagiert auf
`Event::Scroll` (nicht auf `Event::MouseWheel`, das nur für eigene Controls gedacht ist), und der
animierte Scrollzustand bleibt stehen, wenn jeder Frame dieselbe `time` meldet – das Harness führt
eine Frame-Uhr mit. Ein Textfeld übernimmt den Fokus erst am Ende des Release-Frames; die
Tipp-Sequenz braucht deshalb einen Leerlauf-Frame vor `Event::Text`.

Der Sweep hat einen elften Flow, `SettingsFlow::EditorDelete`: Auf einem isolierten Store wird ein
Konto über den Intent bearbeitet, der Löschen-Button im Editor geklickt (drittletzter Control) und
die Bestätigung im Dialog (zweitletzter). Report jetzt
`18 modules, 11 settings flows, 144 cases, 0 overflows`, total **1152/0**. `UserEditor`, `NewUser`,
`RoleEditor` und `NewRole` bleiben als gemalte Fälle im Sweep; ihre Speichern-Buttons sind über die
Acht-Kombinationen-Tests oben abgedeckt.

#### Falsifikation: neutralisierte Speichern-Anbindung

Temporär `state.save_user`/`state.save_role` in den beiden Formular-Handlern auskommentiert. Sechs
Tests schlagen mit **Exit 101** fehl:

```text
user form save button: the editor is still open after saving
role form save button: the editor is still open after saving
user form save button: expected the renamed account edited-button-user, found none
role form save button at 360 px, Light: expected the role Phone-Rolle in the store, found none
user form save button at 360 px, Light: expected the account phone-user in the store, found none
role form save button at 360 px, Light: expected the role Phone-Rolle in the store, found none
```

`settings.rs` byte-gleich aus Backup zurückgespielt, `sha256sum -c` → `OK`.

#### Falsifikation: neutralisierter Löschen-Button im Editor

Temporär den `dispatch(DeleteUser)`-Aufruf im Konto-Formular auskommentiert. Test und Sweep
schlagen fehl:

```text
user editor delete button: expected the delete dialog for f8e208e2…, got None
user editor delete button: expected 1 accounts after confirming, got 2
```

Datei zurückgespielt, `sha256sum -c` → `OK`.

#### Falsifikation: neuer, ungesicherter Editor-Flow

Temporär `SettingsFlow::EditorSave` in Enum und `SETTINGS_FLOWS` ergänzt, ohne ihn zu klicken:

```text
EditorSave is a settings editor or dialog flow but the phone sweep does not cover it at 360 px, Light
```

Datei zurückgespielt, `sha256sum -c` → `OK`.

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 41 Blöcke „ok", **939 Tests**
* Golden-Hash unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`), Visual-Test 900/1000 px
  byte-gleich, Sweep **1152 Fälle / 0 Überläufe** (vorher 1144).
* `git status --short` Pfadliste unverändert, **155** Einträge; `git diff --cached` leer.

Nichts gestaged, nichts committet.

### Runde 16: Rollen-Löschen, Berechtigungs-Toggle und Neuanlage über den öffentlichen Pfad

Die Editoren aus Runde 15 konnten speichern und ein Konto löschen. Offen waren die drei übrigen
Aktionen: eine Rolle im Editor löschen, eine einzelne Berechtigung umschalten und einen Datensatz
ohne vorab gesetzte Id anlegen und ein zweites Mal speichern. Alle drei gehen jetzt durch dieselben
echten Controls (Pointer-Klick, Dialog-Bestätigung) und werden am isolierten Store geprüft.

#### Zwei echte Produktionsfehler im `select` (beide behoben)

* **Id-Mismatch.** `select` in `crates/ui/src/controls.rs` legte den Klick auf eine Auto-Id, während
  Fokus, Popup und Diagnose die persistente Id `("​socdof-select", id_source)` benutzten. Ein
  Klick traf damit ein anderes Control als das, dessen Rechteck gelesen wurde; im Test kam
  `read_response(focus_id)` als `None` zurück. Jetzt wird das Control unter der persistenten Id
  allokiert (`Sense::hover()`) und mit `ui.interact(rect, id, Sense::click())` bedient.
* **Erster Klick öffnete nicht.** Die Bedingung war `!was_open && focused`; im Frame des Klicks setzt
  der Klick erst den Fokus, also blieb das Dropdown beim ersten Klick zu und ging erst beim zweiten
  auf. Jetzt `!was_open && (focused || response.clicked())`, das Öffnen hängt an
  `response.clicked() || (focused && (focus.activate(id) || arrow))`.

Zusätzlich lud `SettingsState::edit_role` einen veralteten Snapshot nicht nach: Speichern setzt
`loaded = false`, und ein sofortiges Wiederöffnen des Editors (Tastatur oder Klick im selben Frame)
schrieb die alten Berechtigungen beim nächsten Speichern zurück. `edit_role(id, store)` lädt jetzt
wie `edit_user` vor dem Öffnen nach, wenn `loaded` false ist.

#### Vier neue Tests in `settings::tests`, je vier Breiten × zwei Themes

* `the_role_editor_delete_button_removes_a_role_at_every_phone_width` – drittletzter Control ist der
  Löschen-Button, zweitletzter im Dialog die Bestätigung; danach ist die Rolle aus dem Store
  verschwunden und eine Zeugenrolle samt Berechtigungsmatrix unverändert.
* `the_role_permission_dropdown_persists_through_the_form` – Pointer-Klick auf das `select` von
  Modul 3 (Invoices), dann Pointer-Klick auf die Popup-Zeile „Bearbeiten“, dann Speichern: der Store
  hat exakt `Invoices: Edit`, die übrige Matrix ist die der Rolle. Anschließend wird der Editor
  sofort wieder geöffnet und ohne Umschalten gespeichert: die Matrix bleibt gleich.
* `the_role_form_assigns_a_fresh_id_and_saves_twice_without_a_duplicate` – Name und Beschreibung
  werden getippt, gespeichert, die Id ist neu, die Anzahl steigt um eins; nach erneutem Öffnen wird
  eine zweite Beschreibung getippt und gespeichert: Anzahl konstant, gleiche Id, Text im Store.
* `the_editor_controls_stay_inside_the_phone_panel` – alle 20 Controls des Rollenformulars und alle
  10 des Kontoformulars enden bei 360/390/412/432 px höchstens an der Panel-Kante (`width + 0.5`).

#### Harness-Notizen (keine Produktionsfehler)

* egui trifft eine Pointer-Press gegen die Controls, die es im Frame davor kannte. Ein Klick ohne
  Hover-Frame verpufft; `click_at` schickt deshalb erst `PointerMoved`, dann Press, dann Release.
  Genau daran scheiterte der Popup-Zeilen-Klick, nicht am Produktivcode.
* Das Popup malt 8 px unter seinem Control, Zeilen 30 px hoch im 33-px-Raster, Zeilenmitte
  `bottom + 8 + 33·i + 15`, x = `left + 114`.
* Scrollen braucht `Event::Scroll` und eine laufende Frame-Uhr; Kontrollen oberhalb des Viewports
  brauchen die Gegenrichtung (+240), sonst scrollt das Harness weiter von ihnen weg.
* Ein Textfeld übernimmt den Fokus erst am Ende des Release-Frames; vor `Event::Text` liegt ein
  Leerlauf-Frame. Tippen hängt an, es ersetzt nicht – der Test prüft deshalb `ends_with`.

#### Sweep: vier neue Editor-Flows, 1184 Fälle

`phone_sweep.rs` hat jetzt 15 Settings-Flows. Neu sind `EditorSaveUser`, `EditorSaveRole`,
`EditorPermissionToggle` und `EditorRoleDelete`; sie laufen auf einem isolierten Store mit einer
Zeugenrolle und machen dieselben Klicks wie die Tests (Tippen in die Felder, Speichern, Umschalten
per Popup-Zeile, Löschen samt Dialog). `EditorSaveUser` speichert das Konto ein zweites Mal mit
umgelegtem Schalter und prüft konstante Kontenzahl, gleiche Id und gesetzten Schalter.

Report je Kombination: `18 modules, 15 settings flows, 148 cases, 0 overflows`, zusammen
**1184 Fälle / 0 Überläufe** (Runde 15: 1152/0). Vor dem Klick wird jedes angesprochene Control per
`settled_control` auf `right <= panel_right()` geprüft und per Rad-Input in den Viewport geholt.

#### Falsifikationen (je Exit 101, Datei byte-gleich zurückgespielt)

| Neutralisierte Produktionsstelle | Test | Ergebnis |
| --- | --- | --- |
| `DeleteTarget::Role(id) => store.delete_role(id)` → `Ok(())` | Rollen-Editor-Löschen | panicked, Exit 101 |
| `draft.levels[index] = level_at(current)` entfernt | Berechtigungs-Toggle | panicked, Exit 101 |
| Nachladen in `edit_role` entfernt | Berechtigungs-Toggle (zweites Speichern) | panicked, Exit 101 |
| `save_role`: immer `insert_role` statt Update | frische Id / keine Dublette | panicked, Exit 101 |
| `select`-Breite 220 → 400 | Controls im Panel | panicked, Exit 101 |
| `select` öffnet nur bei `focused` | Phone-Sweep (`EditorPermissionToggle`) | panicked, Exit 101 |

Nach jedem Lauf `sha256sum` der Datei vor dem Patchen und nach dem Zurückspielen verglichen:
`byte-gleich` für alle sechs.

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 387 Tests in `socdof-ui` (lib), alle übrigen Blöcke „ok“
* Golden-Hash unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`)
* `git status --short` **155** Einträge (unverändert), `git diff --cached` leer

Nichts gestaged, nichts committet.

#### Weiterhin nicht geprüft

* `menu` in `crates/ui/src/controls.rs` hat dasselbe alte Muster wie `select` vor dieser Runde
  (Auto-Id plus `focused`-Bedingung): der erste Pointer-Klick fokussiert nur, ein Maus-Klick allein
  öffnet das Menü nicht. Nicht geändert und nicht getestet.
* Alles lief headless über synthetische `RawInput`-Events im egui-Kontext; es gab keinen echten
  Fensterlauf, keine Maus, keine Screenshots. Fokus-Ringe, Cursor-Form und Hover-Farben sind nur
  über die gemalten Rechtecke geprüft, nicht visuell.
* Der Sweep und die Tests benutzen In-Memory-Stores; echte Backup-/Restore-Dateien, Sperrdateien
  und Portable-Mode-Pfade bleiben unberührt.
* Die Popup-Zeilen werden nur per Pointer gewählt; Tastaturwahl (Pfeile plus Enter) ist im Harness
  möglich, aber nicht Teil der Sweep-Flows.
* `edit_role` lädt nur nach, wenn `loaded` false ist. Ein veralteter, aber als geladen markierter
  Snapshot (z. B. nach einer Änderung aus einem zweiten Fenster) ist nicht abgedeckt.

### Runde 17: Das `menu` öffnet beim ersten Klick und speichert seine Auswahl

Runde 16 hatte die Lücke nur benannt: `menu` in `crates/ui/src/controls.rs` hatte dasselbe alte
Muster wie `select` vorher – erste Mausklick nur Fokus, Öffnen erst beim zweiten. Jetzt ist der
Pfad geschlossen, getestet und im Sweep.

#### Produktionskorrekturen im Control

* **Feste Id statt Baum-Id.** `menu` baute seine Id aus der Widget-Position
  (`ui.make_persistent_id`), während das Control selbst unter einer Auto-Id klickbar war. Jetzt ist
  die Beschriftung die Identität (`Id::new(("socdof-menu", label))`), das Control wird unter genau
  dieser Id allokiert (`Sense::hover()`) und mit `ui.interact(rect, id, Sense::click())` bedient.
  Damit benennen Fokus, Diagnose und Pointer dieselbe Fläche, und ein Test kann das Control ohne
  Kenntnis des Widget-Baums adressieren.
* **Öffnen beim ersten Klick.** Die Bedingung war `!was_open && focused`; im Klick-Frame setzt der
  Klick aber erst den Fokus. Jetzt `!was_open && (focused || response.clicked())`, das Öffnen hängt
  an `response.clicked() || focus.activate(id) || arrow` – Tastatur (Pfeil, Enter, Leertaste) bleibt
  unverändert.
* **`popup_row` hatte denselben Id-Bruch.** Die Zeile meldete ihren Fokus unter der übergebenen Id,
  klickbar war aber eine Auto-Id daneben; die Zeile war deshalb über ihre Id nicht lesbar (Rect
  `None`). Jetzt allokiert sie mit `Sense::hover()` und interagiert unter der übergebenen Id. Das
  betrifft die Popups von `select` und `menu` gleichermaßen.

#### Die Auswahl wird fachlich gespeichert

Der Menüpunkt setzt jetzt einen Wert im Zustand, statt nur einen Toast zu zeigen:

* `GalleryState.menu_choice: Option<usize>` – die gewählte Aktion (Index in `MENU_ACTIONS`).
* `GalleryState.menu_saved: Option<usize>` – die zuletzt angenommene Aktion, beim Start aus dem
  isolierten Store geladen (`gallery:menu_action`, `Store::get_setting`).
* Der Speichern-Button des Demo-Formulars übernimmt die Wahl per `Store::put_setting` und setzt
  `menu_saved` nur, wenn der Schreibvorgang geklappt hat. Ein zweites Speichern ohne neue Wahl
  schreibt denselben Wert erneut und ändert nichts.
* Die Galerie ist eine Komponenten-Demo ohne eigenes Fachmodell; der Speicher-Button des
  benachbarten Formulars ist der öffentliche „Speichern“-Pfad dieser Ansicht. Das ist bewusst so
  und steht auch unter den Restlücken.

#### Drei neue Tests in `gallery::tests` (4 Breiten × 2 Themes)

* `the_action_menu_opens_with_one_click_and_saves_the_choice_at_every_phone_width` – tippt beide
  Pflichtfelder über Klick und `Event::Text` (sonst schlägt die Validierung fehl), scrollt das Menü
  per Rad in den Viewport (mit Platz für vier Popup-Zeilen), öffnet es mit **einem** Klick
  (`Some(0)`), klickt die dritte Zeile (`menu_choice == Some(2)`), speichert (`menu_saved ==
  Some(2)`, Store `menu_archive`) und speichert ein zweites Mal ohne neue Wahl (Wert unverändert,
  Formular nicht mehr dirty). Jedes adressierte Control wird auf `right <= width + 0.5` geprüft.
* `the_action_menu_opens_and_chooses_with_the_keyboard` – Tab bis das Menü den Fokus hat, Pfeil
  runter öffnet, Pfeil runter zeigt auf Zeile 1, Enter wählt sie; danach ist das Popup zu und der
  Fokus wieder auf dem Menü.
* `the_action_menu_restores_the_saved_choice_from_the_store` – ein Store mit
  `gallery:menu_action = "menu_delete"` ergibt beim Start `menu_saved == Some(3)`.

#### Harness-Notizen (keine Produktionsfehler)

* Die Onboarding-Karte ist ein Foreground-Overlay und schluckt das Rad-Input; das Harness beendet
  sie vor dem ersten Frame.
* egui führt neben dem Kit einen **zweiten** Fokus. Eine Tab-Sequenz lässt ihn auf irgendeinem
  Widget stehen, und ein Enter klickt dieses Widget zusätzlich zur Kit-Aktivierung (im ersten Lauf
  öffnete Enter den Demo-Dialog). Das Harness gibt egui-Fokus frei, sobald er vom Kit-Fokus
  abweicht – außer bei Textfeldern: die fordern egui-Fokus selbst an, weil `TextEdit` den Text
  über egui liest.
* Der Rad-Scroll ist animiert; das Harness wartet, bis das Rechteck einen Frame stillsteht, bevor
  es klickt. Das Popup malt 8 px unter dem Control, Zeilen 30 px hoch im 33-px-Raster.

#### Sweep: neuer Galerie-Flow, 1200 Fälle

`phone_sweep.rs` hat jetzt eine eigene Galerie-Registry `GalleryFlow { MenuOpen, MenuChoice }`
(analog zu `SettingsFlow`, inklusive Vollständigkeitsprüfung) und `sweep_gallery_menu`: es scrollt
das Menü auf der echten Galerie-Ansicht in den Viewport, öffnet es mit einem Klick, prüft
`open == Some(0)`, wählt Zeile 2 per Pointer und prüft `menu_choice == Some(2)` und ein
geschlossenes Popup. Zwei zusätzliche Fälle je Kombination, Report

`18 modules, 15 settings flows, 2 gallery flows, 150 cases, 0 overflows`, total
**1200 Fälle / 0 Überläufe** (Runde 16: 1184/0).

#### Falsifikationen (je Exit 101, Datei byte-gleich zurückgespielt)

| Neutralisierte Produktionsstelle | Test | Ergebnis |
| --- | --- | --- |
| `menu` öffnet nur bei `focused` | Ein-Klick-Test | panicked, Exit 101 |
| `state.menu_choice = Some(index)` entfernt | Ein-Klick-Test | panicked, Exit 101 |
| Speichern-Accept (`put_setting`/`menu_saved`) entfernt | Ein-Klick-Test | panicked, Exit 101 |
| feste Id zurück auf `ui.make_persistent_id` | Ein-Klick-Test (Rect nicht adressierbar) | panicked, Exit 101 |
| `arrow` aus der Öffnen-Bedingung entfernt | Tastatur-Test | panicked, Exit 101 |
| Laden aus dem Store entfernt | Restore-Test | panicked, Exit 101 |
| `menu` öffnet nur bei `focused` | Phone-Sweep | panicked, Exit 101 |

Alle sieben Läufe: `sha256` vor dem Patchen und nach dem Zurückspielen verglichen → `byte-gleich`.

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 390 Tests in `socdof-ui` (lib)
* Golden-Hash unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`)
* `git status --short` **156** Einträge (Runde 16: 155; neu ist `crates/ui/src/gallery.rs`),
  `git diff --cached` leer

Nichts gestaged, nichts committet.

#### Weiterhin nicht geprüft / Restlücken

* Kein echter Fensterlauf: alles headless über synthetische `RawInput`-Events. Fokus-Ringe,
  Hover-Farben, Cursorform und die tatsächliche Popup-Position auf einem Bildschirm sind nicht
  visuell geprüft, nur über gemalte Rechtecke.
* Nur die Galerie-Ansicht ist als Flow im Sweep; die übrigen Galerie-Karten (Formular, Dialog,
  Drawer) werden weiterhin nur über ihre Tests abgedeckt, nicht als eigene Sweep-Fälle.
* Das Menü speichert genau eine „letzte angenommene Aktion“; es gibt keine Zuordnung zu einem
  Datensatz. Die Galerie ist eine Demo ohne Fachmodell – der Speicher-Button des Demo-Formulars ist
  der Speicherpfad, nicht ein echter Datensatz.
* Die Beschriftung ist die Identität des Menüs: zwei Menüs mit gleicher Beschriftung würden sich
  Zustand und Fokus teilen. Heute gibt es genau eines.
* Tastatur: Pfeile, Enter/Leertaste und Escape sind implementiert; getestet ist der Weg Tab →
  Pfeil → Enter. Escape als Abbruch und Home/End sind nicht durch Tests belegt.
* Tippen hängt an, es ersetzt nicht; die Tests prüfen deshalb den fertigen Wert nach dem Tippen.
* Weitere Controls mit Auto-Id: `checkbox`, `switch`, `button`, `icon_button`, `sort_header`,
  `search_field`, `calendar` und `drop_zone` registrieren `ui.next_auto_id()` und allokieren unter
  derselben Id; `text_field`/`password_field` nutzen `response.id`. Diese sind konsistent – es gibt
  nach dieser Runde kein Control mehr, dessen Fokus-Id von seiner Klick-Id abweicht.

### Runde 18: Zwei gleich beschriftete Menüs bleiben getrennt, Tastatur vollständig

Runde 17 hatte die Identität des Menüs an seine Beschriftung gebunden (`Id::new(("socdof-menu",
label))`) und als Restrisiko benannt, dass zwei Menüs mit derselben Beschriftung sich Zustand und
Fokus teilen. Runde 18 schließt das – und behebt dabei einen Overflow, den der Sweep gefunden hat.

#### Produktionskorrekturen

* **Instanz-Id statt Beschriftungs-Id.** `menu` zählt pro Frame, das wievielte Menü mit dieser
  Beschriftung es gerade malt (Zähler in `ctx.data`, Rücksetzung über `Context::frame_nr()`), und
  bildet daraus `menu_id(label, occurrence) = Id::new(("socdof-menu", label, occurrence))`. Das
  Control allokiert und interagiert weiterhin unter genau dieser Id (`Sense::hover()` +
  `ui.interact(rect, id, Sense::click())`), der erste Klick öffnet weiter über
  `!was_open && (focused || response.clicked())`. Kein Rückfall auf `ui.make_persistent_id`: die Id
  ist von außen berechenbar, damit Tests und Diagnose dasselbe Rechteck adressieren, das der Pointer
  trifft.
* **Zweites Menü in der Galerie.** Die Overlay-Karte der Komponenten-Galerie zeigt jetzt bewusst
  zwei gleich beschriftete „Aktionen“-Menüs. Jedes hat seinen eigenen `PopupState`
  (`menu_popup`/`menu_popup_second`) und seinen eigenen Wert (`menu_choice`/`menu_choice_second`);
  nur der Wert des ersten wird vom Speichern-Button übernommen.
* **Overflow behoben, den der Sweep fand.** Mit dem zweiten Menü passte die Zeile aus zwei Menüs
  und dem Drawer-Button bei 360 px nicht mehr: der Sweep meldete
  `a painted element reaches 369.56 px, the panel ends at 360.5 px` für einen transparenten
  Ghost-Button. Die Zeile nutzt jetzt `ui.horizontal_wrapped`, sodass der Drawer-Button umbricht;
  bei 390/412/432 px bleibt die Zeile einreihig.

#### Tests (4 Breiten × 2 Themes)

* `the_two_menus_with_the_same_label_keep_their_own_state_at_every_phone_width` – die Ids beider
  Menüs sind verschieden, ihre Rechtecke verschieden; ein Klick öffnet nur das zweite Menü, Escape
  schließt es; die erste Auswahl (Zeile 1 im ersten Menü) lässt den Wert des zweiten auf `None`;
  das zweite Menü öffnet allein und wählt Zeile 3, ohne den Wert des ersten (`Some(1)`) zu ändern.
  Die Popup-Zeilen-Ids beider Menüs sind ebenfalls verschieden. Jedes Rechteck wird vor dem Klick
  auf Sichtbarkeit im Viewport und `right <= width + 0.5` geprüft, das Menü vorher per Rad
  hingescrollt.
* `the_action_menu_keyboard_covers_escape_home_and_end_at_every_phone_width` – Tab fokussiert das
  Menü, Pfeil öffnet (`Some(0)`), Escape schließt ohne Wertänderung (`menu_choice == None`),
  Pfeil + Enter wählt Zeile 1, End + Enter Zeile 3, Home + Enter Zeile 0; der Wert des zweiten
  Menüs bleibt dabei unberührt. Geprüft wird der Wert im Zustand, nicht der Anzeigetext.

#### Sweep: dritter Galerie-Flow, 1216 Fälle

`GalleryFlow` hat jetzt `Open`, `Choose`, `Pair`. `sweep_gallery_menu` öffnet nach der ersten Wahl
das zweite, gleich beschriftete Menü, prüft `menu_popup_second.open == Some(0)` bei geschlossenem
erstem Menü, wählt Zeile 0 und prüft `menu_choice_second == Some(0)` bei unverändertem
`menu_choice == Some(2)`. Report je Kombination:

`18 modules, 15 settings flows, 3 gallery flows, 152 cases, 0 overflows`, total
**1216 Fälle / 0 Überläufe** (Runde 17: 1200/0).

#### Falsifikationen (Exit 101, Datei byte-gleich zurückgespielt)

| Neutralisierte Produktionsstelle | Test | Ergebnis |
| --- | --- | --- |
| `menu_id` ignoriert die Occurrence (kollidierende Id) | Zwei-Menü-Test | panicked, Exit 101 |
| Escape-Zweig im Menü entfernt | Tastatur-Test | panicked, Exit 101 |
| Home/End-Zweige im Menü entfernt | Tastatur-Test | panicked, Exit 101 |
| `horizontal_wrapped` zurück auf `horizontal` | Phone-Sweep | panicked, Exit 101 (369.56 px) |

Jeder Lauf: `sha256` der Datei vor dem Patchen und nach dem Zurückspielen verglichen → `byte-gleich`
für alle vier.

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0 (die Varianten heißen `Open`,
  `Choose`, `Pair`, damit `enum_variant_names` nicht anschlägt)
* `cargo test --workspace` → 0, 392 Tests in `socdof-ui` (lib)
* Golden-Hash unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`)
* `git status --short` **156** Einträge (unverändert zu Runde 17), `git diff --cached` leer

Nichts gestaged, nichts committet.

#### Weiterhin nicht geprüft / Restpunkte

* Kein echter Fensterlauf: alles headless über synthetische `RawInput`-Events; Fokus-Ringe,
  Hover-Farben, Cursorform und die tatsächliche Popup-Lage auf einem Bildschirm sind nicht visuell
  geprüft.
* Die Occurrence-Id hängt an der Malreihenfolge: erscheint vor einem Menü ein weiteres mit gleicher
  Beschriftung nur in manchen Frames, verschieben sich die Ids für diese Frames. Für die Galerie
  und alle heutigen Aufrufer ist die Reihenfolge statisch.
* Das zweite Menü schreibt nur in seinen eigenen Zustand; gespeichert wird weiterhin ausschließlich
  die Aktion des ersten Menüs, und diese hat keinen Datensatzbezug (die Galerie ist eine Demo).
* `select` nutzt weiterhin `ui.make_persistent_id(("socdof-select", id_source))`. Zwei Selektoren
  mit demselben `id_source` in derselben `Ui` würden kollidieren; die heutigen Aufrufer vergeben
  eindeutige Quellen (z. B. `settings-role-level-{index}`), geprüft ist dieser Fall nicht.
* Tastatur: Enter, Leertaste, Pfeile, Escape, Home und End sind implementiert. Getestet sind
  Pfeil/Enter, Escape, End und Home; Leertaste als Bestätigung ist nicht separat belegt.
* Tippen hängt an, es ersetzt nicht; die Tests prüfen den fertigen Wert.

### Runde 19: `select` bekommt eine Instanz-Id, Leertaste ist belegt

Runde 18 hatte zwei Restpunkte benannt: `select` hing an `ui.make_persistent_id(("socdof-select",
id_source))`, sodass zwei Dropdowns mit derselben Quelle (oder ohne eigene Quelle über dieselbe
Beschriftung) eine Identität geteilt hätten, und die Leertaste als Bestätigung war implementiert,
aber nicht geprüft.

#### Produktionskorrekturen

* **Instanz-Id für `select`.** Wie beim Menü zählt `select` pro Frame, das wievielte Dropdown mit
  dieser `id_source` gemalt wird (`ctx.data` + `Context::frame_nr()`), und bildet daraus
  `select_id(id_source, occurrence) = Id::new(("socdof-select", id_source, occurrence))`. Das
  Control registriert, interagiert und öffnet unter genau dieser Id (`ui.interact(rect, id,
  Sense::click())`, erster Klick öffnet); die Optionszeilen hängen als `id.with(("option", i))`
  daran. `ui.make_persistent_id` ist aus dem Control verschwunden.
* **Leertaste hat genau eine Bestätigungsstelle.** `FocusState` merkt sich jetzt zusätzlich
  `enter` (nur Enter) neben `press` (Enter oder Space). Popup-Zeilen reagieren nur noch auf Enter
  und Klick (`focus.is_focused(id) && focus.enter()`), die Bestätigung der markierten Zeile liegt
  allein im Commit-Zweig des Controls (`Enter || Space`) – beim `select` und, unverändert, beim
  `menu`. Damit lässt sich „Leertaste entfernt" überhaupt falsifizieren: vorher hätte die
  Zeilenaktivierung die Leertaste weiterhin angenommen und den Test grün gelassen.
* **Galerie zeigt zwei Dropdowns mit derselben Quelle.** Die Karte „Bausteine“ enthält ein zweites
  `select` mit `id_source = "socdof-gallery-term"` und eigenem `PopupState`/Wert
  (`select_popup_second`/`select_second`); das erste behält `select_popup`/`select`.

#### Tests (4 Breiten × 2 Themes)

* `the_two_selects_with_the_same_source_keep_their_own_state_at_every_phone_width` – die Ids und
  Rechtecke beider Dropdowns sind verschieden; ein Klick öffnet nur das erste (bei seinem Wert 1),
  die Wahl von Option 2 ändert nur `select`, nicht `select_second`; danach öffnet das zweite allein
  (bei seinem Wert 0) und wählt Option 1, ohne `select == 2` zu verändern. Beide Rechtecke werden
  vor dem Klick auf Sichtbarkeit und `right <= width + 0.5` geprüft, per Rad hingescrollt.
* `the_select_keyboard_covers_space_escape_home_and_end_at_every_phone_width` – Tab fokussiert das
  erste Dropdown, Pfeil öffnet bei `Some(1)`, Pfeil bewegt, Escape schließt mit unverändertem Wert,
  End + Leertaste wählt Zeile 2, Home + Enter Zeile 0, und Pfeil + Leertaste beziehungsweise
  Pfeil + Enter bestätigen dieselbe markierte Zeile mit demselben Ergebnis (Wert 1). Geprüft wird
  der Zustand, nicht der Anzeigetext; `select_second` bleibt unberührt.

#### Sweep: vierter Galerie-Flow, 1240 Fälle

`GalleryFlow` hat jetzt `Open`, `Choose`, `Pair`, `Selects`; neu ist `sweep_gallery_selects`: erstes
Dropdown öffnen (nur es öffnet), Option 2 wählen, zweites Dropdown öffnen (nur es öffnet), Option 1
wählen, Werte 2/1 prüfen. Report je Kombination:

`18 modules, 15 settings flows, 4 gallery flows, 155 cases, 0 overflows`, total
**1240 Fälle / 0 Überläufe** (Runde 18: 1216/0).

#### Falsifikationen (Exit 101, Datei byte-gleich zurückgespielt)

| Neutralisierte Produktionsstelle | Test | Ergebnis |
| --- | --- | --- |
| `select_id` ignoriert die Occurrence (kollidierende Id) | Zwei-Select-Test | panicked, Exit 101 |
| Space aus der Bestätigung des `select` entfernt | Tastatur-Test | panicked, Exit 101 |
| Home/End-Zweige im `select` entfernt | Tastatur-Test | panicked, Exit 101 |

Zusätzlicher Probelauf (nicht Teil der Pflichtfalsifikation): ließe man `FocusState::enter` wieder
`press` (Enter oder Space) zurückgeben, bliebe der Tastatur-Test grün, weil die Zeile die Leertaste
dann selbst annähme. Genau deshalb sind die Zeilen auf Enter verengt; die Pflichtfalsifikation
setzt am Commit-Zweig an und schlägt fehl.

Alle Läufe: `sha256` vor dem Patchen und nach dem Zurückspielen verglichen → `byte-gleich`.

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 394 Tests in `socdof-ui` (lib)
* Golden-Hash unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`)
* `git status --short` **156** Einträge (unverändert), `git diff --cached` leer

Nichts gestaged, nichts committet.

#### Weiterhin nicht geprüft / Restpunkte

* Kein echter Fensterlauf und keine visuelle Kontrolle: alles headless über synthetische
  `RawInput`-Events; Fokus-Ringe, Hover-Farben, Cursorform und die Popup-Lage auf einem Bildschirm
  sind ungesehen.
* Menü- und Select-Ids hängen an der Malreihenfolge: erscheint ein Control mit derselben
  Beschriftung beziehungsweise Quelle nur in manchen Frames davor, verschieben sich die
  Occurrences für diese Frames. Für alle heutigen Aufrufer ist die Reihenfolge statisch.
* Die Werte von Menü und Dropdown haben keinen Datensatzbezug (die Galerie ist eine Demo); das
  zweite Menü und das zweite Dropdown schreiben nur in ihren eigenen Zustand, gespeichert wird
  weiterhin nur die erste Auswahl.
* `button`, `checkbox`, `switch`, Kalender, Drawer und Datei-Drop nutzen Auto-Ids; Kollisionen
  innerhalb einer `Ui` sind damit ausgeschlossen, gleiche Beschriftungen erzeugen aber auch keine
  gemeinsame Identität – geprüft ist nur, was die Tests oben abdecken.
* Leertaste: belegt für `select` und über den gemeinsamen Commit-Zweig auch für `menu`; für
  Kalender, Drawer und Datei-Drop ist sie nicht getestet.

### Runde 20: `select`-Ids leben im Zustand, Leertaste schließt den Drawer

Runde 19 hatte die `select`-Identität an die Malreihenfolge gebunden (Occurrence pro Frame) und
genau das als Schwäche benannt: ein bedingt gemaltes Dropdown mit derselben `id_source` verschiebt
die Indizes der nach ihm gemalten Controls. Runde 20 nimmt die Identität aus der Malreihenfolge
heraus und belegt die Leertaste an einem zweiten Control.

#### Produktionskorrekturen

* **Identitätsslot im `PopupState`.** `PopupState` trägt jetzt ein privates `slot: Option<u64>`. Beim
  ersten Malen holt sich das Control einen Slot aus einem persistenten Zähler
  (`ctx.data` + `insert_persisted`, Schlüssel `socdof-select-slot-next`) und behält ihn für immer;
  Slots werden nie wiederverwendet. Die Id ist `select_id(id_source, slot) =
  Id::new(("socdof-select", id_source, slot))` – dieselbe Id, unter der registriert, interagiert und
  geöffnet wird. Ein bedingt erscheinendes Dropdown bekommt beim ersten Erscheinen einen frischen
  Slot und verschiebt damit nichts; ein verschwindendes und wiederkehrendes behält seinen Slot.
* **Galerie: bedingtes drittes Dropdown.** Die Karte „Bausteine“ malt bei aktiviertem
  „Entwurf“-Schalter ein drittes `select` mit derselben `id_source` **oberhalb** der beiden festen.
  Es hat eigenen Zustand (`select_extra`/`select_popup_extra`); die beiden festen behalten
  `select`/`select_popup` und `select_second`/`select_popup_second`.
* **Leertaste am Drawer.** Der Schließen-Button des Drawers bestätigt über `FocusState::press`
  (Enter oder Space) und schließt damit den Drawer; das ist jetzt am Zustand `drawer_open` belegt.
  `menu` blieb in dieser Runde unverändert.

#### Tests (4 Breiten × 2 Themes)

* `the_select_ids_survive_a_conditional_dropdown_at_every_phone_width` – erstes Dropdown per Klick
  öffnen (`Some(1)`), mit Escape schließen, Fokus kehrt zur Id 0 zurück. Dann erscheint das dritte
  Dropdown darüber: es liegt nachweislich oberhalb von Id 0, endet nicht hinter der Panel-Kante,
  und der Pfeil bedient weiter das erste Dropdown (`Some(1)`, das bedingte bleibt `None`), dessen
  Wahl Zeile 2 setzt, ohne `select_extra` zu berühren. Ausblenden bringt Id 0 exakt auf das alte
  Rechteck zurück, Wiedereinblenden gibt dem dritten dieselbe Id und dasselbe Rechteck; alle drei
  Ids sind paarweise verschieden.
* `the_drawer_closes_with_space_like_enter_at_every_phone_width` – Drawer öffnen (Zustand), der
  Fokus liegt auf dem Schließen-Button, Enter schließt (`drawer_open == false`); erneut öffnen,
  Leertaste schließt mit demselben Ergebnis.

#### Sweep: fünfter Galerie-Flow, 1264 Fälle

`GalleryFlow` hat jetzt `Open`, `Choose`, `Pair`, `Selects`, `Conditional`; neu ist
`sweep_gallery_conditional_selects`: erstes Dropdown öffnen und wählen, bedingtes Dropdown
einblenden (liegt oberhalb, Werte unverändert), ausblenden (Id 0 wieder auf altem Rechteck),
wieder einblenden (gleiche Id/Rechteck), bedingtes Dropdown öffnen und Option 1 wählen, ohne den
ersten Wert zu ändern. Report je Kombination:

`18 modules, 15 settings flows, 5 gallery flows, 158 cases, 0 overflows`, total
**1264 Fälle / 0 Überläufe** (Runde 19: 1240/0).

#### Falsifikationen (Exit 101, Datei per sha256 byte-gleich zurückgespielt)

| Neutralisierte Produktionsstelle | Test | Ergebnis |
| --- | --- | --- |
| Id wieder an die reine Malreihenfolge gebunden (Occurrence pro Frame) | Stabilitäts-Test | panicked, Exit 101 |
| `select_slot` liefert immer Slot 0 (Kollision) | Stabilitäts-Test | panicked, Exit 101 |
| Space aus der Bestätigung entfernt (`FocusState::press` nur Enter) | Drawer-Test | panicked, Exit 101 |

Der dritte Fall ist die Bestätigungsbedingung des Drawer-Buttons selbst: der Button aktiviert über
`FocusState::activate`/`press`, es gibt keinen zweiten Space-Pfad.

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 396 Tests in `socdof-ui` (lib)
* Golden-Hash unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`)
* `git status --short` **156** Einträge (unverändert), `git diff --cached` leer

Nichts gestaged, nichts committet.

#### Weiterhin nicht geprüft / Restpunkte

* Kein echter Fensterlauf, keine visuelle Kontrolle: alles headless über synthetische
  `RawInput`-Events; Fokus-Ringe, Hover-Farben und die Lage von Popups/Drawer auf einem Bildschirm
  sind ungesehen.
* Die **Menü**-Id hängt weiterhin an der Malreihenfolge (Occurrence pro Frame). Für die Galerie und
  alle heutigen Aufrufer ist die Reihenfolge statisch; ein bedingt gemaltes Menü mit gleicher
  Beschriftung hätte dasselbe Problem wie der Select vor dieser Runde.
* Der Select-Slot lebt im `PopupState`, und `PopupState` ist `Copy`: zwei Controls, die denselben
  Zustand kopieren und in einem Frame beide malen, teilten sich den Slot. Heutige Aufrufer geben
  jedem Control einen eigenen Zustand.
* Slots werden aus einem persistenten Zähler vergeben, sind also nur innerhalb eines Prozesslaufs
  deterministisch; da Fokus- und Popup-Zustand ohnehin im Speicher leben, ist das unkritisch, aber
  Ids sind keine stabilen Export-Schlüssel.
* Menü- und Select-Werte haben weiterhin keinen Datensatzbezug (Galerie ist eine Demo); das dritte
  Dropdown schreibt nur in seinen eigenen Zustand.
* Leertaste ist belegt für `select`, `menu` (gemeinsamer Commit-Zweig) und den Drawer-Button; für
  Kalender, Datei-Drop, `checkbox`/`switch` (die über denselben `press` laufen) gibt es keinen
  eigenen Test.
* `button`, `checkbox`, `switch`, Kalender, Drawer und Datei-Drop nutzen Auto-Ids; Kollisionen
  innerhalb einer `Ui` sind ausgeschlossen, gleiche Beschriftungen erzeugen aber auch keine
  gemeinsame Identität – geprüft ist nur, was die Tests oben abdecken.

### Runde 21: Menü-Ids leben im Zustand, Leertaste am Datei-Drop

Runde 20 hatte die `menu`-Identität als letzten Rest an die Malreihenfolge gebunden (Occurrence pro
Frame) und das ehrlich als Schwäche benannt. Runde 21 gibt dem Menü dasselbe Slot-Prinzip wie dem
Select – ohne den Select anzufassen – und belegt die Leertaste an einem dritten Control.

#### Produktionskorrekturen

* **Gemeinsamer Slot-Mechanismus, getrennte Zähler.** `select_slot` heißt jetzt `popup_slot` und
  nimmt einen Namensraum: Schlüssel `("socdof-slot-next", "select")` bzw.
  `("socdof-slot-next", "menu")`. Select und Menü zählen also getrennt, keiner verschiebt die Slots
  des anderen; die Ids bleiben durch die Tags `"socdof-select"`/`"socdof-menu"` zusätzlich paarweise
  verschieden. Der Slot lebt im jeweiligen `PopupState` und wird beim ersten Malen vergeben.
* **Menü nutzt den Slot.** `menu` bildet seine Id als `menu_id(label, slot)` mit
  `slot = popup_slot(ui, popup, "menu")`; `menu_id(label, slot) = Id::new(("socdof-menu", label,
  slot))`. Registrierung, `ui.interact(rect, id, Sense::click())`, Öffnen und Popup-Zeilen laufen
  unverändert über genau diese Id. `select` blieb unverändert (nur der umbenannte Helper-Aufruf).
* **Galerie: bedingtes drittes Menü.** Bei aktivem „Entwurf“-Schalter malt die Overlay-Karte ein
  drittes Menü mit derselben Beschriftung **oberhalb** der festen Zeile, mit eigenem Zustand
  (`menu_choice_extra`/`menu_popup_extra`).
* **Datei-Drop zählt Aktivierungen.** Die Galerie zählt `drop_activations`, damit die Aktivierung des
  Drop-Bereichs am Zustand prüfbar ist statt an einem Anzeigetext.

#### Tests (4 Breiten × 2 Themes)

* `the_menu_ids_survive_a_conditional_menu_at_every_phone_width` – erstes Menü per Klick öffnen
  (`Some(0)`), mit Escape schließen, Fokus kehrt zur Id 0 zurück. Bedingtes Menü erscheint darüber
  (liegt oberhalb, endet nicht hinter der Kante, öffnet sich nicht von selbst), Ausblenden bringt
  Id 0 exakt auf das alte Rechteck, Wiedereinblenden gibt Id 2 dasselbe Rechteck, der Fokus bleibt
  bei Id 0. Der Pfeil bedient weiter Id 0 (`Some(0)`, bedingtes Menü `None`), Enter wählt Zeile 1
  ohne `menu_choice_extra` zu setzen; anschließend öffnet ein Klick auf Id 2 nur das bedingte Menü
  und wählt dort Zeile 2, ohne den ersten Wert zu ändern. Menü- und Select-Ids sind paarweise
  verschieden.
* `the_drop_area_activates_with_space_like_enter_at_every_phone_width` – der Drop-Bereich wird über
  seine gepaintete Höhe (96 px) in der Fokus-Ordnung gefunden, per Rad in den Viewport gescrollt
  (Sichtbarkeit und Panel-Kante geprüft), per Pointer getroffen (`drop_activations == 1`, Fokus auf
  der Control-Id), dann Enter (`== 2`) und Leertaste (`== 3`): beide Tasten aktivieren gleich.

#### Sweep: sechster Galerie-Flow, 1288 Fälle

`GalleryFlow` hat jetzt zusätzlich `MenuConditional`; `sweep_gallery_conditional_menu`: erstes Menü
öffnen und Zeile 1 wählen, bedingtes Menü einblenden (liegt oberhalb, Wert unverändert),
ausblenden (Id 0 wieder auf altem Rechteck), wieder einblenden (Id 2 gleiches Rechteck), bedingtes
Menü öffnen und Zeile 3 wählen, ohne den ersten Wert zu ändern. Report je Kombination:

`18 modules, 15 settings flows, 6 gallery flows, 161 cases, 0 overflows`, total
**1288 Fälle / 0 Überläufe** (Runde 20: 1264/0).

#### Falsifikationen (Exit 101, Datei per sha256 byte-gleich zurückgespielt)

| Neutralisierte Produktionsstelle | Test | Ergebnis |
| --- | --- | --- |
| Menü-Id wieder an die Malreihenfolge gebunden (Occurrence pro Frame) | Menü-Stabilitäts-Test | panicked, Exit 101 |
| `popup_slot` liefert immer Slot 0 (Kollision) | Menü-Stabilitäts-Test | panicked, Exit 101 |
| Leertaste des Drop-Bereichs entfernt (`focus.activate` → nur Enter) | Drop-Test | panicked, Exit 101 |

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 398 Tests in `socdof-ui` (lib)
* Golden-Hash unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`)
* `git status --short` **156** Einträge (unverändert), `git diff --cached` leer

Nichts gestaged, nichts committet.

#### Weiterhin nicht geprüft / Restpunkte

* Kein echter Fensterlauf, keine visuelle Kontrolle: alles headless über synthetische
  `RawInput`-Events; Fokus-Ringe, Hover-Farben und die Lage von Popups/Drawer sind ungesehen.
* Der Slot lebt im `PopupState`, und `PopupState` ist `Copy`: zwei Controls, die denselben Zustand
  kopieren und in einem Frame beide malen, teilten sich den Slot. Heutige Aufrufer geben jedem
  Control einen eigenen Zustand.
* Slots kommen aus prozesslokalen persistenten Zählern; sie sind innerhalb eines Laufs
  deterministisch, aber keine stabilen Export-Schlüssel.
* Menü- und Select-Werte haben weiterhin keinen Datensatzbezug (Galerie ist eine Demo); das dritte
  Menü und das dritte Dropdown schreiben nur in ihren eigenen Zustand.
* Harness-Notiz: Toasts verändern die Kartenhöhe, und das Rad-Scrollen ist geglättet. Rechteck-
  Vergleiche über Ein-/Ausblenden brauchen deshalb ein paar Leerlauf-Frames (`settle`), sonst
  verschiebt die nachlaufende Animation das Bild um wenige Pixel. Das ist Harness-Verhalten, kein
  Produktionsfehler.
* Leertaste ist belegt für `select`, `menu`, den Drawer-Button und den Datei-Drop; für den Kalender
  gibt es keine Bestätigungsbedingung (Pfeile/Home/End ändern den Tag direkt), `checkbox`/`switch`
  laufen über denselben `press`, sind aber nicht einzeln getestet.
* `button`, `checkbox`, `switch`, Kalender, Drawer und Datei-Drop nutzen Auto-Ids; Kollisionen
  innerhalb einer `Ui` sind ausgeschlossen, gleiche Beschriftungen erzeugen aber auch keine
  gemeinsame Identität.

### Runde 22: Kopierter `PopupState` bekommt eine eigene Id, Leertaste an Checkbox/Schalter

Runde 21 hatte den Slot im `Copy`-`PopupState` ehrlich als Schwäche benannt: zwei Controls, die im
selben Frame Kopien desselben Zustands malen, teilten sich Slot und damit Id. Runde 22 behebt das im
Produktionscode, ohne `Copy` zu entfernen, und belegt die Leertaste an zwei weiteren Controls.

#### Produktionskorrekturen

* **Claim pro Frame statt Vertrauen in den kopierten Wert.** `popup_slot` liest den Basisslot aus dem
  Zustand und zählt pro Frame, wie oft dieser Basisslot in diesem Namensraum schon angemeldet wurde:
  Temp-Daten unter `("socdof-slot-claim", namespace, base)` mit dem Wert `(frame, count)`. Der erste
  Anmelder behält den Slot; jeder weitere bekommt `base + 1_000_000 * claim` und schreibt diesen Slot
  in *seine* Kopie zurück. Öffnen, `ui.interact`, Klick, Optionszeilen und Fokus laufen unverändert
  über die so gebildete Id, und der Zustand der beiden Kopien bleibt getrennt.
* **Der doppelte Slot wird abgeleitet, nicht gezählt.** Ein erster Versuch vergab den Zusatz-Slot aus
  dem persistenten Zähler des jeweiligen `Context`. Weil der Bericht (`render`) und einige Tests
  denselben Zustand in einem *frischen* Context malen, startete dieser Zähler wieder bei 0 und
  vergab einen Slot, den ein anderes Control schon besaß; im Sweep wanderte dadurch `select_extra`
  von Slot 2 weg und `rect_of` fand das Control nicht mehr. Die Ableitung `base + 1_000_000 * claim`
  ist für denselben Zustand in jedem Context gleich und kann mit normalen Slots (die pro Control um
  1 wachsen) nicht kollidieren. Der `(frame, count)`-Teil bleibt nötig, weil egui Temp-Daten über
  Frames überleben.
* **`PopupState::slot()`** (nur lesend) macht den Slot für Tests und Diagnose sichtbar.
* **Galerie-Demo: zwei Dropdowns mit einem kopierten Zustand.** Neue Felder `mirror_popup`,
  `mirror_copy`, `mirror_a`, `mirror_b`, `mirror_copied`. Der Besitzer wird zuerst gemalt, direkt
  danach wird sein Zustand kopiert, und beide werden ab dem ersten Entwurfs-Frame im selben Frame
  gemalt. Damit trägt die Kopie für einen Frame den Slot des Besitzers, und die Claim-Mechanik muss
  ihn trennen. Beide Dropdowns stehen **hinter** dem bedingten Extra-Select, damit sie dessen Slot 2
  nicht verschieben; die bedingten Dritt-Control-Tests aus Runde 20/21 bleiben unverändert grün.
* **Kein Layoutsprung.** Ein erster Aufbau malte die Kopie erst ab dem zweiten Frame; das schob die
  Menü-Karte um eine Zeile und ließ `the_menu_ids_survive_a_conditional_menu...` berechtigt rot
  werden (Rechteck 572 statt 516 px). Mit der Kopie im selben Frame bleibt die Karte stehen, und
  derselbe Test vergleicht wieder stabile Rechtecke.

#### Tests (4 Breiten × 2 Themes)

* `the_two_dropdowns_with_a_copied_popup_state_keep_their_own_identity_at_every_phone_width` – die
  beiden Slots sind nach dem ersten Entwurfs-Frame verschieden und bleiben über einen weiteren Frame
  gleich; beide Ids und beide Rechtecke sind verschieden, die Kopie endet nicht hinter der
  Panel-Kante. Der Besitzer öffnet per Pointer (`Some(1)`, Kopie `None`), die Optionszeile liegt im
  Viewport, der Klick wählt Index 2 und lässt die Kopie bei 0. Danach öffnet die Kopie allein
  (`Some(0)`, Besitzer `None`), ihre Options-Id ist von der des Besitzers verschieden, und der Klick
  wählt Index 1, ohne den Besitzerwert zu ändern.
* `controls::keyboard_confirm_tests::checkbox_and_switch_confirm_with_space_like_enter_at_every_phone_width`
  – eigenes Harness (ScrollArea, `auto_shrink([false, false])`, `focus.begin_frame`/`finish_frame`),
  weil die Auto-Ids der Galerie bei Layoutwechsel wandern. Checkbox und Schalter werden per Rad in
  den Viewport gescrollt (Rect im Viewport geprüft), per Pointer getroffen (Zustand `checked` bzw.
  `on` kippt, Fokus liegt auf der Control-Id), dann Enter (kippt zurück) und Leertaste (kippt wieder):
  beide Tasten ändern denselben Wert im isolierten Zustand, nicht einen Anzeigetext.

#### Kalender: keine Bestätigungsbedingung

`calendar` (ab `crates/ui/src/controls.rs:734`) liest nur `ArrowLeft/ArrowRight/ArrowUp/ArrowDown`,
`Home`, `End`, `PageUp`/`PageDown` und die beiden `icon_button`-Aktivierungen; es gibt keinen Zweig
für `focus.press`, `activate` oder Enter/Space. Ein Tag wird also direkt beim Pfeildruck gewählt, es
gibt nichts zu bestätigen. Damit ist die Leertaste am Kalender bewusst nicht belegt und die
Einschränkung steht hier als Notiz statt als Behauptung.

#### Sweep: siebter Galerie-Flow, 1304 Fälle

`GalleryFlow` hat jetzt zusätzlich `Mirror`; `sweep_gallery_mirror` aktiviert den Entwurf, prüft
verschiedene Slots/Ids/Rechtecke, öffnet den Besitzer per Rad-Scroll und Klick, wählt Zeile 2 (Kopie
bleibt 0), öffnet danach die Kopie, wählt Zeile 1 (Besitzer bleibt 2) und prüft die Rechtecke beider
Optionszeilen im Viewport. Report je Kombination:

`18 modules, 15 settings flows, 7 gallery flows, 163 cases, 0 overflows`, total
**1304 Fälle / 0 Überläufe** (Runde 21: 1288/0).

#### Falsifikationen (Exit 101, Datei per sha256 byte-gleich zurückgespielt)

| Neutralisierte Produktionsstelle | Test | Ergebnis |
| --- | --- | --- |
| Doppelter Slot wieder der Basisslot (`base + 1_000_000 * claims` → `base`) | Kopierter-Zustand-Test | `panicked`, Exit 101, `sha256sum -c: controls.rs: OK` |
| Leertaste aus der Bestätigungsbedingung entfernt (`focus.press`: nur Enter) | Checkbox/Schalter-Test | `panicked`, Exit 101, `sha256sum -c: focus.rs: OK` |

#### Gates und Arbeitsstand

* `cargo fmt --all -- --check` → 0
* `cargo clippy --workspace --all-targets -- -D warnings` → 0
* `cargo test --workspace` → 0, 400 Tests in `socdof-ui` (lib)
* Golden-Hash über `sha256sum crates/ui/tests/golden/*.txt | sha256sum` unverändert
  (`75a48508953be2ecaef8ed7a9b0628de2c79edf90acf2652c26a7cc2afd52d69`)
* `git status --short` **156** Einträge = 152 `M` + 4 `??` (`crates/ui/src/phone_sweep.rs`,
  `crates/ui/tests/forms.rs`, `crates/ui/tests/phone.rs`, `crates/ui/tests/wizard.rs`); die vier
  untracked Dateien sind dieselben aus den früheren Runden, diese Runde legt keine neue an, und die
  drei geänderten Quelldateien (`controls.rs`, `gallery.rs`, `focus.rs`) waren bereits modifiziert.
  `git diff --cached` ist leer (0 Zeilen).

Nichts gestaged, nichts committet.

#### Weiterhin nicht geprüft / Restpunkte

* Kein echter Fensterlauf, keine visuelle Kontrolle: alles headless über synthetische
  `RawInput`-Events; Fokus-Ringe, Hover-Farben und die Lage der beiden Dropdowns sind ungesehen.
* Die Claim-Mechanik hängt an der Malreihenfolge: der erste Anmelder eines Basisslots behält ihn.
  Tauschen zwei Kopien im selben Frame die Reihenfolge, tauschen sie auch die Ids. Geprüft ist nur
  die feste Reihenfolge der Galerie.
* Doppelte Slots sind abgeleitete Zahlen (`base + 1_000_000 * claim`) und keine stabilen
  Export-Schlüssel; die Ableitung trägt, solange ein Screen weniger als eine Million Popups malt.
  Die ersten Slots kommen weiterhin aus prozesslokalen persistenten Zählern und sind nur innerhalb
  eines Laufs deterministisch.
* Der Claim-Zähler liegt in egui-Temp-Daten pro `Context`; zwei Contexts, die denselben Zustand im
  selben Frame malen, zählen getrennt. Für die App (ein Context) ist das ohne Belang, für Harnesses
  mit frischem Context ist es der Grund für die abgeleitete statt gezählte Doppel-Id.
* Menü-, Select- und Checkbox-/Schalter-Werte haben weiterhin keinen Datensatzbezug (Galerie ist
  eine Demo).
* Leertaste ist jetzt belegt für `select`, `menu`, den Drawer-Button, den Datei-Drop sowie
  `checkbox` und `switch`. Für den Kalender gibt es keine Bestätigungsbedingung (siehe oben);
  `button` hat keinen eigenen Leertasten-Test.
* `button`, `checkbox`, `switch`, Kalender, Drawer und Datei-Drop nutzen Auto-Ids; Kollisionen
  innerhalb einer `Ui` sind ausgeschlossen, gleiche Beschriftungen erzeugen aber auch keine
  gemeinsame Identität.

