# SOCDOF Agent Instructions

This repository follows the guidelines defined in [INSTRUCTIONS.md](./INSTRUCTIONS.md).

## Critical Guidelines for the AI Agent:
1. **Versioning**: Increment patch or minor versions flexibly according to scope (e.g. `19.0.5` -> `19.1.0` for notable feature sets or modules, `19.1.1` / `19.1.5` for enhancements/fixes) in `package.json`, `src/lib/version.ts`, and add release notes to `versions/V19.md`. Never start a new major version (e.g. `20.0.0`) without explicit user approval.
2. **Todo Management**: Check off items in `todo/todo.md` with `[x]` as soon as they are completed.
3. **Verification**: Always run `npm run lint` and `npm run build` after completing tasks to ensure code reliability.
