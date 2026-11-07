# SOCDOF

> **Strudel's Organization, Commerce & Documentation Offline Flow**  
> *The modern, offline-first Windows ERP desktop suite and productivity workspace for businesses, practices, freelancers, and commerce.*

[![GitHub Release](https://img.shields.io/github/v/release/Strudelcode/SOCDOF?color=blue&logo=github)](https://github.com/Strudelcode/SOCDOF/releases)
[![Discord](https://img.shields.io/badge/Community-Discord-5865F2?logo=discord)](https://discord.gg/QW85EaXTgB)
[![Offline First](https://img.shields.io/badge/Data%20Storage-100%25%20Offline%20First-emerald)](#-privacy--offline-first-architecture)
[![License](https://img.shields.io/badge/License-MIT%20%2F%20Free-green)](#)
[![Languages](https://img.shields.io/badge/Languages-EN%20%7C%20DE%20%7C%20FR%20%7C%20ES-indigo)](#-quad-lingual-by-design)

---

## 🌟 Overview

**SOCDOF** brings the comfort and power of a full-fledged enterprise resource planning (ERP) system into a familiar **Windows 11-inspired desktop environment**. 

Whether you're managing clients, issuing professional invoices, tracking warehouse inventory, running a restaurant POS with interactive table layouts, logging therapy practice sessions, or tracking business mileage — SOCDOF does it all seamlessly, **100% offline**, without requiring any mandatory cloud accounts or recurring subscription fees.

All data is stored directly on your computer in high-performance local databases (IndexedDB via Dexie.js) with instant search, rich dossiers, and one-click JSON backup/export.

---

## 🚀 Key Features & Modules

### 🪟 Windows Desktop Experience
- **Multi-Window Productivity**: Open, drag, resize, snap, minimize, and maximize multiple app windows simultaneously.
- **Fluent Start Menu & Taskbar**: Quick-launch pinned apps, search tools, system tray status, and user profile switcher.
- **Multi-Monitor Display Manager**: Extend workspaces across multiple screens, rearrange visual monitor layouts, and detach windows with one-click popouts.
- **Night Light (Nachtmodus)**: Built-in warm color temperature adjustment (1500K – 5500K) to reduce eye strain.
- **Personalization Studio**: Custom wallpapers, Mica glass blur effects, theme accent colors, and custom avatar profiles.

### 👥 Contacts & CRM (Customer Book)
- **Unified Address Book**: Manage customers, vendors, partners, and leads in one place.
- **Instant Customer Picker**: Quick-select contacts across all modules with live search and 1-click creation.
- **360° Dossiers**: View linked invoices, open quotes, therapy logs, and payment histories per contact.

### 🧾 Invoicing & Billing Suite
- **Professional Document Layouts**: DIN 5008-aligned invoices, estimates, delivery notes, and credit notes.
- **EPC QR-Code Invoicing**: Built-in banking payment QR codes (EPC / GiroCode) for instant bank transfers.
- **Multi-Currency & Tax Handling**: Support for standard VAT, reduced rates, Kleinunternehmerregelung (§ 19 UStG), and therapeutic exemptions (§ 4 Nr. 14 UStG).
- **Payment Tracking**: Track open, paid, and overdue balances with automated payment reminders.

### 🏥 Therapy & Practice Manager (TheraPsy Suite)
- **Instant CRM Integration**: Click *"+ New Client"* to directly search and select from your customer book without repetitive data entry.
- **Clinical Session Documentation**: Structured progress notes, intervention methods, duration presets (30m, 50m, 60m, 90m), and layout-locked textareas (`resize-none`).
- **Standardized Invoicing View**: Itemized billing list with invoice numbers, PDF/print preview with practice letterhead, and 1-click sync to the main accounting database.
- **Fahrtenbuch (Mileage Log)**: Log starting and ending odometer readings with automatic distance calculation and live EStG reimbursement totals (0.30 €, 0.38 €, 0.42 €/km).
- **Interactive Performance Dashboard**: Real-time multi-month revenue and session progression charts with tooltips and KPI cards.

### 📦 Inventory, Products & Warehouse Moves
- **Stock Management**: Track physical stock levels, SKU codes, barcodes, cost vs. sales prices, and minimum reorder thresholds.
- **Stock Movements Log**: Record transfers between physical warehouses, customer drops, vendor shipments, and inventory losses.
- **Low Stock Alerts**: Automated reorder recommendations when stock dips below safe thresholds.

### 🍽️ Point of Sale (POS) & Restaurant Mode
- **Interactive Table Plan Designer**: Design floor layouts with drag-and-drop tables, seats, and room sections.
- **Real-Time Table Orders**: Take dine-in or takeout orders with dish variants, notes, and modifiers.
- **Kitchen & Bar Display**: Live order tickets for kitchen staff with status timers.
- **Split Bills & Payment**: Split bills by person or item with cash, card, and digital receipt generation.

### 📊 Financial Accounting & Reporting
- **Business Performance Analytics**: Live revenue graphs, expense breakdowns, and profit margins.
- **Standard Tax Reports**: BWA (Betriebswirtschaftliche Auswertung), EÜR (Einnahmen-Überschuss-Rechnung), UStVA (Umsatzsteuervoranmeldung), and daily cash Z-Reports.

### 🌐 Quad-Lingual by Design
SOCDOF comes out of the box with **100% native translations** across every module, button, dialog, and report:
- 🇬🇧 **English** (Default)
- 🇩🇪 **German (Deutsch)**
- 🇫🇷 **French (Français)**
- 🇪🇸 **Spanish (Español)**

---

## 🔒 Privacy & Offline-First Architecture

Your business data belongs to you. Period.

- **Zero Cloud Requirement**: Runs completely locally on your desktop or browser. No accounts or mandatory telemetry.
- **IndexedDB & Dexie.js**: Robust, transactional client-side storage capable of holding tens of thousands of records instantly.
- **Local JSON Backups**: Export your entire database (contacts, invoices, stock, sessions, settings) as a standalone JSON file and restore it on any machine in seconds.
- **Secure System Reset**: Multi-step verification wizard to safely purge local workspace state when transferring machines.

---

## 📥 Installation & Downloads

Pre-built Windows binaries are available on the official [GitHub Releases](https://github.com/Strudelcode/SOCDOF/releases) page:

1. **Setup Installer (`SOCDOF Setup ... .exe`)**: Complete Windows installation with desktop shortcuts, Start Menu integration, and auto-updater support.
2. **Portable Edition (`SOCDOF ... .exe`)**: Single standalone executable that runs directly without installation.
3. **Web App**: Run instantly in any modern web browser or deploy as a static Progressive Web App (PWA).

---

## 🛠️ Local Development

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/Strudelcode/SOCDOF.git
cd SOCDOF

# 2. Install dependencies
npm install

# 3. Start the local development server (port 3000)
npm run dev

# 4. Run TypeScript and syntax linting
npm run lint

# 5. Build for production (web bundle)
npm run build
```

### Packaging Windows Electron App
```bash
# Package the Windows NSIS setup installer & portable executable
npm run build:exe
```

---

## 📂 Project Structure

```text
SOCDOF/
├── electron/              # Electron main process, IPC handlers & window management
├── src/
│   ├── components/        # UI modules (Invoices, POS, Inventory, Therapy, Settings, etc.)
│   │   └── therapy/       # Therapy & Practice submodules (Dashboard, Billing, Mileage, Clients)
│   ├── lib/               # Database (Dexie.js), i18n, sound, display manager, versioning
│   ├── types/             # TypeScript definitions across all business entities
│   ├── App.tsx            # Main desktop workspace orchestrator & window manager
│   └── main.tsx           # React entry point
├── todo/                  # Active tasks (todo.md) & completed archive (completed_todo.md)
├── versions/              # Detailed release documentation per version series
└── package.json           # App metadata, dependencies & build scripts
```

---

## 🤝 Community & Support

- **Discord Community**: Join our [Discord Server](https://discord.gg/QW85EaXTgB) for discussions, feature requests, and help.
- **Issue Tracker**: Report bugs or propose ideas on [GitHub Issues](https://github.com/Strudelcode/SOCDOF/issues).
- **Changelog**: See [CHANGELOG.md](./CHANGELOG.md) and [`versions/`](./versions/) for the full release history.

---

*Crafted with ❤️ by Strudel / Yuri in South Tyrol, Italy.*
