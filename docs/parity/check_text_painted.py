#!/usr/bin/env python3
"""Prove from the pixels that the six module reference pairs are real light/dark captures.

For each of Products, POS, Calendar, Accounting, Purchases and Manual, for both editions (ts = the
reference, rust = the comparison capture):

- both images exist and are non-empty,
- light and dark differ measurably (mean absolute RGB difference in the window crop),
- the dark image is measurably darker (mean luminance of the window crop),
- the module body (the window area below the toolbar) contains text: small high-contrast connected
  components shaped like glyphs. The stored placeholder captures reach 110 such components because
  their pills outline like letters; the real references start at 208. The check therefore requires
  >= 150 for the TS references and >= 25 for the Rust empty states (32–152 measured), and requires
  the reference images to carry at least 3.5 % non-background ink.

The placeholder evidence in artifacts/parity-attempts/ must still match its SHA256SUMS manifest and
must still measure like a placeholder (<= 120 glyphs, <= 3 % ink).
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent
ATTEMPTS = ROOT.parent.parent / "artifacts" / "parity-attempts"
VIEWS = ["products", "pos", "calendar", "accounting", "purchases", "docs"]
WINDOW_BOX = (100, 15, 1240, 765)
BODY_BOX = (40, 165, 1120, 725)
MIN_DIFF = 5.0
MIN_DARKER = 5.0
MIN_INK_TS = 3.5
MIN_GLYPHS = {"ts": 150, "rust": 25}
SKELETON_MAX_GLYPHS = 120
SKELETON_MAX_INK = 3.0


def crop(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB").crop(WINDOW_BOX)


def ink(path: Path) -> float:
    array = np.asarray(crop(path))
    flat = array.reshape(-1, 3)
    colours, counts = np.unique(flat, axis=0, return_counts=True)
    background = colours[counts.argmax()]
    distance = np.abs(flat.astype(int) - background.astype(int)).max(axis=1)
    return float((distance > 40).mean() * 100)


def luminance(path: Path) -> float:
    return float(np.asarray(crop(path).convert("L")).mean())


def difference(left: Path, right: Path) -> float:
    return float(np.asarray(ImageChops.difference(crop(left), crop(right))).mean())


def body_glyphs(path: Path) -> int:
    grey = np.asarray(crop(path).convert("L"))
    left, top, right, bottom = BODY_BOX
    grey = grey[top:bottom, left:right]
    background = cv2.medianBlur(grey, 31).astype(np.int16)
    mask = (np.abs(grey.astype(np.int16) - background) > 45).astype(np.uint8)
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    glyphs = 0
    for index in range(1, count):
        _, _, width, height, area = stats[index]
        if 4 <= height <= 20 and 1 <= width <= 30 and 4 <= area <= 250:
            glyphs += 1
    return glyphs


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_attempts(problems: list[str]) -> None:
    manifest = ATTEMPTS / "SHA256SUMS"
    if not manifest.is_file():
        problems.append("missing artifacts/parity-attempts/SHA256SUMS")
        return
    for line in manifest.read_text().splitlines():
        digest, name = line.split(maxsplit=1)
        path = ATTEMPTS / name.strip()
        if not path.is_file():
            problems.append(f"missing evidence {name}")
        elif sha256(path) != digest:
            problems.append(f"evidence changed: {name}")
    for name in ("ts-products-light-1440.png", "ts-products-dark-1440.png"):
        path = ATTEMPTS / name
        if not path.is_file():
            continue
        glyphs, value = body_glyphs(path), ink(path)
        print(f"evidence {name:32s} glyphs={glyphs:4d}  ink={value:5.2f} %")
        if glyphs > SKELETON_MAX_GLYPHS or value > SKELETON_MAX_INK:
            problems.append(f"{name} no longer measures like the stored placeholder")


def main() -> int:
    problems: list[str] = []
    for view in VIEWS:
        for edition in ("ts", "rust"):
            light = ROOT / f"{edition}-{view}-light-1440.png"
            dark = ROOT / f"{edition}-{view}-dark-1440.png"
            missing = [p.name for p in (light, dark) if not p.is_file() or p.stat().st_size == 0]
            if missing:
                problems.extend(f"missing {name}" for name in missing)
                continue
            light_glyphs, dark_glyphs = body_glyphs(light), body_glyphs(dark)
            light_lum, dark_lum = luminance(light), luminance(dark)
            delta = difference(light, dark)
            light_ink = ink(light)
            print(
                f"{edition:4s} {view:11s} glyphs {light_glyphs:4d}/{dark_glyphs:4d}  "
                f"ink {light_ink:5.2f} %  lum {light_lum:6.1f}->{dark_lum:6.1f}  diff {delta:5.1f}"
            )
            need = MIN_GLYPHS[edition]
            if light_glyphs < need or dark_glyphs < need:
                problems.append(f"{view}/{edition}: module body has no painted text")
            if edition == "ts" and light_ink < MIN_INK_TS:
                problems.append(f"{view}/{edition}: no non-background ink ({light_ink:.2f} %)")
            if delta < MIN_DIFF:
                problems.append(f"{view}/{edition}: light and dark are too similar ({delta:.1f})")
            if light_lum - dark_lum < MIN_DARKER:
                problems.append(
                    f"{view}/{edition}: dark is not darker ({light_lum:.1f} vs {dark_lum:.1f})"
                )
    check_attempts(problems)
    if problems:
        for problem in problems:
            print(f"FAIL {problem}")
        return 1
    print("OK all six views: real, distinct light/dark captures with painted module text")
    return 0


if __name__ == "__main__":
    sys.exit(main())
