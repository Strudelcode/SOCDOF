#!/usr/bin/env node
/**
 * Build the Tauri updater manifest from the signed release assets.
 *
 * Linux uses the AppImage updater bundle, Windows uses the NSIS setup, and the
 * macOS universal archive serves both Apple Silicon and Intel clients.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) {
    console.error(`generate-updater-manifest: missing --${name}`);
    process.exit(1);
  }
  return process.argv[index + 1];
}

const version = argument("version").replace(/^v/, "");
const tag = argument("tag");
const assetsDir = resolve(argument("assets-dir") || "artifacts");
const notesFile = resolve(argument("notes-file"));
const outputFile = resolve(argument("output") || "latest.json");
const repository = process.env.GITHUB_REPOSITORY || "Strudelcode/SOCDOF";
const baseUrl = `https://github.com/${repository}/releases/download/${tag}/`;

function asset(name) {
  const path = join(assetsDir, name);
  let signature;
  try {
    signature = readFileSync(`${path}.sig`, "utf8").trim();
  } catch (error) {
    console.error(`generate-updater-manifest: missing signature for ${name}: ${error.message}`);
    process.exit(1);
  }
  if (!signature) {
    console.error(`generate-updater-manifest: empty signature for ${name}`);
    process.exit(1);
  }
  try {
    readFileSync(path);
  } catch (error) {
    console.error(`generate-updater-manifest: missing asset ${name}: ${error.message}`);
    process.exit(1);
  }
  return {
    url: `${baseUrl}${encodeURIComponent(name)}`,
    signature,
  };
}

const notes = readFileSync(notesFile, "utf8").trim();
const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "linux-x86_64": asset(`SOCDOF-${version}-linux-x86_64.AppImage`),
    "windows-x86_64": asset(`SOCDOF-${version}-windows-x64-setup.exe`),
    "darwin-aarch64": asset(`SOCDOF-${version}-macos-universal.app.tar.gz`),
    "darwin-x86_64": asset(`SOCDOF-${version}-macos-universal.app.tar.gz`),
  },
};

writeFileSync(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`generate-updater-manifest: wrote ${outputFile} for ${version}`);
