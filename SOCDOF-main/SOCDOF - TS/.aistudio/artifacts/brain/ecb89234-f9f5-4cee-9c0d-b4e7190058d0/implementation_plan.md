# Implementation Plan: Safe Collaborative Mode & Multi-User Delta Merge System

## User Review & Critical Decisions

> [!NOTE]
> The clarifying questionnaire was dismissed without explicit selections. As guided by the planning policy, this plan proceeds with robust, production-grade defaults tailored to SOCDOF's offline-first architecture:
> 1. **Merge Strategy (Default)**: **Append-Only Delta Log & Auto-Merge Engine**. Instead of attempting a complex live two-way lock across network shares (which causes file lock corruption on OneDrive/SMB), each client writes separate change packages (`delta_<device_id>_<timestamp>.socd`) into a shared sync folder. SOCDOF ingests and merges these changes automatically into local Dexie IndexedDB with zero risk of overwriting the main database.
> 2. **Scope of Concurrency (Default)**:
>    - **Fully Concurrent & Append-Safe**: Bug Reports, Support Tickets, Time Tracking Logs, Audit Logs, and Notes/Comments. These use globally unique IDs (UUIDv4) and timestamps so multiple users can create and resolve items simultaneously without collision.
>    - **Draft-Safe / Branching**: Invoices, Quotations, and Customer Profiles. If two users edit the same invoice draft concurrently, the engine creates a numbered revision or side-by-side review instead of silently clobbering changes.
>    - **Protected / Admin-Only in Safe Mode**: Global Settings, Company Info, License/Activation, and Database Resets are locked in Safe Mode to prevent accidental overrides.

---

## Section 1: Overview & Core Concept

When multiple team members run SOCDOF from a shared network volume (QNAP NAS, Synology, or a synced cloud folder like OneDrive / Google Drive), directly opening a single monolithic database file concurrently causes file locking errors or cloud sync conflict copies (e.g., `SOCDOF_conflicted_copy.db`).

The **Safe Collaborative Mode** introduces a decentralized, offline-first synchronization paradigm:
1. **Local Authoritative Cache**: Each client runs on its fast local IndexedDB storage (or localized cache).
2. **Sync Outbox & Inbox Directory**: A configurable shared folder (e.g., `Z:\SOCDOF_Shared\Sync` or `OneDrive\SOCDOF_Sync`) acts as a drop-zone for delta changes.
3. **Automatic Non-Destructive Ingestion**: When SOCDOF starts or periodically every few minutes, it reads incoming deltas from other team members, merges new tickets and invoice drafts seamlessly, and marks processed sync packages.
4. **Safe Mode Enforcement**: Restricts hazardous write operations (e.g., database wipes, overriding master company settings) while keeping the daily workflow (tickets, invoices, reports) fully operational.

---

## Section 2: User Experience & Visual Design

### 1. Header & Status Bar Integration
- A distinct status pill in the top bar / window header:
  - 🛡️ **Abgesicherter Team-Modus / Safe Mode Active** with subtle accent badge (`var(--accent)`).
  - Hover tooltip indicates: *"Mehrbenutzer-Schutz aktiv: Eigene Sync-Pakete werden exportiert, Änderungen der Kollegen automatisch zusammengeführt."*
  - Sync pulse dot: Green (Synchronisiert), Blue pulse (Deltas werden eingelesen), Yellow (Konflikt erkannt zur Prüfung).

### 2. Multi-User Sync & Merge Center (`Einstellungen -> Team & Sync`)
- **Modus-Auswahl**:
  - *Standard Einzelplatz (Single-User)*: Direkte lokale Speicherung.
  - *Abgesicherter Netzwerk-/Cloud-Modus (Multi-User Safe Mode)*: Automatische Delta-Generierung.
- **Geteilter Sync-Ordner**: Pfad-Auswahl (z.B. NAS-Laufwerk oder OneDrive-Ordner).
- **Mitarbeiter-Kennung (Device / User Handle)**: Name des aktuellen Bearbeiters (z.B. `Max - Laptop 1`), um Änderungen zuzuordnen.
- **Konflikt-Manager & Vorschau**:
  - Visuelle Anzeige neu importierter Datensätze (z.B. *„3 neue Tickets von Sarah hinzugefügt, 1 Rechnungsentwurf aktualisiert“*).
  - Falls dieselbe Rechnungsnummer zeitgleich vergeben wurde: Automatischer Konflikt-Dialog mit Vorschau beider Stände und Option zur Übernahme oder Zweigbildung (Branch).

### 3. Internationalization (i18n)
All new labels, tooltips, dialogs, and logs will be localized across all 4 SOCDOF languages (`de`, `en`, `fr`, `es`) in `src/lib/i18n.ts`.

---

## Section 3: Product Decisions & Trade-offs

| Decision | Selected Approach | Alternative Rejected | Rationale |
| :--- | :--- | :--- | :--- |
| **Data Sharing Architecture** | **File-Based Delta Packages (`.socd`)** | Direct SQLite/File Lock on NAS | Direct concurrent file locks over SMB/CIFS or OneDrive lead to corrupted database headers, lock contention, and OS freezing. |
| **Merge Resolution** | **Last-Write-Wins (LWW) + UUID Partitioning** | Central WebSocket Server | Requires no dedicated server daemon to run on the NAS; works identically on OneDrive, Dropbox, USB sticks, and basic Windows shares. |
| **Write Permissions in Safe Mode** | **Work-Permitted, Admin-Locked** | Complete Read-Only Mode | Complete read-only prevents staff from logging tickets or generating invoices. Partitioning risks enables productive teamwork safely. |

---

## Section 4: Technical Architecture & ASCII Diagram

```
+-------------------------------------------------------------------------------+
|                             SHARED DRIVE / ONEDRIVE                           |
|                      (e.g., Z:\SOCDOF_Sync\ or Cloud Folder)                   |
|                                                                               |
|   +-----------------------+              +-----------------------+            |
|   | delta_Alice_001.socd  |              |  delta_Bob_002.socd   |            |
|   |  - New Bug Report #41 |              |  - New Invoice Draft  |            |
|   |  - Ticket Status: Done|              |  - Time Log entry     |            |
|   +-----------^-----------+              +-----------^-----------+            |
+---------------|--------------------------------------|------------------------+
                |                                      |
         Writes Changes                        Writes Changes
         & Polls Inbound                       & Polls Inbound
                |                                      |
+---------------v-------------------+  +---------------v-------------------+
|          CLIENT 1 (ALICE)         |  |           CLIENT 2 (BOB)          |
|  - SOCDOF Desktop (Safe Mode)     |  |  - SOCDOF Desktop (Safe Mode)     |
|  - Local Dexie IndexedDB          |  |  - Local Dexie IndexedDB          |
|  - Sync Service & Ingestion Engine|  |  - Sync Service & Ingestion Engine|
+-----------------------------------+  +-----------------------------------+
```

### Key Technical Modules:
1. **`src/lib/sync/syncTypes.ts`**:
   - `SyncDelta`: Interface containing `deltaId`, `clientId`, `author`, `timestamp`, `entities: { table: string, action: 'insert' | 'update' | 'delete', record: any }[]`.
2. **`src/lib/sync/syncEngine.ts`**:
   - `exportLocalDelta()`: Scans modified records since last sync and writes JSON/encrypted delta package to the sync folder.
   - `ingestRemoteDeltas()`: Scans the shared folder for packages from other clients, merges entries into Dexie with UUID deduplication, and records sync markers.
3. **`src/lib/sync/conflictResolver.ts`**:
   - Resolves conflicts for mutable records (Invoices/Customers) using timestamp comparisons or creating distinct branch drafts if timestamps collide.
4. **`src/components/sync/SafeModeIndicator.tsx`**:
   - Top-bar badge with real-time sync status and quick-access merge drawer.
5. **`src/components/sync/SyncSettingsModal.tsx`**:
   - UI configuration for shared paths, auto-sync intervals, and conflict logs.
