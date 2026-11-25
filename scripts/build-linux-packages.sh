#!/usr/bin/env bash
# Builds every Linux deliverable and collects it in dist/ together with checksums.
#
#   dist/SOCDOF-<version>-linux-amd64.deb
#   dist/SOCDOF-<version>-linux-x86_64.AppImage
#   dist/SOCDOF-<version>-linux-x86_64-native.tar.gz   (portable, keeps its own data/)
#   dist/windows-installer/                            (NSIS script, assets, CI notes)
#   dist/SHA256SUMS
#
# Works on a normal Ubuntu/Debian host. In restricted environments it adapts:
# very large numeric UIDs (which do not fit the 6-byte ar header) are handled
# with `unshare -r`, and AppImage tooling runs extracted when FUSE is missing.
set -euo pipefail

# Restricted build hosts keep their toolchain and WebKit libraries outside the
# system prefix; pick that up when it exists (a normal host needs none of this).
if [ -f "$HOME/sysroot/env.sh" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
  # shellcheck disable=SC1091
  . "$HOME/sysroot/env.sh"
  # linuxdeploy's GTK plugin resolves pkg-config, cache and copy paths relative to
  # this directory; without it the AppImage step aborts.
  export LD_GTK_LIBRARY_PATH="$HOME/sysroot/usr/lib/x86_64-linux-gnu"
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app="$root/crates/app"
bundle="$app/src-tauri/target/release/bundle"
version="$(sed -n 's/^version = "\([^"]*\)"/\1/p' "$app/src-tauri/Cargo.toml" | head -n1)"
[ -n "$version" ] || { echo "cannot read the application version" >&2; exit 1; }

cd "$app"
[ -d node_modules ] || npm ci
export APPIMAGE_EXTRACT_AND_RUN=1

build() {
  if [ "$(id -u)" -gt 999999 ]; then
    unshare -r "$@"
  else
    "$@"
  fi
}
build ./node_modules/.bin/tauri build

# linuxdeploy collects libraries but not WebKit's helper processes. Without them
# the AppImage cannot spawn WebKitNetworkProcess and exits on startup.
appdir="$bundle/appimage/SOCDOF.AppDir"
helpers=""
for candidate in \
  "$(dirname "$(ldconfig -p 2>/dev/null | awk '/libwebkit2gtk-4\.1\.so\.0/{print $NF; exit}' || true)")/webkit2gtk-4.1" \
  $HOME/sysroot/usr/lib/*/webkit2gtk-4.1 \
  /usr/lib/*/webkit2gtk-4.1; do
  if [ -d "$candidate" ]; then helpers="$candidate"; break; fi
done
if [ -d "$helpers" ] && [ ! -d "$appdir/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1" ]; then
  mkdir -p "$appdir/usr/lib/x86_64-linux-gnu"
  cp -a "$helpers" "$appdir/usr/lib/x86_64-linux-gnu/"
  printf '%s\n' 'export WEBKIT_EXEC_PATH="$APPDIR/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1"' \
    > "$appdir/apprun-hooks/90-socdof-webkit.sh"
  sed -i 's|^source "$this_dir"/apprun-hooks/"linuxdeploy-plugin-gtk.sh"$|&\nsource "$this_dir"/apprun-hooks/"90-socdof-webkit.sh"|' "$appdir/AppRun"
  packer="$(ls "${XDG_CACHE_HOME:-$HOME/.cache}"/tauri/linuxdeploy-plugin-appimage*.AppImage 2>/dev/null | head -n1)"
  [ -n "$packer" ] || { echo "AppImage packer (linuxdeploy-plugin-appimage) not found" >&2; exit 1; }
  ARCH=x86_64 LINUXDEPLOY_OUTPUT_VERSION="$version" "$packer" --appdir="$appdir"
  rm -f "$bundle/appimage/SOCDOF_${version}_amd64.AppImage"
  mv "$app/SOCDOF-${version}-x86_64.AppImage" "$bundle/appimage/SOCDOF_${version}_amd64.AppImage"
fi

# Portable archive: the same layout the release workflow ships.
name="SOCDOF-${version}-linux-x86_64-native"
stage="$(mktemp -d)"
mkdir -p "$stage/$name"
cp "$app/src-tauri/target/release/socdof-desktop" "$stage/$name/socdof-ui-desktop"
cp "$app/portable/run-socdof-linux.sh" "$stage/$name/run-socdof.sh"
cp "$app/portable/install-linux.sh" "$app/portable/uninstall-linux.sh" "$stage/$name/"
cp "$app/portable/README-LINUX.txt" "$stage/$name/README.txt"
chmod +x "$stage/$name/socdof-ui-desktop" "$stage/$name"/*.sh
mkdir -p "$bundle/portable"
tar -czf "$bundle/portable/$name.tar.gz" -C "$stage" "$name"
rm -rf "$stage"

dist="$root/dist"
mkdir -p "$dist"
rm -rf "$dist/windows-installer"
cp "$bundle/deb/SOCDOF_${version}_amd64.deb" "$dist/SOCDOF-${version}-linux-amd64.deb"
cp "$bundle/appimage/SOCDOF_${version}_amd64.AppImage" "$dist/SOCDOF-${version}-linux-x86_64.AppImage"
cp "$bundle/portable/$name.tar.gz" "$dist/"
cp -a "$app/installer" "$dist/windows-installer"
chmod -R a+rX "$dist/windows-installer"
(cd "$dist" && sha256sum $(ls *.deb *.AppImage *.tar.gz *.exe 2>/dev/null) > SHA256SUMS)

cat <<EOF
Built SOCDOF $version

  dist/SOCDOF-${version}-linux-amd64.deb
  dist/SOCDOF-${version}-linux-x86_64.AppImage
  dist/SOCDOF-${version}-linux-x86_64-native.tar.gz
  dist/windows-installer/  (build with .github/workflows/native-windows-installer.yml)
  dist/SHA256SUMS
EOF
