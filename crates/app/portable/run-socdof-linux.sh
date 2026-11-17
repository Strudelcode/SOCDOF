#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export SOCDOF_DATA_DIR="${SOCDOF_DATA_DIR:-$script_dir/data}"
mkdir -p "$SOCDOF_DATA_DIR"
export MALLOC_ARENA_MAX=1
export MALLOC_TRIM_THRESHOLD_=0
export MALLOC_MMAP_THRESHOLD_=131072
exec "$script_dir/socdof-ui-desktop" "$@"
