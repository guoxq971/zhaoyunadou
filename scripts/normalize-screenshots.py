#!/usr/bin/env python3
"""把 Chrome 返回但扩展名为 .png 的 JPEG 证据统一转成真实 PNG。"""

import argparse
from pathlib import Path
from typing import Optional

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT_ROOT = ROOT / "test-artifacts/screenshots"


def resolve_screenshot_dir(value: Optional[str]) -> Path:
    """允许传日期、相对目录或绝对目录；未传时处理最新一批截图。"""
    if value:
        candidate = Path(value)
        if candidate.is_absolute():
            return candidate
        dated = SCREENSHOT_ROOT / value
        return dated if dated.is_dir() else ROOT / candidate

    dated_dirs = sorted(path for path in SCREENSHOT_ROOT.iterdir() if path.is_dir())
    if not dated_dirs:
        raise FileNotFoundError(f"没有截图目录: {SCREENSHOT_ROOT}")
    return dated_dirs[-1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", nargs="?", help="日期（如 2026-07-20）或截图目录")
    args = parser.parse_args()
    screenshot_dir = resolve_screenshot_dir(args.directory)

    converted = 0
    for path in sorted(screenshot_dir.glob("*.png")):
        with Image.open(path) as image:
            if image.format == "PNG":
                continue
            normalized = image.convert("RGB")
        normalized.save(path, format="PNG", optimize=True)
        converted += 1
        print(f"converted {path.name}")
    print(f"screenshot_dir={screenshot_dir}")
    print(f"converted_total={converted}")


if __name__ == "__main__":
    main()
