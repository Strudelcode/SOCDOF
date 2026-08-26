# SOCDOF Agent Instructions

This repository follows the guidelines defined in [INSTRUCTIONS.md](./INSTRUCTIONS.md).

## Critical Guidelines for the AI Agent:
1. **Language & Documentation**: All development notes, release history entries (`versions/V*.md`), code comments, and project documentation MUST strictly be written in **English**. All user-facing UI texts, labels, dialogs, buttons, and placeholders MUST ALWAYS be updated in all 4 supported languages (`de`, `en`, `fr`, `es`) via `src/lib/i18n.ts`. No single-language hardcoded UI texts are permitted.
2. **No Mock / Placeholder Data**: Never prepopulate new or existing modules with artificial dummy/mock sample entries or example data (e.g. fake prefilled tickets, dummy records) unless explicitly requested by the user. Always provide clean empty states with intuitive creation workflows.
3. **Versioning**: Increment patch or minor versions flexibly according to scope (e.g. `19.0.5` -> `19.1.0` / `19.2.0` for notable feature sets or modules, `19.1.1` / `19.1.5` for enhancements/fixes) in `package.json`, `src/lib/version.ts`, and add release notes to `versions/V19.md`. Never start a new major version (e.g. `20.0.0`) without explicit user approval.
4. **Todo Management & Archive**: 
   - Keep `todo/todo.md` clean and focused on open/planned tasks.
   - Move completed tasks to `todo/completed_todo.md` upon completion to maintain an organized archive.
5. **Verification**: Always run `npm run lint` and `npm run build` after completing tasks to ensure code reliability.
