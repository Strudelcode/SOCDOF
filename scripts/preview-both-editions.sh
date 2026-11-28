#!/usr/bin/env bash
# Publishes both editions on one port so they can be compared side by side:
#
#   http://<host>:3001/       Rust/egui web edition (crates/web, trunk build)
#   http://<host>:3001/ts/    TypeScript/React reference edition (SOCDOF - TS, vite build)
#
# Both are production builds. The reference keeps its `/api/languages` route through a generated
# static payload, otherwise it falls back to its hardcoded catalogue and the comparison would
# measure the wrong text.
#
# Usage: scripts/preview-both-editions.sh [both|rust-only|ts-only]
set -uo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
tree="$root/target/preview-tree"
port="${PORT:-3001}"
which="${1:-both}"

source "$HOME/.cargo/env" 2>/dev/null || true
export CARGO_BUILD_JOBS=1
# clang for wasm32: this container has no system LLVM, so the Zig wrapper provides the compiler.
if [ -f "$root/target/wasm-cc.sh" ]; then
  export CC_wasm32_unknown_unknown="$root/target/wasm-cc.sh"
  export AR_wasm32_unknown_unknown=ar
fi

mkdir -p "$tree"

if [ "$which" != "ts-only" ]; then
  echo "== trunk build (rust edition) =="
  # Trunk empties its dist folder, so it builds beside the tree and the result is copied in;
  # building straight into the tree would delete the reference edition next to it.
  ( cd "$root/crates/web" && trunk build --release --dist "$root/target/rust-dist" ) || exit 1
  rm -rf "$tree/assets" "$tree/index.html" "$tree"/*.wasm "$tree"/*.js
  cp -a "$root/target/rust-dist/." "$tree/"
fi

if [ "$which" != "rust-only" ]; then
  echo "== vite build (typescript reference) =="
  ( cd "$root/SOCDOF - TS" && npx vite build --base ./ --outDir "$tree/ts" --emptyOutDir ) || exit 1
fi

echo "== languages api shim =="
python3 - "$root" "$tree" <<'PY'
import json, os, sys

root, tree = sys.argv[1], sys.argv[2]
src = os.path.join(root, "SOCDOF - TS", "languages")
files = []
for name in sorted(os.listdir(src)):
    if not name.endswith(".json") or name.startswith(("template", "_")):
        continue
    base = name[:-5].lower()
    if base not in ("de", "en", "fr", "es"):
        continue
    with open(os.path.join(src, name), encoding="utf-8") as handle:
        parsed = json.load(handle)
    if isinstance(parsed.get("translations"), dict):
        raw, meta = parsed["translations"], parsed.get("_metadata", {})
    else:
        meta = parsed.get("_metadata", {})
        raw = parsed
    translations = {k: v for k, v in raw.items() if not k.startswith("_") and isinstance(v, str)}
    files.append({
        "filename": name,
        "id": name[:-5],
        "title": meta.get("title") or meta.get("language_name") or base,
        "language_name": meta.get("language_name") or base,
        "language_code": meta.get("language_code") or base,
        "emoji": meta.get("emoji") or meta.get("flag"),
        "flagImage": None,
        "count": len(translations),
        "lastModified": 0,
        "translations": translations,
        "isBuiltInOverride": True,
    })
os.makedirs(os.path.join(tree, "api"), exist_ok=True)
with open(os.path.join(tree, "api", "languages"), "w", encoding="utf-8") as handle:
    json.dump({"success": True, "files": files, "flags": {}, "timestamp": 0}, handle, ensure_ascii=False)
print(f"  wrote api/languages with {len(files)} packs")
PY

echo "== serving $tree on 0.0.0.0:$port =="
exec python3 "$root/scripts/preview_server.py" "$tree" "$port"
