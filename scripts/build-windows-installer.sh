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

mkdir -p "$root/dist"
makensis \
  -DAPP_VERSION="$version" \
  -DSOURCE_DIR="$stage" \
  -DOUTPUT_FILE="$root/dist/SOCDOF-${version}-windows-x64-native-setup.exe" \
  "$root/crates/app/installer/native-windows.nsi"
rm -rf "$stage"

(cd "$root/dist" && sha256sum $(ls *.deb *.AppImage *.tar.gz *.exe 2>/dev/null) > SHA256SUMS)
echo "Built dist/SOCDOF-${version}-windows-x64-native-setup.exe"
