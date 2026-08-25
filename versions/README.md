# SOCDOF – Version and Release Documentation

This directory contains the completed changes for each major version.

## Version index

- [Version 20 – current](./V20.md)
- [Version 19](./V19.md) • [Full V19 Release Overview](./releases/v19-release.md)
- [Version 18](./V18.md)
- [Version 17](./V17.md)

## Documentation rules

- Each major version has exactly one file: `V17.md`, `V18.md`, `V19.md`, and so on.
- Feature, fix, and patch releases are added to the file for their major version.
- The major version may only be increased after a deliberate decision and prior confirmation.
- Minor and patch versions within the current major version may be increased independently, for example `v19.3.1`.
- Each completed change should receive its own section with version and date.
- The version history documents completed changes. A separate status file may additionally describe the current project state.
- Before a release, `package.json`, the central version source, the README, and the relevant version file must show the same version.

## Entry template

```md
## v19.x.y – YYYY-MM-DD

### Changes
- …

### Affected areas
- …

### Limitations or open questions
- …

### Verification
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Relevant manual verification
```

## Starting a new major version

If a change may justify a new major version, ask for confirmation first. After approval:

1. Create `V{Major}.md`.
2. Update the version number in the relevant project files.
3. Add the new version to this index.
4. Document the changes, limitations, and verification results.
