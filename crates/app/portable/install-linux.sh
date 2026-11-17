#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
prefix=${SOCDOF_INSTALL_PREFIX:-"$HOME/.local"}
mkdir -p "$prefix/bin" "$prefix/share/applications"
install -m 0755 "$script_dir/socdof-ui-desktop" "$prefix/bin/socdof"
desktop_file="$prefix/share/applications/socdof.desktop"
printf '[Desktop Entry]\nType=Application\nName=SOCDOF\nComment=Offline-first desktop workspace\nExec="%s/bin/socdof" %%U\nTerminal=false\nCategories=Office;Finance;\nStartupNotify=true\n' "$prefix" > "$desktop_file"
chmod 0644 "$desktop_file"
printf 'SOCDOF installed for the current user.\nExecutable: %s/bin/socdof\nDesktop entry: %s\n' "$prefix" "$desktop_file"
printf 'User data is kept in the standard SOCDOF data directory and is not removed by uninstall-linux.sh.\n'
