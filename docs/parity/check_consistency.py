#!/usr/bin/env python3
"""Verify that every documented parity number agrees with the committed capture.

Everything here is read back from the repository, not from memory:

- docs/parity/diff.json must hold exactly the 11 views x 2 themes = 22 pairs, once each;
- docs/parity/diff.csv must carry one row per pair with the same numbers;
- artifacts/diff.json and artifacts/diff.csv (the copies referenced by the release
  checklist) must be byte-identical to the docs/parity files, so they cannot drift;
- every row of the "per-view" table in README.md is compared character for
  character (full pixel, window pixel, window SSIM, close-pixel share) with diff.json;
- every row of the blur table is checked for the same window SSIM value;
- CHANGELOG.md must quote each pair's "pixel/ssim theme" string exactly;
- both reference images of every pair must exist and be non-empty;
- the documented thresholds must still be the ones this script enforces, no pair
  outside the known open module screens may sit below them, and no pair claimed
  as passing may be below them.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
TARGET_PIXEL = 98.0
TARGET_SSIM = 0.90
VIEWS = {
    "dashboard",
    "invoices",
    "contacts",
    "settings",
    "command-palette",
    "products",
    "pos",
    "calendar",
    "accounting",
    "purchases",
    "docs",
}
THEMES = {"light", "dark"}
# The README tables label two screens by their user-facing name.
ALIASES = {"manual": "docs", "pos-(reference)": "pos"}
# Module screens whose Rust layout still differs from the TS markup. They were below the
# targets before this work started and stay documented as such; nothing else may be.
OPEN_BELOW_TARGET = {"purchases"}


def table_rows(text: str, header_words: tuple[str, ...]) -> list[list[str]]:
    """Return the body rows of the first Markdown table whose header holds all words."""
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if not line.startswith("|"):
            continue
        header = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not all(any(word in cell for cell in header) for word in header_words):
            continue
        rows: list[list[str]] = []
        for body in lines[index + 2 :]:
            if not body.startswith("|"):
                break
            rows.append([cell.strip() for cell in body.strip().strip("|").split("|")])
        return rows
    return []


def slug(label: str) -> str:
    key = label.lower().replace(" ", "-")
    return ALIASES.get(key, key)


def strip_bold(value: str) -> str:
    return value.replace("**", "").strip()


def main() -> int:
    problems: list[str] = []
    rows = json.loads((ROOT / "diff.json").read_text())
    readme = (ROOT / "README.md").read_text()
    changelog = (REPO / "CHANGELOG.md").read_text()

    # --- 1. the capture itself -------------------------------------------------------------
    keys = [(row["view"], row["theme"]) for row in rows]
    if len(rows) != len(VIEWS) * len(THEMES):
        problems.append(f"diff.json has {len(rows)} pairs, expected {len(VIEWS) * len(THEMES)}")
    if len(set(keys)) != len(keys):
        problems.append("diff.json repeats a view/theme pair")
    missing = {(view, theme) for view in VIEWS for theme in THEMES} - set(keys)
    if missing:
        problems.append(f"diff.json is missing pairs: {sorted(missing)}")
    by_key = {(row["view"], row["theme"]): row for row in rows}

    # --- 2. the committed artifacts copies -------------------------------------------------
    for name in ("diff.json", "diff.csv"):
        mirror = REPO / "artifacts" / name
        if not mirror.is_file():
            problems.append(f"missing committed artifact: artifacts/{name}")
        elif mirror.read_bytes() != (ROOT / name).read_bytes():
            problems.append(f"artifacts/{name} differs from docs/parity/{name}")

    with (ROOT / "diff.csv").open(newline="") as handle:
        csv_rows = list(csv.DictReader(handle))
    if len(csv_rows) != len(rows):
        problems.append(f"diff.csv has {len(csv_rows)} rows, diff.json has {len(rows)}")
    for entry in csv_rows:
        key = (entry["view"], entry["theme"])
        reference = by_key.get(key)
        if reference is None:
            problems.append(f"diff.csv has unknown pair {key}")
            continue
        for field in ("window_pixel_score", "window_ssim", "window_close_pixels_pct"):
            if f"{reference[field]:.4f}" != f"{float(entry[field]):.4f}":
                problems.append(f"diff.csv {key} {field} disagrees with diff.json")

    # --- 3. README per-view table ----------------------------------------------------------
    per_view = table_rows(readme, ("Full pixel score", "Window pixel score"))
    if len(per_view) != len(rows):
        problems.append(f"README per-view table has {len(per_view)} rows, diff.json has {len(rows)}")
    seen: set[tuple[str, str]] = set()
    for cells in per_view:
        if len(cells) != 6:
            problems.append(f"README per-view row has {len(cells)} cells: {cells}")
            continue
        view = slug(cells[0])
        theme = cells[1]
        key = (view, theme)
        reference = by_key.get(key)
        if reference is None:
            problems.append(f"README per-view row for unknown pair {key}")
            continue
        seen.add(key)
        expected = [
            f"{reference['full_pixel_score']:.2f}",
            f"{reference['window_pixel_score']:.2f}",
            f"{reference['window_ssim']:.4f}",
            f"{reference['window_close_pixels_pct']:.2f} %",
        ]
        actual = [strip_bold(cells[2]), strip_bold(cells[3]), strip_bold(cells[4]), cells[5]]
        for label, want, got in zip(
            ("full pixel", "window pixel", "window SSIM", "close pixels"), expected, actual
        ):
            if want != got:
                problems.append(f"README {key} {label}: documented {got!r}, captured {want!r}")
    if seen != set(keys):
        problems.append(f"README per-view table does not cover: {sorted(set(keys) - seen)}")

    # --- 4. README blur table --------------------------------------------------------------
    blur = table_rows(readme, ("σ=1 blur", "σ=1.5 blur"))
    for cells in blur:
        if len(cells) != 7:
            problems.append(f"README blur row has {len(cells)} cells: {cells}")
            continue
        view = slug(cells[0])
        key = (view, cells[1])
        reference = by_key.get(key)
        if reference is None:
            problems.append(f"README blur row for unknown pair {key}")
            continue
        if strip_bold(cells[2]) != f"{reference['window_ssim']:.4f}":
            problems.append(
                f"README blur {key} SSIM {strip_bold(cells[2])!r} "
                f"!= captured {reference['window_ssim']:.4f}"
            )

    # --- 5. CHANGELOG quotes the capture ---------------------------------------------------
    for row in rows:
        quoted = f"{row['view']} {row['window_pixel_score']:.2f}/{row['window_ssim']:.4f} {row['theme']}"
        if quoted not in changelog:
            problems.append(f"CHANGELOG does not quote {quoted}")

    # --- 6. images -------------------------------------------------------------------------
    for row in rows:
        for prefix in ("ts", "rust"):
            image = ROOT / f"{prefix}-{row['view']}-{row['theme']}-1440.png"
            if not image.is_file() or image.stat().st_size == 0:
                problems.append(f"missing image: {image.name}")

    # --- 7. thresholds and who is below them -----------------------------------------------
    for token in (f"≥{TARGET_PIXEL:.2f}", f"≥{TARGET_SSIM:.2f}"):
        if token not in readme:
            problems.append(f"README does not state the enforced threshold {token}")
    below = {
        row["view"]
        for row in rows
        if row["window_pixel_score"] < TARGET_PIXEL or row["window_ssim"] < TARGET_SSIM
    }
    if below - OPEN_BELOW_TARGET:
        problems.append(f"pairs below target that are not the known open screens: {sorted(below - OPEN_BELOW_TARGET)}")
    for view in sorted(OPEN_BELOW_TARGET - below):
        problems.append(f"{view} is listed as open but now meets both targets — update the docs")

    if problems:
        for problem in problems:
            print(f"FAIL {problem}")
        return 1
    passing = len(rows) - sum(1 for row in rows if row["view"] in below)
    print(
        f"OK {len(rows)} pairs ({len(VIEWS)} views x 2 themes): diff.json, diff.csv, "
        f"artifacts copies, README tables and CHANGELOG agree character for character; "
        f"{passing} pairs meet both targets, {len(below)} documented module screens are open"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
