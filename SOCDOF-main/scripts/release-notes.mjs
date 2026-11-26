#!/usr/bin/env node
/**
 * Extract the release notes for one version from the repository changelog.
 *
 * The changelog is the single source of truth for GitHub Releases and the
 * Discord announcement. A release fails when the tag and the app version do
 * not match or when the matching changelog section is missing.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const packagePath = resolve(root, "crates/app/package.json");
const changelogPath = resolve(root, "CHANGELOG.md");
const notesPath = resolve(root, "release-notes.md");

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const expectedVersion = String(packageJson.version);
const tauriConfig = JSON.parse(
  readFileSync(resolve(root, "crates/app/src-tauri/tauri.conf.json"), "utf8"),
);
const cargoToml = readFileSync(
  resolve(root, "crates/app/src-tauri/Cargo.toml"),
  "utf8",
);
const cargoPackage = /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(cargoToml);
if (String(tauriConfig.version) !== expectedVersion) {
  console.error(
    `release-notes: returning version mismatch: package.json=${expectedVersion}, tauri.conf.json=${tauriConfig.version}`,
  );
  process.exit(1);
}
if (!cargoPackage || cargoPackage[1] !== expectedVersion) {
  console.error(
    `release-notes: returning version mismatch: package.json=${expectedVersion}, Cargo.toml=${cargoPackage?.[1] ?? "missing"}`,
  );
  process.exit(1);
}
const rawTag = String(process.argv[2] || process.env.RELEASE_TAG || "").trim();

if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(rawTag)) {
  console.error(
    `release-notes: expected a tag like v${expectedVersion}, received "${rawTag}"`,
  );
  process.exit(1);
}

const version = rawTag.slice(1);
if (version !== expectedVersion) {
  console.error(
    `release-notes: tag ${rawTag} does not match crates/app/package.json (${expectedVersion})`,
  );
  process.exit(1);
}

let changelog;
try {
  changelog = readFileSync(changelogPath, "utf8");
} catch (error) {
  console.error(`release-notes: cannot read ${changelogPath}: ${error.message}`);
  process.exit(1);
}

const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const heading = new RegExp(
  `^##\\s+(?:\\[)?v?${escapedVersion}(?:\\])?(?:\\s+[-–]\\s+.*)?\\s*$`,
  "m",
);
const match = heading.exec(changelog);
if (!match) {
  console.error(
    `release-notes: CHANGELOG.md has no "## [${version}]" section; add the release notes before tagging`,
  );
  process.exit(1);
}

const afterHeading = changelog.slice(match.index + match[0].length);
const nextHeading = /^##\s+/m.exec(afterHeading);
const section = (nextHeading ? afterHeading.slice(0, nextHeading.index) : afterHeading).trim();

if (!section) {
  console.error(`release-notes: the changelog section for ${version} is empty`);
  process.exit(1);
}

const title = `SOCDOF ${version}`;
const notes = `## ${title}\n\n${section}\n`;
writeFileSync(notesPath, notes, "utf8");

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  appendFileSync(
    githubOutput,
    [
      `tag=${rawTag}`,
      `version=${version}`,
      `title=${title}`,
      `notes_file=${notesPath}`,
      `prerelease=${version.includes("-") ? "true" : "false"}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

console.log(`release-notes: ${rawTag} (${notes.length} characters) -> ${notesPath}`);
