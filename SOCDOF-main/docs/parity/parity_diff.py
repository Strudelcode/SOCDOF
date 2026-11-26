#!/usr/bin/env python3
"""Score the Rust screenshots against the TypeScript reference at 1440x900.

The score is a normalized pixel-difference score: 100 means identical RGB,
0 means maximally different. SSIM is reported separately because a pixel score
punishes the intentionally different window chrome and the bundled font.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
VIEWS = ["dashboard", "invoices", "contacts", "settings", "command-palette"]
THEMES = ["light", "dark"]
WINDOW_BOX = (100, 15, 1240, 765)


def load(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    return np.asarray(image, dtype=np.float32)


def ssim(left: np.ndarray, right: np.ndarray) -> float:
    left = cv2.cvtColor(left, cv2.COLOR_RGB2GRAY).astype(np.float64)
    right = cv2.cvtColor(right, cv2.COLOR_RGB2GRAY).astype(np.float64)
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mu_l = cv2.GaussianBlur(left, (11, 11), 1.5)
    mu_r = cv2.GaussianBlur(right, (11, 11), 1.5)
    mu_l2, mu_r2, mu_lr = mu_l * mu_l, mu_r * mu_r, mu_l * mu_r
    sigma_l = cv2.GaussianBlur(left * left, (11, 11), 1.5) - mu_l2
    sigma_r = cv2.GaussianBlur(right * right, (11, 11), 1.5) - mu_r2
    sigma_lr = cv2.GaussianBlur(left * right, (11, 11), 1.5) - mu_lr
    index = ((2 * mu_lr + c1) * (2 * sigma_lr + c2)) / (
        (mu_l2 + mu_r2 + c1) * (sigma_l + sigma_r + c2)
    )
    return float(index.mean())


def score(left: np.ndarray, right: np.ndarray) -> dict[str, float]:
    delta = np.abs(left - right)
    mae = float(delta.mean())
    per_pixel = delta.mean(axis=2)
    return {
        "pixel_score": round(100 * (1 - mae / 255), 2),
        "mae": round(mae, 2),
        "close_pixels": round(float((per_pixel <= 16).mean() * 100), 2),
        "ssim": round(ssim(left, right), 4),
    }


def main() -> None:
    rows = []
    for view in VIEWS:
        for theme in THEMES:
            ts_path = ROOT / f"ts-{view}-{theme}-1440.png"
            rust_path = ROOT / f"rust-{view}-{theme}-1440.png"
            ts, rust = load(ts_path), load(rust_path)
            if ts.shape != rust.shape:
                raise SystemExit(f"shape mismatch: {ts_path.name} {ts.shape} vs {rust_path.name} {rust.shape}")
            full = score(ts, rust)
            left, top, right, bottom = WINDOW_BOX
            window = score(ts[top:bottom, left:right], rust[top:bottom, left:right])
            rows.append({
                "view": view,
                "theme": theme,
                "full_pixel_score": full["pixel_score"],
                "full_mae": full["mae"],
                "full_close_pixels_pct": full["close_pixels"],
                "full_ssim": full["ssim"],
                "window_pixel_score": window["pixel_score"],
                "window_mae": window["mae"],
                "window_close_pixels_pct": window["close_pixels"],
                "window_ssim": window["ssim"],
            })

    (ROOT / "diff.json").write_text(json.dumps(rows, indent=2) + "\n")
    with (ROOT / "diff.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    print(f"{'view':16} {'theme':5} {'full':>7} {'window':>7} {'SSIM':>6} {'close%':>7}")
    for row in rows:
        print(
            f"{row['view']:16} {row['theme']:5} "
            f"{row['full_pixel_score']:7.2f} {row['window_pixel_score']:7.2f} "
            f"{row['window_ssim']:6.4f} {row['window_close_pixels_pct']:7.2f}"
        )


if __name__ == "__main__":
    main()
