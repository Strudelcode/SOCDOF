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

### 2.0 Latest Completed Milestone

The v23.14.3 Discord Tag ID Mapping, Thread Messages Inspector & Custom Emoji Parsing milestone is complete and archived in `todo/completed_todo.md`.

The v23.14.2 Live Discord Forum Tags Sync, 30-Second Polling & Thread Status milestone is complete and archived in `todo/completed_todo.md`.

The v23.14.1 Authentic Live Discord Embed & Forum Post Preview with Real-Time Typing milestone is complete and archived in `todo/completed_todo.md`.

The v23.14.0 App-Location Modal Picker & Start Menu Cleanup milestone is complete and archived in `todo/completed_todo.md`.

The v23.13.0 Bug-Reports Desktop App, 3-Step Guided Reporting & Discord Embed Polish milestone is complete and archived in `todo/completed_todo.md`.

The v23.12.0 Live Discord Bot Forum Integration for Feedback & Bug Reports milestone is complete and archived in `todo/completed_todo.md`.

The v23.11.0 Invoicing Templates & Layout Architecture in Invoicing & Settings milestone is complete and archived in `todo/completed_todo.md`.

The v23.10.10 European Number & Currency Formatting (DIN 1333) & Therapy Dark Mode Refinement milestone is complete and archived in `todo/completed_todo.md`.

The v23.8.0 Therapy & Practice Flow, Authentic Desktop Preview & Settings Personalization Overhaul milestone is complete and archived in `todo/completed_todo.md`.

The v23.7.0 Windows-Inspired Settings & Display / Multi-Monitor Management milestone is complete and archived in `todo/completed_todo.md`.

The v23.6.1 Brand Neutralization & Avatar Studio UX Layout Refinement milestone is complete and archived in `todo/completed_todo.md`.

The v23.6.0 Windows-Style Personalization, Avatar Studio & Admin User Inspection milestone is complete and archived in `todo/completed_todo.md`.

The v23.5.0 Multi-Step System Reset & Complete Reinstallation Flow milestone is complete and archived in `todo/completed_todo.md`.

The v23.4.5 Desktop Icon Layout & In-App Activation Persistence Stabilization milestone is complete and archived in `todo/completed_todo.md`.

The v23.4.4 Persistent Application Activation, Pinning & Desktop Ordering milestone is complete and archived in `todo/completed_todo.md`.

The v23.4.3 Safe In-App Updates & Persistent Application State milestone is complete and archived in `todo/completed_todo.md`.


### 2.1 Multi-User Architecture, Authentication & Windows-Style Security

The v23.3.2 Profile Picture Alignment & Centering Stabilization milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.3.1 Dynamic Language Discovery, Search Filtering & Windows-Style Toast Feedback milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.3.0 Windows 11 Personalization Center, Live Blur & Unsaved Changes Guard milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The authentication and local multi-user milestone is complete for v22.10.0. Historical completion details are archived in `todo/completed_todo.md`.

The v23.0.0 Users & Accounts / Start Menu power milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.5 Consolidated User Management & Profile Personalization in Settings milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.4 Localization Alignment & Crisp Vector Flag Rendering milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.3 Dark Mode Persistence & Auth Activity Event Fix milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.2 Responsive first-run account onboarding & authentication refinements milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.2.1 Settings-centered user management cleanup is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.1.0 Windows-style authentication surface redesign is complete on the feature branch and is archived in `todo/completed_todo.md`.



### 2.2 Windows-Inspired Settings & Display / Multi-Monitor Management

The v23.7.0 Windows-Inspired Settings Hub & Multi-Monitor Extended Display Management milestone is complete and archived in `todo/completed_todo.md`.

### 2.3 Praxis & Therapy Management Suite (TheraPsy Architecture)

The v23.4.2 CustomerPicker & CRM Contact Integration for Praxis & Therapy milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

The v23.4.0 Praxis & Therapy Interconnected Client Dossier & Cross-Module Linking milestone is complete on the feature branch and is archived in `todo/completed_todo.md`.

Initial offline Practice workspace was introduced in v23.2.0. Historical implementation details are archived in `todo/completed_todo.md`.

### 2.4 Invoicing Templates, Office File Binding & Layout Architecture
- [ ] Deep binary Word (.docx) AST parsing & XML unzipping engine for complex nested multi-page tables.
- [ ] Local filesystem folder watcher (`templates/`) for automatic desktop synchronization of external Office template files.
- [ ] Direct PDF form-field token injection and interactive visual placement tool for PDF background stationery.

### 2.5 System Optimization & Continuous Polishing
- [ ] Continuous module performance and responsive UX refinements.
- [ ] Automated regression coverage for critical local data workflows.
- [ ] Accessibility audit and keyboard-navigation refinement across major desktop surfaces.
