# SOCDOF – Active Roadmap & Task List

> This file contains all currently open, in-progress, and planned roadmap items. Completed tasks are archived in [completed_todo.md](./completed_todo.md).

---

> ## 1. Operating Rules & Guidelines
> 
> ### 1.1 Language & Documentation
> - All development notes, release history files (`versions/V*.md`), code comments, and technical guides MUST strictly be written in **English**.
> - Multilingual user-facing UI texts are maintained via `src/lib/i18n.ts` (DE, EN, FR, ES).
> 
> ### 1.2 No Mock / Example Data Rule
> - Modules must initialize with clean empty states (e.g. `[]`). Never inject artificial demo/sample records unless explicitly requested.
> 
> ### 1.3 Two-File Todo Management & Archiving Rule
> - **Active Tasks**: `todo/todo.md` is strictly reserved for open (`[ ]`) and in-progress items.
> - **Completed Tasks**: As soon as an item is finished and verified, move it directly to `todo/completed_todo.md` with `[x]` and archive details to keep the active list concise and actionable.

---

## 2. Active Roadmap & Pending Tasks

### 2.1 Multi-User Architecture, Authentication & Windows-Style Security

Authentication and local multi-user personalization are implemented and verified in CI. Remaining work for this area is tracked as future enhancements only when it requires functionality beyond the current password-based flow.

### 2.2 Windows-Inspired Settings & Display / Multi-Monitor Management
- [ ] **Windows 11-Inspired Settings Hub**:
  - [ ] Structured sidebar navigation (Accounts & Profiles, Personalization & Wallpapers, Display & Multi-Screen, System & Backups, Privacy & Security).
  - [ ] Focus purely on workspace controls while omitting redundant low-level OS settings (like network adapters or sound drivers).
- [ ] **Multi-Monitor & Extended Display Management**:
  - [ ] Display detection and multi-screen layout settings for multi-monitor setups.
  - [ ] Support "extending" (`Erweitern`) SOCDOF workspaces across multiple monitors (e.g. popping windows out to secondary screens or multi-screen desktop spanning in Electron).
  - [ ] Per-monitor window positioning memory (remembering which monitor an app window was last placed on).

### 2.3 Praxis & Therapy Management Suite (TheraPsy Architecture)
- [ ] **Patientendokumentation (Patient & Client Health Records)**:
  - [ ] Patient Master Data (anamnesis, contact information, emergency contacts, insurance status).
  - [ ] Medical history, diagnoses (ICD-10 / ICD-11 search & assignment), and medical findings.
  - [ ] Encrypted local storage (compliant with DSGVO Art. 9 for special category health data).
  - [ ] Document & findings attachment storage (PDFs, lab reports, doctor letters).
- [ ] **Sessionprotokollierung (Therapy & Consultation Session Notes)**:
  - [ ] Chronological session log (date, duration, intervention techniques, progress notes).
  - [ ] Structured therapy protocol templates (initial interview, standard session, crisis intervention, final report).
  - [ ] One-click conversion from completed session to billable invoice item.
- [ ] **Rechnungsstellung für Praxen (Medical & Practice Invoicing)**:
  - [ ] Practice-specific billing (fee schedules, hourly/session rates, private insurance invoices, cash receipts).
  - [ ] Honorar- & Privatrechnungen with session dates and therapy diagnostic codes.
  - [ ] Seamless integration into existing SOCDOF DIN 5008 PDF generator and invoice sequences.
- [ ] **Praxis-Buchhaltung (Practice Accounting & Cash Flow)**:
  - [ ] Dedicated Revenue-Expense Accounting (EÜR - Einnahmen-Überschuss-Rechnung) for healthcare freelancers and practices.
  - [ ] Tax category mapping (VAT-exempt healthcare services according to § 4 Nr. 14 UStG vs. taxable coaching/services).
  - [ ] Cash book (Kassenbuch) for direct cash settlements.
- [ ] **Fahrtenbuch (Digital Mileage & Trip Log)**:
  - [ ] Comprehensive logbook for home visits (Hausbesuche), hospital visits, and practice-related business trips.
  - [ ] Fields: Date, departure, destination, purpose of visit, start/end odometer reading, total distance (km), route, and reimbursement rate.
  - [ ] Exportable tax-compliant PDF/Excel report for tax advisors (Finanzamt-konform).
- [ ] **Praxis-Kalender (Appointment Scheduling & Session Planner)**:
  - [ ] Multi-view calendar (Day, Week, Month, Agenda) optimized for therapy slots (e.g. 50-minute units + buffer).
  - [ ] Appointment status tracking (Scheduled, Attended, Cancelled with/without charge, Missed).
  - [ ] Automatic linking between calendar appointment, patient documentation, and invoice generation.
- [ ] **Videotelefonie (Secure Telehealth & Video Consultation)**:
  - [ ] Integrated WebRTC peer-to-peer end-to-end encrypted video consultation.
  - [ ] 100% browser/desktop native without requiring third-party cloud accounts or data leakage.
  - [ ] In-session side panel for taking live session notes while maintaining video view.

### 2.4 System Optimization & Continuous Polishing
- [ ] Continuous module performance and responsive UX refinements.
