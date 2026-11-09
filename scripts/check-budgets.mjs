#!/usr/bin/env node
// Phase 9 budget check: measures the artifacts this checkout actually builds.
//
// Every limit and its measurement context live in scripts/budgets.json. The script exits with 1
// when a measurable budget is exceeded, so CI and a local run fail the same way. Artifacts that
// need a display or the Tauri toolchain (installer, installed size, idle RAM/CPU) are reported as
// "not built here" instead of being guessed; the desktop and gui-smoke CI jobs run them.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const budgets = JSON.parse(readFileSync(join(root, "scripts/budgets.json"), "utf8"));
const args = process.argv.slice(2);
const overrides = new Map(
  args.filter((a) => a.startsWith("--limit=")).map((a) => a.slice(8).split("=")),
);
const only = args.find((a) => a.startsWith("--scope="))?.slice(8);
const limit = (key, fallback) => Number(overrides.get(key) ?? fallback);
const failures = [];
const rows = [];

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile());
}

function measure(label, bytes, cap, unit) {
  const ok = bytes <= cap;
  rows.push({ label, value: bytes, cap, unit, ok });
  if (!ok) failures.push(`${label}: ${bytes} ${unit} > ${cap} ${unit}`);
}

function bundle(name, dir, rawKey, gzipKey) {
  const entries = files(dir);
  if (!entries.length) {
    rows.push({ label: name, value: "not built here", cap: "", unit: "", ok: true });
    return;
  }
  const raw = entries.reduce((sum, file) => sum + statSync(file).size, 0);
  const gz = entries.reduce((sum, file) => sum + gzipSync(readFileSync(file), { level: 9 }).length, 0);
  measure(`${name} raw`, raw, limit(`${rawKey}`, budgets[rawKey === "raw_bytes" ? "ui_bundle" : "web_bundle"][rawKey]), "bytes");
  measure(`${name} gzip`, gz, limit(`${gzipKey}`, budgets[rawKey === "raw_bytes" ? "ui_bundle" : "web_bundle"][gzipKey]), "bytes");
}

function coldStart() {
  const budget = budgets.cold_start;
  const binary = join(root, "target/release/socdof-app");
  if (!existsSync(binary)) {
    rows.push({ label: "cold start", value: "not built here", cap: "", unit: "", ok: true });
    return;
  }
  const times = [];
  for (let run = 0; run < budget.runs; run += 1) {
    const database = join(tmpdir(), `socdof-budget-${process.pid}-${run}.db`);
    rmSync(database, { force: true });
    const started = process.hrtime.bigint();
    const output = execFileSync(binary, ["--database", database], { encoding: "utf8" });
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    if (!output.includes("SOCDOF shell ready")) throw new Error("cold start did not reach the ready marker");
    times.push(elapsed);
    rmSync(database, { force: true });
  }
  times.sort((a, b) => a - b);
  const median = Math.round(times[Math.floor(times.length / 2)]);
  measure("cold start (median)", median, limit("cold_start_ms", budget.median_ms), "ms");
}

if (!only || only === "bundles") {
  bundle("ui bundle", join(root, budgets.ui_bundle.path), "raw_bytes", "gzip_bytes");
  bundle("web bundle", join(root, budgets.web_bundle.path), "wasm_raw_bytes", "wasm_gzip_bytes");
}
if (!only || only === "cold_start") coldStart();
for (const name of ["installer", "installed", "idle_ram", "idle_cpu"]) {
  rows.push({ label: name, value: "not built here (CI desktop/gui-smoke job)", cap: "", unit: "", ok: true });
}
rows.push({ label: "large dataset (50k/100k frames)", value: "open, see docs/performance.md", cap: "", unit: "", ok: true });

for (const row of rows) {
  console.log(`${row.ok ? "ok  " : "FAIL"} ${row.label.padEnd(30)} ${String(row.value).padStart(12)}${row.unit && row.cap ? ` / ${row.cap} ${row.unit}` : ""}`);
}
if (failures.length) {
  console.error(`\n${failures.length} budget(s) exceeded:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nall measurable budgets within limits");
