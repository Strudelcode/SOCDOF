#!/bin/sh
set -eu
prefix=${SOCDOF_INSTALL_PREFIX:-"$HOME/.local"}
rm -f "$prefix/bin/socdof" "$prefix/share/applications/socdof.desktop"
rmdir "$prefix/bin" "$prefix/share/applications" "$prefix/share" 2>/dev/null || true
printf 'SOCDOF application files removed. The database and backups were left untouched.\n'
