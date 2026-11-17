#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const fail = (message) => {
  console.error(`Distribution validation failed: ${message}`);
  process.exit(1);
};
const workspace = read("Cargo.toml");
const workspacePackage = workspace.split("[workspace.package]")[1]?.split("\n[")[0] ?? "";
const workspaceVersion = workspacePackage
  .split("\n")
  .find((line) => line.trim().startsWith("version ="))
  ?.split('"')[1];
const packageVersion = JSON.parse(read("crates/app/package.json")).version;
const tauriCargoVersion = read("crates/app/src-tauri/Cargo.toml")
  .split("\n")
  .find((line) => line.trim().startsWith("version ="))
  ?.split('"')[1];
const tauriConfigVersion = JSON.parse(read("crates/app/src-tauri/tauri.conf.json")).version;
const versions = {
  "workspace Cargo.toml": workspaceVersion,
  "app package.json": packageVersion,
  "Tauri Cargo.toml": tauriCargoVersion,
  "Tauri configuration": tauriConfigVersion,
};
const uniqueVersions = [...new Set(Object.values(versions))];
if (Object.values(versions).some((version) => !version) || uniqueVersions.length !== 1) {
  fail(`application versions must match: ${JSON.stringify(versions)}`);
}
const registry = JSON.parse(read("crates/app/distribution/profiles.json"));
if (registry.schemaVersion !== 1 || registry.productName !== "SOCDOF") {
  fail("unsupported distribution registry schema or product name");
}
const requiredProfiles = [
  "native-windows",
  "native-linux",
  "native-macos",
  "tauri-windows-installer",
  "tauri-windows-portable",
  "tauri-linux",
  "tauri-macos",
  "web-wasm",
];
const ids = registry.profiles.map((profile) => profile.id);
if (new Set(ids).size !== ids.length) fail("profile ids must be unique");
for (const id of requiredProfiles) {
  if (!ids.includes(id)) fail(`required distribution profile is missing: ${id}`);
}
const validPlatforms = new Set(["windows", "linux", "macos", "web"]);
const validDataPolicies = new Set([
  "shared-user-profile",
  "portable-folder-by-default",
  "browser-origin-storage",
]);
const validUpdaters = new Set([
  "manual-installer",
  "manual-download",
  "signed-tauri-updater",
  "signed-appimage-updater",
  "web-deployment",
]);
for (const profile of registry.profiles) {
  if (!profile.id || !validPlatforms.has(profile.platform)) fail(`invalid profile identity: ${profile.id}`);
  if (!profile.runtime || !profile.installMode) fail(`profile metadata incomplete: ${profile.id}`);
  if (!validDataPolicies.has(profile.dataPolicy)) fail(`invalid data policy: ${profile.id}`);
  if (!validUpdaters.has(profile.updater)) fail(`invalid updater policy: ${profile.id}`);
  if (!Array.isArray(profile.artifacts) || profile.artifacts.length === 0) {
    fail(`profile has no artifacts: ${profile.id}`);
  }
  if (profile.platform !== "web" && profile.artifacts.some((artifact) => !artifact.includes("{version}"))) {
    fail(`desktop artifact must include the version placeholder: ${profile.id}`);
  }
}
const manifest = {
  schemaVersion: registry.schemaVersion,
  productName: registry.productName,
  version: packageVersion,
  dataContract: registry.dataContract,
  profiles: registry.profiles,
};
const writeIndex = process.argv.indexOf("--write");
if (writeIndex >= 0) {
  const destination = process.argv[writeIndex + 1];
  if (!destination) fail("--write requires an output path");
  fs.mkdirSync(path.dirname(path.resolve(destination)), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Validated ${ids.length} profiles and wrote ${destination} for SOCDOF ${packageVersion}.`);
} else {
  console.log(`SOCDOF ${packageVersion}: ${ids.length} install/deployment profiles validated.`);
}
