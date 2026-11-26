#!/usr/bin/env node
/**
 * Create the build-only Tauri config that enables signed updater artifacts.
 *
 * The public key is safe to keep in GitHub Actions. The private signing key is
 * supplied to the Tauri CLI through TAURI_SIGNING_PRIVATE_KEY and never written
 * to the repository.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pubkey = String(process.env.TAURI_UPDATER_PUBKEY || "").trim();
if (!pubkey) {
  console.error(
    "write-tauri-release-config: TAURI_UPDATER_PUBKEY is empty. Set the repository variable to the contents of the generated .key.pub file.",
  );
  process.exit(1);
}
if (pubkey.includes("BEGIN") || pubkey.includes("PRIVATE KEY")) {
  console.error(
    "write-tauri-release-config: TAURI_UPDATER_PUBKEY looks like a private key. Use only the public .key.pub value.",
  );
  process.exit(1);
}

const repository = process.env.GITHUB_REPOSITORY || "Strudelcode/SOCDOF";
const endpoint =
  process.env.TAURI_UPDATER_ENDPOINT ||
  `https://github.com/${repository}/releases/latest/download/latest.json`;

const config = {
  bundle: {
    createUpdaterArtifacts: true,
  },
  plugins: {
    updater: {
      pubkey,
      endpoints: [endpoint],
    },
  },
};

const outputPath = resolve("crates/app/src-tauri/tauri.release.conf.json");
writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`write-tauri-release-config: wrote ${outputPath}`);
