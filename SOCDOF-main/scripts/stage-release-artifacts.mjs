#!/usr/bin/env node
/**
 * Normalise the platform bundles produced by `tauri build` into the asset
 * names consumed by the GitHub release and the updater manifest.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) {
    console.error(`stage-release-artifacts: missing --${name}`);
    process.exit(1);
  }
  return process.argv[index + 1];
}

const platform = argument("platform");
const version = argument("version");
const bundleDir = resolve(argument("bundle-dir"));
const outputDir = resolve(argument("output-dir") || "artifacts");

function walk(directory) {
  const entries = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walk(path));
    } else if (entry.isFile()) {
      entries.push(path);
    }
  }
  return entries;
}

let files;
try {
  files = walk(bundleDir);
} catch (error) {
  console.error(`stage-release-artifacts: cannot read ${bundleDir}: ${error.message}`);
  process.exit(1);
}

function newest(suffix) {
  return files
    .filter((file) => file.endsWith(suffix))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function requireFile(suffix, label) {
  const file = newest(suffix);
  if (!file) {
    console.error(
      `stage-release-artifacts: no ${label} (${suffix}) in ${bundleDir}\n` +
        files.map((entry) => `  ${entry}`).join("\n"),
    );
    process.exit(1);
  }
  return file;
}

function copyBundle(source, targetName) {
  const target = join(outputDir, targetName);
  copyFileSync(source, target);
  const bytes = statSync(target).size;
  if (bytes < 1000) {
    console.error(`stage-release-artifacts: ${targetName} is implausibly small (${bytes} bytes)`);
    process.exit(1);
  }
  return target;
}

function copyWithSignature(source, targetName) {
  const target = copyBundle(source, targetName);
  const signature = `${source}.sig`;
  const signatureTarget = join(outputDir, `${targetName}.sig`);
  try {
    copyFileSync(signature, signatureTarget);
  } catch (error) {
    console.error(`stage-release-artifacts: missing signature ${signature}: ${error.message}`);
    process.exit(1);
  }
  if (statSync(signatureTarget).size === 0) {
    console.error(`stage-release-artifacts: empty signature ${signatureTarget}`);
    process.exit(1);
  }
  return target;
}

mkdirSync(outputDir, { recursive: true });
const staged = [];

if (platform === "linux") {
  const appImage = requireFile(".AppImage", "AppImage");
  const deb = requireFile(".deb", "Debian package");
  staged.push(copyWithSignature(appImage, `SOCDOF-${version}-linux-x86_64.AppImage`));
  staged.push(copyBundle(deb, `SOCDOF-${version}-linux-amd64.deb`));
} else if (platform === "windows") {
  const setup = files
    .filter((file) => /-setup\.exe$/.test(file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!setup) {
    console.error(`stage-release-artifacts: no NSIS setup executable in ${bundleDir}`);
    process.exit(1);
  }
  staged.push(copyWithSignature(setup, `SOCDOF-${version}-windows-x64-setup.exe`));

  const msi = newest(".msi");
  if (msi) {
    staged.push(copyBundle(msi, `SOCDOF-${version}-windows-x64.msi`));
  }
} else if (platform === "macos") {
  const dmg = requireFile(".dmg", "DMG");
  const appArchive = requireFile(".app.tar.gz", "macOS updater archive");
  staged.push(copyBundle(dmg, `SOCDOF-${version}-macos-universal.dmg`));
  staged.push(copyWithSignature(appArchive, `SOCDOF-${version}-macos-universal.app.tar.gz`));
} else {
  console.error(`stage-release-artifacts: unsupported platform "${platform}"`);
  process.exit(1);
}

const checksums = staged
  .sort()
  .map((file) => {
    const name = file.split(/[\\/]/).pop();
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
    return `${hash}  ${name}`;
  })
  .join("\n");
writeFileSync(join(outputDir, `SHA256SUMS-${platform}.txt`), `${checksums}\n`, "utf8");

console.log(`stage-release-artifacts: staged ${staged.length} files for ${platform} ${version}`);
for (const file of staged) {
  console.log(`  ${file}`);
}
