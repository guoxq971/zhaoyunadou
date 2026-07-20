#!/usr/bin/env python3
"""Build the runtime tool-icon atlas from the reviewed Jiekou.ai result.

The source intentionally stays under test-artifacts so every generation round is
auditable.  Jiekou.ai removed the background successfully but retained captions;
this script crops only the verified icon bands and repacks them into clean cells.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT
    / "test-artifacts"
    / "material-generation"
    / "2026-07-19"
    / "icons-v4-background-removed.png"
)
OUTPUT = ROOT / "assets" / "tool-icon-atlas-jiekou-v1.png"

# Each tuple is the vertical source band containing icons but no generated label.
SOURCE_BANDS = ((0, 242), (372, 594), (710, 933))
SOURCE_CELL_WIDTH = 256
OUTPUT_CELL_SIZE = 256
ICON_MAX_SIZE = 204


def crop_visible_pixels(image: Image.Image) -> Image.Image:
    """Trim transparent padding while preserving soft alpha edge pixels."""

    alpha_box = image.getchannel("A").getbbox()
    if alpha_box is None:
        raise ValueError("Expected a visible icon in every atlas cell")
    return image.crop(alpha_box)


def build_atlas() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (1024, 1024):
        raise ValueError(f"Unexpected source size: {source.size}")

    atlas = Image.new("RGBA", (1024, OUTPUT_CELL_SIZE * 3), (0, 0, 0, 0))

    for row, (source_top, source_bottom) in enumerate(SOURCE_BANDS):
        for column in range(4):
            source_left = column * SOURCE_CELL_WIDTH
            source_right = source_left + SOURCE_CELL_WIDTH
            icon = source.crop(
                (source_left, source_top, source_right, source_bottom)
            )
            icon = crop_visible_pixels(icon)
            icon.thumbnail((ICON_MAX_SIZE, ICON_MAX_SIZE), Image.Resampling.LANCZOS)

            cell_left = column * OUTPUT_CELL_SIZE
            paste_x = cell_left + (OUTPUT_CELL_SIZE - icon.width) // 2
            paste_y = row * OUTPUT_CELL_SIZE + (OUTPUT_CELL_SIZE - icon.height) // 2
            atlas.alpha_composite(icon, (paste_x, paste_y))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT, optimize=True)
    print(f"Built {OUTPUT.relative_to(ROOT)} ({atlas.width}x{atlas.height}, RGBA)")


if __name__ == "__main__":
    build_atlas()
