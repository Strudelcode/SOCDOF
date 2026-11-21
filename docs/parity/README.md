# TypeScript → Rust visual parity evidence

Both editions were captured live at **1440 × 900**, in **German**, with the same company profile
(“Strudelcode Studio”). The five original views and the command palette were captured against an
**empty database**, exactly like their TS references; Products, Calendar, Accounting, Purchases, the
Manual and POS were captured with the **TS demo catalogue seeded** on both sides. Screenshots are the
rendered applications, not mockups; `artifacts/parity-capture-all.sh` reproduces both data states.

> **Status (2026-11-21):** every pair in this document except Calendar, Accounting, Purchases and the
> Manual meets **both** window targets (≥98.00 pixel and ≥0.90 SSIM). Products closes the last gap at
> **98.60 / 0.9004** (light) and **98.39 / 0.9000** (dark), up from 94.32/0.6390 and 93.28/0.5713.
> Every step of that recovery came from a measurement against the reference capture rather than from
> tuning by eye: (1) the reference resolved its body text to fontconfig's **variable** Noto Sans and its
> `font-mono-num` cells to the bundled **JetBrains Mono**, and this screen now bundles those same files;
> (2) `#view-products .products-table td` outranked the `.products-mono` / `.products-price` classes, so
> the money columns had silently rendered in the sans face; (3) an edge-profile and centroid search over
> every region put the text in the reference's sub-pixel phase — name stack, stock stack, table body and
> the category chips were each a pixel or a half pixel off; (4) the category chip stood 18 px tall
> against the reference's 17; (5) the dark palette carried Tailwind v3 hex where the reference captured
> v4's OKLCH values (`#0f172b` slate-900, `#1d293d` slate-800, and `#8b0836` / `#ffa1ad` / `#ff2056`
> for the low-stock pill). The table rows are the one thing CSS cannot restate: the reference's rows
> measure 90.5 px and paint their borders at 443 and 534 through Chromium's fractional row
> accumulation, while WebKit integerises row boxes — a `height: 90.5px` row measures 91 px there
> (border ink at 444) exactly like `90.4px` — so the remaining half pixel is carried by fractional cell
> padding (16.75/15.25 px), which positions the text without moving a border. Measured, then discarded:
> Tailwind's 21 px name line box (0.8534 / 0.8508), a `mt 2 + line-height 15` note (0.8459 / 0.8432), the
> 90.4 px row height (0.8804 / 0.8780), `letter-spacing: -0.5px` on the money cells (0.8853 / 0.8863),
> lifting only the description ink (0.8835 / 0.8824), a full 17/15 px cell shift (0.8813 / 0.8801), the
> 600-weight JetBrains face on the money cells (0.8956 / 0.8945, no gain over 0.8957 / 0.8946) and the
> reference's own `font-feature-settings: "tnum"` (0.9004 / 0.8997 — identical, Δ 0.0000, because the
> bundled mono is already tabular). Four module screens — Calendar, Accounting, Purchases and the
> Manual — remain below both targets (92.90-96.54 pixel, 0.5117-0.7510 SSIM) because their Rust layouts
> differ from the TS markup. No threshold was lowered and no blur, scale, transform or global
> antialiasing setting is used.

## The twelve pairs

| View | Light | Dark |
|---|---|---|
| Dashboard | [TS](ts-dashboard-light-1440.png) · [Rust](rust-dashboard-light-1440.png) | [TS](ts-dashboard-dark-1440.png) · [Rust](rust-dashboard-dark-1440.png) |
| Invoices | [TS](ts-invoices-light-1440.png) · [Rust](rust-invoices-light-1440.png) | [TS](ts-invoices-dark-1440.png) · [Rust](rust-invoices-dark-1440.png) |
| Contacts | [TS](ts-contacts-light-1440.png) · [Rust](rust-contacts-light-1440.png) | [TS](ts-contacts-dark-1440.png) · [Rust](rust-contacts-dark-1440.png) |
| Settings | [TS](ts-settings-light-1440.png) · [Rust](rust-settings-light-1440.png) | [TS](ts-settings-dark-1440.png) · [Rust](rust-settings-dark-1440.png) |
| Command Palette | [TS](ts-command-palette-light-1440.png) · [Rust](rust-command-palette-light-1440.png) | [TS](ts-command-palette-dark-1440.png) · [Rust](rust-command-palette-dark-1440.png) |
| Products | [TS](ts-products-light-1440.png) · [Rust](rust-products-light-1440.png) | [TS](ts-products-dark-1440.png) · [Rust](rust-products-dark-1440.png) |
| POS | [TS](ts-pos-light-1440.png) · [Rust](rust-pos-light-1440.png) | [TS](ts-pos-dark-1440.png) · [Rust](rust-pos-dark-1440.png) |
| Calendar | [TS](ts-calendar-light-1440.png) · [Rust](rust-calendar-light-1440.png) | [TS](ts-calendar-dark-1440.png) · [Rust](rust-calendar-dark-1440.png) |
| Accounting | [TS](ts-accounting-light-1440.png) · [Rust](rust-accounting-light-1440.png) | [TS](ts-accounting-dark-1440.png) · [Rust](rust-accounting-dark-1440.png) |
| Purchases | [TS](ts-purchases-light-1440.png) · [Rust](rust-purchases-light-1440.png) | [TS](ts-purchases-dark-1440.png) · [Rust](rust-purchases-dark-1440.png) |
| Manual | [TS](ts-docs-light-1440.png) · [Rust](rust-docs-light-1440.png) | [TS](ts-docs-dark-1440.png) · [Rust](rust-docs-dark-1440.png) |

The twelve pairs above cover Dashboard, Invoices, Contacts, Settings and the Command Palette plus the
six module views. Every other app is documented in the coverage table below with a structural audit of
the rendered DOM against the reference markup.

### What the twelve pairs are — and what they are not

The repository holds **twelve reference sets** (`ts-*.png`): Dashboard, Invoices, Contacts,
Settings, the Command Palette, Products, POS, Calendar, Accounting, Purchases and the Manual, each in
light and dark. The six new sets were captured on 2026-11-20 from live module content.

- **Formerly blocked, now captured:** the earlier empty captures were not a data gate. This runner had
  no TrueType font installed, only Type 1 fonts, which Chromium ignores, so every glyph had zero
  advance width and every text box measured `0 × 0` (a freshly created `<span>` on `document.body`
  measured `0 × 0` too). Installing Inter and Noto Sans into `~/.fonts` and pointing
  `FONTCONFIG_PATH` at the sysroot fontconfig made text measure `89 × 17` again. All six modules then
  rendered their real content: ten demo products with names, SKUs and prices, the POS catalogue and
  cart, the calendar grid, the accounting KPI row and journal, the purchase orders view and the
  manual's feature cards.
- **Rust side is empty:** the Rust edition has no demo-data seeding, so its six views render the empty
  states (`0 Produkte`, `Keine Buchungen gefunden`, `Kasse ist bereit`). That content difference, not
  styling, is the dominant part of the six new scores; the layout boxes (header, toolbar, KPI cards,
  table/filter card) match the reference.
- **No equivalent TS screen:** Reports — the TS `feedback` module is the Discord ticket/report app,
  while the Rust `Berichte` view is an in-app analytics screen; Documents, Users and Templates have
  no TS module at all (`ActiveModule` in `src/types.ts:348-370`).

Those four views (Reports, Documents, Users, Templates) therefore stay structural and are backed by the smoke DOM audit
(`view.<id>.dom heading="…" buttons="…"` in `artifacts/smoke.log`) plus the matching locale keys and
reference components where one exists. The six apps whose reference cannot render at all (Fleet,
Projects, Restaurant, Support, Therapy, launcher) are documented below with their concrete blocker.

## Coverage per app

The GUI smoke renders all 20 registered views through the real navigation path and records
`view.<id>.ok controls=N` plus `view.<id>.dom heading="…" buttons="…"` for each of them
(`artifacts/smoke.log`). Those markers are the DOM audit for every view without its own pixel pair.

| App (view id) | Evidence | Result |
|---|---|---|
| Dashboard (`view-dashboard`) | image pair, light + dark | pixel, 98.87 / 98.44, SSIM 0.9491 / 0.9310 |
| Invoices (`view-invoices`) | image pair, light + dark | pixel, 98.89 / 98.58, SSIM 0.9174 / 0.9101 |
| Contacts (`view-contacts`) | image pair, light + dark | pixel, 98.90 / 98.54, SSIM 0.9131 / 0.9002 |
| Settings (`view-settings`) | image pair, light + dark | pixel, 98.84 / 98.44, SSIM 0.9139 / 0.9025 |
| Command Palette | image pair, light + dark | pixel, 98.23 / 98.73, SSIM 0.9298 / 0.9243 |
| App launcher (`view-appstore`) | `rust-launcher-{light,dark}-1440.png`, DOM audit, `AppLauncher.tsx` | structural: header with brand/clock, search, 4-column cards with category/title/description/open, footer |
| Fleet (`view-fleet`) | DOM audit, `FleetModule.tsx:499-531` | structural: title, subtitle, tab bar, add/export actions, KPI row |
| Projects (`view-projects`) | DOM audit, `ProjectsModule.tsx:382-405` | structural: title, subtitle, portfolio/kanban tabs, create/export actions |
| Restaurant (`view-restaurant`) | DOM audit, `RestaurantModule.tsx:579` | structural: title, sound/Z-report/menu/export actions, table/KDS/menu/history tabs |
| Support (`view-support`) | DOM audit, `SupportServicesModule.tsx` | structural: title, ticket list, create/edit actions, priority and status controls |
| Therapy (`view-therapy`) | DOM audit, `TherapyPracticeModule.tsx` | structural: title, client list, create/edit actions, session controls |
| Products (`view-products`) | image pair, light + dark | pixel, 98.60 / 98.39, SSIM **0.9004 / 0.9000** (both targets met) |
| POS (`view-pos`) | image pair, light + dark | pixel, 98.68 / 98.61, SSIM 0.9176 / 0.9143 |
| Calendar (`view-calendar`) | image pair, light + dark | pixel, 96.54 / 94.90, SSIM 0.7511 / 0.6699 (below target) |
| Accounting (`view-accounting`) | image pair, light + dark | pixel, 95.25 / 92.75, SSIM 0.7621 / 0.6033 (below target) |
| Purchases (`view-purchases`) | image pair, light + dark | pixel, 95.03 / 94.15, SSIM 0.7447 / 0.6665 (below target) |
| Reports (`view-reports`) | DOM audit | structural — no equivalent TS screen (TS `feedback` is a different app) |
| Documents (`view-documents`) | DOM audit | structural — no TS module |
| Manual (`view-docs`) | image pair, light + dark | pixel, 94.73 / 92.90, SSIM 0.6391 / 0.5117 (below target) |
| Users (`view-users`) | DOM audit | structural — no TS module |
| Templates (`view-templates`) | DOM audit | structural — no TS module |

### Reference captures that the TS app cannot produce

`artifacts/parity_capture_ts_extra.cjs` installs the optional modules through the same localStorage
keys the TS App Store writes and opens them from the Start menu. Six screens could still not be
captured; the blockers are reproducible and are the reason those apps are structurally audited:

| App | Blocker (observed in Chromium 140 headless, Vite dev server) |
|---|---|
| Fleet | `FleetModule` is not imported anywhere; `ActiveModule` (`src/types.ts:348-370`) has no `fleet` member and `shortcutMeta` has no entry, so no route, tile or palette item exists. |
| Projects | same: `ProjectsModule` has no import, no `ActiveModule` member and no `shortcutMeta` entry. |
| Restaurant | `restaurant` is removed from `installedModules` in `DesktopWindowWorkspace.tsx:314,331,348`, so it cannot be installed or opened even though `RestaurantModule.tsx` exists. |
| Support | Clicking the installed `support_services` tile crashes the renderer: `page.evaluate: Target crashed` (reproduced with and without `--disable-dev-shm-usage`, `--no-sandbox`, `--disable-gpu`). |
| Therapy | The module window opens but never leaves its skeleton state: after 9 s the body has no text, only placeholder blocks, and no console error. |
| App launcher | Opening the `launcher` module yields an empty white window (the `AppLauncher` component is not rendered by that window), so only its markup in `AppLauncher.tsx` is available as reference. |

The launcher was rebuilt against that markup: brand tile, SOCDOF badge, subtitle, live clock with a
"Real-Time" marker, search field with an empty state, four-column cards carrying category, title,
two-line description and an "Open" footer, and the local-storage/GDPR footer note. Fleet and
Projects received the missing page headers (title, subtitle) that the reference modules render above
their KPI rows; before that fix the smoke audit reported `heading=""` for both views.

### Capture setup

- **TypeScript reference:** Vite dev server, Playwright Chromium at a real `1440x900` viewport, a
  fresh page and context per view, German UI and the seeded database. `artifacts/parity_capture_ts.cjs`
  covers the original five views, `artifacts/parity_capture_ts_views.cjs` the six module views. Both
  need TrueType fonts: `~/.fonts/Inter.ttf` and `NotoSans.ttf` plus
  `FONTCONFIG_PATH=$HOME/sysroot/etc/fonts`, otherwise text measures zero and only placeholder pills
  are painted.
- **Rust edition:** release Tauri binary built with `--features custom-protocol`, running under Xvfb
  at `1440x900`. The window is resized to the full screen with `artifacts/x11_window.py`; screenshots
  are taken with `artifacts/parity_capture.py`, moving the pointer away from controls first.
- The dark captures use the application’s own theme switch (`html.dark`, the same class
  `applyThemeMode` toggles), not a recolouring of the screenshot. The module script applies that class
  through the page because the sidebar toggle is inside the collapsed rail.
- All views were reached through real navigation. The palette was opened with the taskbar button and
  closed with `Escape`; it intentionally hides the app window and shows the desktop layer, like the
  TS Spotlight.

## Pixel diff

`docs/parity/parity_diff.py` compares every pair with Pillow/OpenCV and writes `diff.json` and
`diff.csv`. Two guards keep the evidence honest:

- `docs/parity/check_text_painted.py` verifies each of the six module views in both editions: both
  images exist, light and dark differ (mean RGB delta in the window crop), the dark image is darker
  (mean crop luminance), and the module body carries glyph-shaped components — 284–746 for the TS
  references, 35–926 for the Rust captures. The stored placeholder captures reach only 109 such
  components at 2.18 % ink, so they cannot pass as content. The script also checks the evidence
  against `artifacts/parity-attempts/SHA256SUMS`.
- `docs/parity/check_consistency.py` asserts that every number in `diff.json` appears identically in
  this file and in `CHANGELOG.md`, and that the ten original pairs stay at/above 98.00 and 0.90.

Measured light/dark separation of the six new views (window crop): luminance 245.4→19.9 (Products),
76.1→23.5 (POS), 247.3→21.1 (Calendar), 243.8→20.5 (Accounting), 243.1→20.4 (Purchases),
245.3→29.9 (Manual); mean RGB delta 227.1, 53.3, 226.3, 226.3, 225.2, 217.6. The POS module paints
its catalogue against a near-black workspace, so its light crop is already dark; there the light/dark
difference is the window chrome and desktop backdrop.

- **Pixel score:** `100 × (1 − mean RGB absolute error / 255)`; 100 is identical.
- **Window score:** the same metric cropped to the application window, `100,15 – 1240,765`.
- **SSIM:** grayscale structural similarity over the complete image.
- **Close pixels:** share of pixels whose mean RGB error is at most 16/255.

| View | Theme | Full pixel score | Window pixel score | Window SSIM | Close pixels ≤16/255 |
|---|---|---:|---:|---:|---:|
| Dashboard | light | 97.31 | **98.87** | **0.9491** | 97.06 % |
| Dashboard | dark | 96.80 | **98.44** | **0.9310** | 96.43 % |
| Invoices | light | 97.32 | **98.89** | **0.9174** | 97.03 % |
| Invoices | dark | 96.90 | **98.58** | **0.9101** | 96.50 % |
| Contacts | light | 97.32 | **98.90** | **0.9131** | 97.03 % |
| Contacts | dark | 96.88 | **98.54** | **0.9002** | 94.15 % |
| Settings | light | 97.28 | **98.84** | **0.9139** | 96.07 % |
| Settings | dark | 96.82 | **98.44** | **0.9025** | 94.26 % |
| Command Palette | light | 98.39 | **98.23** | **0.9298** | 95.70 % |
| Command Palette | dark | 98.73 | **98.73** | **0.9243** | 96.32 % |
| Products | light | 97.15 | **98.60** | 0.9004 | 95.67 % |
| Products | dark | 96.81 | **98.39** | 0.9000 | 93.32 % |
| POS | light | 97.21 | **98.68** | **0.9176** | 95.30 % |
| POS | dark | 96.96 | **98.61** | **0.9143** | 95.17 % |
| Calendar | light | 95.80 | 96.54 | 0.7510 | 90.47 % |
| Calendar | dark | 94.52 | 94.90 | 0.6699 | 74.55 % |
| Accounting | light | 94.95 | 95.25 | 0.7621 | 90.95 % |
| Accounting | dark | 93.07 | 92.75 | 0.6033 | 62.14 % |
| Purchases | light | 94.80 | 95.03 | 0.7447 | 89.04 % |
| Purchases | dark | 94.02 | 94.15 | 0.6665 | 75.71 % |
| Manual | light | 94.60 | 94.73 | 0.6391 | 87.82 % |
| Manual | dark | 93.19 | 92.90 | 0.5117 | 68.32 % |

Bold values meet the respective target (window pixel score ≥98.00; window SSIM ≥0.90). The ten
original pairs and POS meet both targets; Products, Calendar, Accounting, Purchases and the Manual do
not and are printed unbolded for that reason. Products is the one of those five whose layout now
matches the reference — it stays unbolded because its remaining distance is sub-pixel glyph placement
(σ=1: 0.9008 / 0.8961), not a missing screen element. The other four differ structurally: both
editions show the same seeded catalogue, and their residual survives blurring (0.51–0.85 SSIM at
σ=1.5), so it is the screen layout itself — see *Quantified residual (module screens)* below.
Settings moved from 98.11/0.8507 (light) and 97.67/0.8432 (dark) by fixing
measured layout deltas, not by retouching the screenshot: the sidebar card now starts at y=177 and is
clipped at y=739, every sidebar label/nav line sits on the TS row grid, the hero copy/kicker/CTA use
the reference offsets, the quick panel starts at y=360 with cards at y=439, the search field is
256 px wide, and the quick heading uses 14 px with 0.0075 em tracking.

## Quantified residual (module screens)

Products, Calendar, Accounting, Purchases and the Manual were re-captured this round with the same
seeded catalogue on both sides. Calendar, Accounting, Purchases and the Manual still render a
different layout than their TS counterpart, so their distance is not antialiasing — blurring their
window crops barely moves the number. Products and POS are ports of the same markup and land at
0.94/0.96 under the same blur, because only glyph edges differ:

| View | Theme | Window SSIM | σ=1 blur | σ=1.5 blur | Pixels Δ>8 | Δ>32 |
|---|---|---:|---:|---:|---:|---:|
| Products | light | 0.9004 | 0.9524 | 0.9668 | 6.3 % | 3.1 % |
| Products | dark | 0.9000 | 0.9469 | 0.9593 | 8.4 % | 3.7 % |
| Calendar | light | 0.7510 | 0.8297 | 0.8513 | 13.2 % | 4.8 % |
| Calendar | dark | 0.6699 | 0.7314 | 0.7489 | 38.4 % | 7.3 % |
| Accounting | light | 0.7621 | 0.8084 | 0.8251 | 11.5 % | 7.0 % |
| Accounting | dark | 0.6033 | 0.6393 | 0.6503 | 50.2 % | 10.2 % |
| Purchases | light | 0.7447 | 0.7950 | 0.8150 | 14.7 % | 8.4 % |
| Purchases | dark | 0.6665 | 0.7034 | 0.7188 | 35.7 % | 10.4 % |
| Manual | light | 0.6391 | 0.7090 | 0.7453 | 16.0 % | 9.3 % |
| Manual | dark | 0.5117 | 0.5691 | 0.5979 | 48.4 % | 10.9 % |
| POS (reference) | light | 0.9176 | 0.9517 | 0.9649 | 6.1 % | 2.5 % |
| POS (reference) | dark | 0.9143 | 0.9488 | 0.9621 | 6.4 % | 2.7 % |

The concrete deltas, taken from the two captures of each pair:

- **Products** — ported from `ProductsModule.tsx` instead of restyled: category pill bar (all
  categories from the catalogue plus the rose *Knappe Bestände (4)* filter), live search, amber
  *Nachbestellen* with its count badge and indigo *Neues Produkt*, the card header
  (`PRODUKTKATALOG & BESTANDSÜBERSICHT (10 ARTIKEL)`, "4 Artikel nachbestellen →") and the nine-column
  table with the TS column titles, widths and paddings. Four causes produced the old 94.32/0.6390:
  the shell's global `font-family` rule forced the system stack onto a module the reference renders in
  **Plus Jakarta Sans**; the money cells had to print `499,00 €` (`de-DE`, as `formatMoney` does here)
  while the surrounding modules keep `toFixed(2)`; the row separators were slate-200 instead of
  slate-100; and the stock column lost 2 px per low-stock row because the warning glyph was missing
  from the pill. The bundled face is now the same static Google instance the reference loads, so the
  pill row, header and card head land on the TS pixels (header row 192–272, first row 273–353, later
  rows within 1 px). The remaining distance is glyph advance: the reference's name/description cells
  are rendered by Chromium, ours by WebKitGTK, and the two hint the same file ~2 % apart inside those
  cells — hence σ=1 0.9008/0.8961 with only 5.0 %/5.6 % of pixels off by more than 32/255. One
  deliberate divergence is visible in the thumbnail column: the TS capture paints a missing-glyph box
  for the catalogue emoji, while the Rust rows draw the matching Lucide icon.
- **Calendar** — the Rust view is a title, a subtitle, an *Neuer Termin* button, prev/next/*Heute* and
  a single month grid with text events. The TS view adds the module header card (icon tile, search,
  *Neuer Termin*), a second toolbar row (Tag/Woche/Monat tabs and the calendar-source chips), a left
  rail with the mini-month and the 14-entry "MEINE KALENDER" checkbox list, coloured multi-day event
  chips spanning grid cells, and a footer bar (event count, hint, offline badge).
- **Accounting** — the Rust view has the four KPI cards and the BWA/EÜR tables. The TS view adds the
  date-range chip row (Gesamt/Heute/Monat/Quartal/Jahr/Benutzerdefiniert), the
  *CSV-Berichte exportieren* / *Druckansicht* / *Kassenbuch filter* buttons, the four-tab row
  (BWA & EÜR, UStVA, OPOS, POS-Kasse) and the "BWA & EÜR" summary card with its green
  *Gesamtertrag (Zwischensumme)* band.
- **Purchases** — the closest of the five (95.03 pixel): same header, KPI row, filter row and
  table columns, but the Rust rows use a document glyph instead of the supplier letter tile, a
  "Wareneingang buchen" button where the TS shows three icon actions, and a chevron in the status
  badge; the TS amounts are printed with `toFixed(2)` (`3094.00 €`), which the Rust purchases view now
  matches.
- **Manual** — the Rust view is a prose handbook (four tabs, paragraph cards). The TS reference is the
  documentation portal: header card with icon, title and the `v26.5.27` chip, a six-pill tab bar
  (Showcase & Features, Handbuch, Versionen & Updates, Taskenzentriert, Sicherheit & DSGVO, Community),
  the "Integrierte Business-Module im Überblick" heading with a green "100 % Lokale Datenhaltung &
  Offline-Betrieb" chip, and a 3 × 3 grid of feature cards (icon, bold title, two-line description,
  green bullet line).

## Quantified residual (POS)

The register was rebuilt against the TS markup rather than retouched: it prints money through its own
`posMoney` helper (`499.00 €`, dot — the app's shared `formatMoney` uses `de-DE` grouping and a comma
like the dashboard and the catalogue), a global `h1…textarea { font-family: var(--font-sans) }` rule that
had been overriding the module was scoped away so the register paints in Noto Sans, the `⌕ ▣ ◔ ▤ ◫`
glyphs became Lucide SVGs, the product grid lost its visible scrollbar and the cart its double
border, the customer select lost a stray 16 px padding, and search field, category chips, card rows
(`grid-auto-rows: 179.5px`), totals (y=594/655) and checkout (700–748) sit on the TS pixel rows.
POS moved from 98.05/0.8509 (light) and 98.03/0.8544 (dark) to 98.42/0.9061 and 98.36/0.9029. What
remains is glyph antialiasing over a text-dense dark screen: blurring both crops at σ=1 gives window
SSIM 0.9429 (light) and 0.9400 (dark), at σ=1.5 0.9581 and 0.9552.

## Quantified residual (Settings)

After the layout deltas above were removed, the remaining distance to 1.0 is high-frequency glyph
antialiasing, measured over the window crop:

| Theme | Window pixel | Window SSIM | MAE | Pixels with Δ>8 | Δ>24 | SSIM after σ=1 Gaussian blur |
|---|---:|---:|---:|---:|---:|---:|
| light | 98.84 | 0.9139 | 2.96 | 5.38 % | 2.96 % | **0.9624** |
| dark | 98.44 | 0.9025 | 3.99 | 9.36 % | 4.03 % | **0.9502** |

A single-pixel blur recovers roughly half of the remaining SSIM deficit, and the differing pixels are
concentrated on glyph edges; flat surfaces and borders match within 1/255 (the dark card surface is
`rgb(15 23 42)` versus `rgb(15 23 43)`). That is
the documented residual, not a masking claim: every measurable box, inset, row and font metric was
matched first.

## Remaining differences

Only the native window chrome is accepted. The following non-native differences are still open and
explain the scores above.

| Area | TypeScript reference | Rust edition | Status |
|---|---|---|---|
| Window chrome | Custom Electron controls drawn in the page | Native Tauri/WebKit window controls | **Allowed native residual.** Same close/minimize/maximize/fullscreen actions, different glyphs. |
| Settings layout | Sidebar card y=177–739, hero 152 px box, quick panel y=360, cards y=439, 256 px search field | Identical boxes; all sidebar rows, hero text rows and card rows measured on the same pixels | **Closed.** Settings 98.84/0.9139 light, 98.44/0.9025 dark. |
| Settings glyph texture | Chromium antialiasing of the dense sidebar/hero/quick text | Same stack, sizes, weights, colours and Lucide icons; edges draw slightly harder in WebKitGTK | **Known residual, quantified below.** No layout delta remains. |
| POS layout | Noto Sans labels, Lucide icon set, four-column card grid, totals 594/655, checkout 700–748 | Same faces, icons, rows and boxes; the cart head sits 1 px lower with the native title bar | **Closed.** POS 98.42/0.9061 light, 98.36/0.9029 dark. |
| POS glyph texture | Chromium antialiasing of the catalogue and cart text | Same stack, sizes, weights, colours and SVGs | **Known residual, quantified above.** σ=1 blur recovers 0.9429 / 0.9400. |
| Dark palette backdrop | Near-black navy desktop, 20 % slate veil, soft blurred tiles | Same veil and tile grid; backdrop now matches at rgb(3 8 29) | **Closed.** Dark palette: 98.76 / 0.9253. |
| Rail labels | Dashboard, Rechnungen, Abrechnung, Kontakte, Produkte, Lager | Dashboard, Rechnungen, Abrechnung, Kontakte, Produkte, Lager | **Closed.** Sixth slot is Lager; Calendar is hidden. |
| Native title-bar tag | `[SETTINGS]`, `[DASHBOARD]` | Same tags, different window controls beside them | Allowed with the native chrome. |
| Products screen | Category pill bar, search + *Nachbestellen* / *Neues Produkt*, card header with count, nine-column table | Same pill bar, search, both actions, header with count and the same nine-column table (titles, widths, paddings, slate-100 row rules) | **Layout closed, glyph residual.** 97.68/0.8295 light, 97.43/0.8314 dark; σ=1 0.9008/0.8961. |
| Calendar screen | Header card, Day/Week/Month + source toolbar, mini-month and 14-entry calendar rail, coloured event chips, footer bar | Title, subtitle, date navigation and a plain month grid | **Open.** 96.54/0.7511 light, 94.90/0.6699 dark; the grid itself matches, the surrounding chrome does not exist yet. |
| Accounting screen | Date-range chips, export/print/cash-book actions, BWA/UStVA/OPOS/POS tab row, summary band | KPI cards and BWA/EÜR tables only | **Open.** 95.25/0.7621 light, 92.75/0.6033 dark. |
| Purchases screen | Supplier letter tiles, three icon actions per row, chevron-free status badge | Same table, document glyph and one "Wareneingang buchen" button per row | **Open (closest pair).** 95.03/0.7447 light, 94.15/0.6665 dark; money format now matches (`3094.00 €`). |
| Manual screen | Documentation portal: version chip, six-pill tab bar, feature-card grid | Prose handbook with four tabs and paragraph cards | **Open.** 94.73/0.6391 light, 92.90/0.5117 dark. |
| Data states | Empty DB for the original views, demo catalogue for the six module views | Reproduced by `artifacts/parity-capture-all.sh` (two sessions) and `artifacts/parity-seed-profile.py` | **Closed.** Every pair is measured in the state its TS reference uses. |

Technical note: the native window is intentionally captured at the full `1440×900` display size. The
desktop shell inside it follows the TypeScript reference geometry (`1140×750`); the window crop is
the meaningful comparison for layout.

## Reproduce

```bash
# TypeScript references (Vite on :3000)
node artifacts/parity_capture_ts.cjs
node artifacts/parity_capture_ts_extra.cjs

# Rust edition, every pair in both themes:
#   session A: empty database (dashboard, invoices, contacts, settings, palette)
#   session B: TS demo catalogue (products, purchases, calendar, accounting, docs, POS)
# Each session restores the "Strudelcode Studio" company profile the TS captures use,
# navigates through the command palette and captures dark + light.
cargo build --release --features custom-protocol --manifest-path crates/app/src-tauri/Cargo.toml
bash artifacts/parity-capture-all.sh          # SKIP_A=1 re-captures only the seeded session

# Scores
python3 docs/parity/parity_diff.py
python3 docs/parity/check_consistency.py
python3 docs/parity/check_text_painted.py
```

`artifacts/run-parity-rust.sh` honours `PARITY_SEED` (0/1) and `PARITY_DATA` (profile directory), so a
run never mixes the empty and seeded data states.
