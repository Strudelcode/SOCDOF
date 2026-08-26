
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

### 2.1 Native Desktop App & Windows Features
- [ ] Quick shortcut/action to open local file explorer / Windows directory.
- [ ] Code signing: Resolve "Windows Protected Your PC" (SmartScreen) warning by signing the `.exe` with developer identity (`Yuri / Strudel`).

### 2.2 Invoicing & E-Invoicing (FatturaPA / Italy)
- [ ] SdI status receipts and notification XML parsing support.

### 2.3 Calendar & External Integrations
- [ ] Investigate optional two-way / one-way iCal and Google Calendar / Outlook feed synchronization.

### 2.4 System Audit & Polishing
- [ ] Audit all apps, buttons, modal dialogs, error states, and keyboard accessibility for fluid operation.
- [ ] Optional global customer search across Support, Invoices, and CRM.

## Other
- [ ] Multi-page showcase & documentation web portal (features, releases, preview, GitHub link).
- [ ] ~~vielleicht wenn es umsetztbar und nützlich ist das wir in der App einen api key einbauen den man nutzen kann für andere Sachen?~~ (aktuell nicht benötigt)



