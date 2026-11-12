# SOCDOF v25 Release Overview

## v25.2.12 — Power Menu Overlay

- **Start Menu Power Menu (`DesktopWindowWorkspace.tsx`)**:
  - The Ein/Aus menu opens as an absolutely positioned overlay above the start menu footer. The footer container is `relative`, so opening the menu no longer shifts the content of the start menu.
- **Documentation (`DocumentationApp.tsx`)**:
  - The taskbar & start menu chapter describes the power menu in German, English, French and Spanish.

## Multi-User Merge Rules (Portable / NAS, planned)

- The merge rules are defined in `INSTRUCTIONS.md`, section 9. They are a specification, not yet implemented.
- Open work is tracked in `todo/todo.md` under "Multi-user merge for the portable / NAS version".
