#!/usr/bin/env bash
# Cross-builds the native Windows application and packages it with the NSIS
# installer script in crates/app/installer/, writing the result to dist/.
#
# Requirements (Ubuntu/Debian, no root needed if extracted to a prefix):
#   rustup target add x86_64-pc-windows-gnu
#   mingw-w64 toolchain: x86_64-w64-mingw32-gcc, x86_64-w64-mingw32-ar,
#                        x86_64-w64-mingw32-windres (gcc-mingw-w64-x86-64,
#                        binutils-mingw-w64-x86-64, mingw-w64-*-dev/common)
#   makensis (nsis package)
#   curl and unzip (to fetch WebView2Loader.dll, or set WEBVIEW2_LOADER_DLL)
#
# Point MINGW_PREFIX at the toolchain prefix when it is not on PATH.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app="$root/crates/app"
version="$(sed -n 's/^version = "\([^"]*\)"/\1/p' "$app/src-tauri/Cargo.toml" | head -n1)"
[ -n "$version" ] || { echo "cannot read the application version" >&2; exit 1; }

if [ -n "${MINGW_PREFIX:-}" ]; then
  export PATH="$MINGW_PREFIX/bin:$MINGW_PREFIX/usr/bin:$PATH"
fi
command -v x86_64-w64-mingw32-gcc >/dev/null || { echo "mingw-w64 compiler missing" >&2; exit 1; }
command -v makensis >/dev/null || { echo "makensis missing (install nsis)" >&2; exit 1; }

rustup target add x86_64-pc-windows-gnu

cd "$app"
[ -d node_modules ] || npm ci
npm run build

export CC_x86_64_pc_windows_gnu="$(command -v x86_64-w64-mingw32-gcc)"
export AR_x86_64_pc_windows_gnu="$(command -v x86_64-w64-mingw32-ar)"
export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER="$CC_x86_64_pc_windows_gnu"
cargo build --release --target x86_64-pc-windows-gnu --features custom-protocol \
  --manifest-path src-tauri/Cargo.toml

stage="$(mktemp -d)"
cp "src-tauri/target/x86_64-pc-windows-gnu/release/socdof-desktop.exe" "$stage/socdof-ui-desktop.exe"

# The executable imports WebView2Loader.dll, so it has to be installed next to it.
webview2_version="${WEBVIEW2_NUGET_VERSION:-1.0.2903.40}"
webview2_sha256="462b36fd1be6ca9f7563466a89e57c41ef4a4def3e0a84fa885d203aea4a3aaf"
webview2_dll="${WEBVIEW2_LOADER_DLL:-}"
if [ -z "$webview2_dll" ]; then
  cache="${TMPDIR:-/tmp}/socdof-webview2-$webview2_version"
  webview2_dll="$cache/build/native/x64/WebView2Loader.dll"
  if [ ! -f "$webview2_dll" ]; then
    mkdir -p "$cache"
    curl -fsSL "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$webview2_version" \
      -o "$cache/webview2.nupkg"
    unzip -q -o "$cache/webview2.nupkg" "build/native/x64/WebView2Loader.dll" -d "$cache"
  fi
fi
[ -f "$webview2_dll" ] || { echo "WebView2Loader.dll missing" >&2; exit 1; }
echo "$webview2_sha256  $webview2_dll" | sha256sum -c - >/dev/null \
  || { echo "WebView2Loader.dll checksum mismatch" >&2; exit 1; }
cp "$webview2_dll" "$stage/WebView2Loader.dll"

mkdir -p "$root/dist"
makensis \
  -DAPP_VERSION="$version" \
  -DSOURCE_DIR="$stage" \
  -DOUTPUT_FILE="$root/dist/SOCDOF-${version}-windows-x64-native-setup.exe" \
  "$root/crates/app/installer/native-windows.nsi"
rm -rf "$stage"

(cd "$root/dist" && sha256sum $(ls *.deb *.AppImage *.tar.gz *.exe 2>/dev/null) > SHA256SUMS)
echo "Built dist/SOCDOF-${version}-windows-x64-native-setup.exe"
