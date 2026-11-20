#!/usr/bin/env python3
"""Verify that the parity numbers in README.md, CHANGELOG.md and diff.json agree.

Checks, for every view/theme pair in diff.json:
- both reference images exist in docs/parity/,
- the window pixel score and window SSIM appear with the same formatting in README.md,
- the same two numbers appear in CHANGELOG.md,
and that the ten original pairs still meet the agreed targets (>=98.00 / >=0.90).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ORIGINAL = {"dashboard", "invoices", "contacts", "settings", "command-palette"}
TARGET_PIXEL = 98.0
TARGET_SSIM = 0.90


def main() -> int:
    rows = json.loads((ROOT / "diff.json").read_text())
    readme = (ROOT / "README.md").read_text()
    changelog = (ROOT.parent.parent / "CHANGELOG.md").read_text()
    problems: list[str] = []

    for row in rows:
        view, theme = row["view"], row["theme"]
        for prefix in ("ts", "rust"):
            image = ROOT / f"{prefix}-{view}-{theme}-1440.png"
            if not image.is_file() or image.stat().st_size == 0:
                problems.append(f"missing image: {image.name}")
        pixel = f"{row['window_pixel_score']:.2f}"
        ssim = f"{row['window_ssim']:.4f}"
        if pixel not in readme or ssim not in readme:
            problems.append(f"README missing {view}/{theme} {pixel}/{ssim}")
        if pixel not in changelog or ssim not in changelog:
            problems.append(f"CHANGELOG missing {view}/{theme} {pixel}/{ssim}")
        if view in ORIGINAL and (
            row["window_pixel_score"] < TARGET_PIXEL or row["window_ssim"] < TARGET_SSIM
        ):
            problems.append(f"original pair below target: {view}/{theme}")

    if problems:
        for problem in problems:
            print(f"FAIL {problem}")
        return 1
    print(f"OK {len(rows)} pairs: images present, README and CHANGELOG match diff.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
