# SOCDOF v21.0.0 Release Overview

## Major Milestone: Google Calendar 2-Way Live Synchronization & Dedicated Desktop Calendar Suite

SOCDOF version `21.0.0` introduces real-time bidirectional Google Calendar synchronization, a full-featured dedicated Desktop Calendar application (`CalendarModule`), dynamic self-updating taskbar & desktop icons, Windows 11 Agenda flyout enhancements, and expanded user manual documentation.

---

### Highlights & New Capabilities

1. **Dedicated Calendar Desktop App (`CalendarModule.tsx`)**:
   - Month, Week, Day, and Agenda viewing modes with 42-day fixed grid rendering.
   - Merged display of customer invoice payment due dates, Google Calendar meetings, and custom local appointments.
   - Quick appointment creation with date/time pickers, all-day toggle, color tags, location, and notes.

2. **2-Way Google Calendar Synchronization (`googleCalendar.ts`)**:
   - OAuth 2.0 / Firebase client-driven token authentication.
   - Automatic publication of invoice due dates directly into Google Calendar.
   - Live streaming of Google Calendar appointments into SOCDOF with 1m, 2m, 5m auto-sync options.

3. **Dynamic Desktop & Taskbar Calendar Icon (`DynamicCalendarIcon.tsx`)**:
   - Self-updating live month and day indicator on shortcuts and taskbar buttons.

4. **Taskbar Clock Agenda Flyout**:
   - Instant viewing of upcoming events and invoice due dates from the system tray clock with 1-click navigation.

5. **In-App User Documentation (`DocumentationApp.tsx`)**:
   - New detailed chapters covering Google Calendar, Restaurant/KDS, and Support Services.
   - Binding rule in `INSTRUCTIONS.md` mandating documentation updates for all new or modified apps.
