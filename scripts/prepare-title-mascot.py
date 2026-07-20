#!/usr/bin/env python3
"""裁去 Jiekou 抠图结果的透明留白，保留少量防截断边距。"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "test-artifacts/material-generation/2026-07-19/title-mascot-transparent-output.png"
OUTPUT = ROOT / "assets/title-mascot-jiekou-v1.png"


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError("素材没有可见像素，不能裁切")

    left, top, right, bottom = bbox
    padding = max(8, round(max(right - left, bottom - top) * 0.035))
    crop_box = (
        max(0, left - padding),
        max(0, top - padding),
        min(image.width, right + padding),
        min(image.height, bottom + padding),
    )
    image.crop(crop_box).save(OUTPUT, optimize=True)
    print(f"source={image.size} alpha_bbox={bbox} crop={crop_box} output={Image.open(OUTPUT).size}")


if __name__ == "__main__":
    main()
