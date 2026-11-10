#!/usr/bin/env node
// Phase 9 budget check: measures the artifacts this checkout actually builds.
//
// Every limit and its measurement context live in scripts/budgets.json. The script exits with 1
// when a measurable budget is exceeded, so CI and a local run fail the same way. Artifacts that
// need a display or the Tauri toolchain (installer, installed size, idle RAM/CPU) are reported as
// "not built here" instead of being guessed; the desktop and gui-smoke CI jobs run them.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
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

function installerBudgets() {
  const dir = join(root, "crates/app/src-tauri/target/release/bundle");
  const artifacts = files(dir).filter((file) => /\.(AppImage|deb|msi|exe|dmg)$/i.test(file));
  if (!artifacts.length) {
    rows.push({ label: "installer", value: "not built here (needs Tauri + GTK/WebKit)", cap: "", unit: "", ok: true });
    rows.push({ label: "installed", value: "not built here (needs Tauri + GTK/WebKit)", cap: "", unit: "", ok: true });
    return;
  }
  const largest = artifacts
    .map((file) => ({ file, bytes: statSync(file).size }))
    .sort((a, b) => b.bytes - a.bytes)[0];
  measure(`installer ${basename(largest.file)}`, largest.bytes, limit("installer_bytes", budgets.installer.max_bytes), "bytes");

  const target = join(tmpdir(), `socdof-installed-${process.pid}`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  try {
    if (largest.file.endsWith(".deb")) {
      execFileSync("dpkg-deb", ["-x", largest.file, target]);
    } else if (largest.file.endsWith(".AppImage")) {
      execFileSync("chmod", ["+x", largest.file]);
      execFileSync(largest.file, ["--appimage-extract"], { cwd: target });
    }
    const bytes = files(target).reduce((sum, file) => sum + statSync(file).size, 0);
    if (bytes > 0) measure("installed", bytes, limit("installed_bytes", budgets.installed.max_bytes), "bytes");
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
}

function runtimeBudgets() {
  const index = args.indexOf("--pid");
  const pid = index >= 0 ? Number(args[index + 1]) : 0;
  if (!pid || !existsSync(`/proc/${pid}/status`)) {
    rows.push({ label: "idle ram/cpu", value: "no --pid given (CI gui-smoke samples the app)", cap: "", unit: "", ok: true });
    return;
  }
  const rss = Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, "utf8"))?.[1] ?? 0);
  const ticks = () => {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8").split(" ");
    return Number(stat[13]) + Number(stat[14]);
  };
  const before = ticks();
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
  const percent = ((ticks() - before) / 100 / 5) * 100;
  measure("idle ram", rss, limit("idle_ram_kib", budgets.idle_ram.max_kib), "KiB");
  measure("idle cpu", Number(percent.toFixed(2)), limit("idle_cpu_percent", budgets.idle_cpu.max_percent), "%");
}

if (!only || only === "bundles") {
  bundle("ui bundle", join(root, budgets.ui_bundle.path), "raw_bytes", "gzip_bytes");
  bundle("web bundle", join(root, budgets.web_bundle.path), "wasm_raw_bytes", "wasm_gzip_bytes");
}
if (!only || only === "cold_start") coldStart();
if (!only || only === "artifacts") installerBudgets();
if (!only || only === "runtime") runtimeBudgets();
if (!only || only === "bundles") {
  rows.push({ label: "large dataset (50k/100k frames)", value: "cargo test -p socdof-ui --test performance", cap: "", unit: "", ok: true });
}

for (const row of rows) {
  console.log(`${row.ok ? "ok  " : "FAIL"} ${row.label.padEnd(30)} ${String(row.value).padStart(12)}${row.unit && row.cap ? ` / ${row.cap} ${row.unit}` : ""}`);
}
if (failures.length) {
  console.error(`\n${failures.length} budget(s) exceeded:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nall measurable budgets within limits");
