#!/usr/bin/env python3
"""Build Scout's modern macOS-style PNG and ICNS app icons."""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


CANVAS_SIZE = 1024
TILE_SIZE = 832
TILE_ORIGIN = (CANVAS_SIZE - TILE_SIZE) // 2
TILE_RADIUS = 184
SUPERSAMPLE = 4
MARK_MAX_SIZE = 716
BACKGROUND_THRESHOLD = 60

ICONSET_SIZES = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}


def rounded_tile_mask() -> Image.Image:
    large_size = TILE_SIZE * SUPERSAMPLE
    mask = Image.new("L", (large_size, large_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, large_size - 1, large_size - 1),
        radius=TILE_RADIUS * SUPERSAMPLE,
        fill=255,
    )
    return mask.resize((TILE_SIZE, TILE_SIZE), Image.Resampling.LANCZOS)


def tile_background() -> Image.Image:
    """Create the restrained warm tile used behind the supplied mark."""
    top = (253, 238, 209, 255)
    bottom = (249, 220, 176, 255)
    background = Image.new("RGBA", (TILE_SIZE, TILE_SIZE))
    draw = ImageDraw.Draw(background)
    for y in range(TILE_SIZE):
        amount = y / (TILE_SIZE - 1)
        color = tuple(
            round(start + (end - start) * amount)
            for start, end in zip(top, bottom, strict=True)
        )
        draw.line((0, y, TILE_SIZE, y), fill=color)

    highlight = Image.new("L", background.size, 0)
    ImageDraw.Draw(highlight).ellipse(
        (-80, -180, TILE_SIZE + 80, TILE_SIZE // 2 + 180), fill=34
    )
    highlight = highlight.filter(ImageFilter.GaussianBlur(120))
    glow = Image.new("RGBA", background.size, (255, 250, 232, 0))
    glow.putalpha(highlight)
    background.alpha_composite(glow)
    return background


def extract_mark(source: Image.Image) -> Image.Image:
    """Remove only source-canvas pixels connected to the image boundary."""
    rgb = source.convert("RGB")
    keyed = rgb.copy()
    marker = (255, 0, 255)
    seeds: list[tuple[int, int]] = []
    for x in range(0, rgb.width, 16):
        seeds.extend(((x, 0), (x, rgb.height - 1)))
    for y in range(0, rgb.height, 16):
        seeds.extend(((0, y), (rgb.width - 1, y)))
    for seed in seeds:
        if keyed.getpixel(seed) != marker:
            ImageDraw.floodfill(
                keyed, seed, marker, thresh=BACKGROUND_THRESHOLD
            )

    alpha = Image.new("L", rgb.size)
    alpha.putdata(
        [
            0 if pixel == marker else 255
            for pixel in keyed.get_flattened_data()
        ]
    )
    alpha = (
        alpha.filter(ImageFilter.MinFilter(7))
        .filter(ImageFilter.MaxFilter(7))
        .filter(ImageFilter.GaussianBlur(1.5))
    )
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("could not isolate the logo mark from its background")

    mark = source.convert("RGBA")
    mark.putalpha(alpha)
    mark = mark.crop(bounds)
    scale = min(MARK_MAX_SIZE / mark.width, MARK_MAX_SIZE / mark.height)
    size = tuple(
        max(2, (round(dimension * scale) // 2) * 2)
        for dimension in (mark.width, mark.height)
    )
    return mark.resize(size, Image.Resampling.LANCZOS)


def render_icon(source_path: Path) -> Image.Image:
    with Image.open(source_path) as source_file:
        source = ImageOps.exif_transpose(source_file).convert("RGBA")

    tile = tile_background()
    mark = extract_mark(source)
    # Center from the extracted alpha bounds, not the source canvas. Generated
    # artwork often contains uneven whitespace that would otherwise bias it.
    mark_origin = (
        (TILE_SIZE - mark.width) // 2,
        (TILE_SIZE - mark.height) // 2,
    )
    tile.alpha_composite(mark, mark_origin)
    tile_mask = rounded_tile_mask()
    tile.putalpha(tile_mask)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))

    # Keep the outer shadow centered as well; the source artwork already
    # contains its own directional material shadows.
    shadow_mask = Image.new("L", canvas.size, 0)
    shadow_mask.paste(tile_mask, (TILE_ORIGIN, TILE_ORIGIN))
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(20))
    shadow_mask = shadow_mask.point(lambda alpha: round(alpha * 0.28))
    shadow = Image.new("RGBA", canvas.size, (55, 37, 17, 0))
    shadow.putalpha(shadow_mask)
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(tile, (TILE_ORIGIN, TILE_ORIGIN))
    return canvas


def write_iconset(icon: Image.Image, destination: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="scout-icon-") as temporary:
        iconset = Path(temporary) / "Scout.iconset"
        iconset.mkdir()
        for filename, size in ICONSET_SIZES.items():
            resized = icon.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(iconset / filename, format="PNG", optimize=True)
        subprocess.run(
            ["iconutil", "--convert", "icns", "--output", destination, iconset],
            check=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="source artwork")
    args = parser.parse_args()

    if not args.source.is_file():
        parser.error(f"source image does not exist: {args.source}")

    assets = Path(__file__).resolve().parents[1] / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    icon = render_icon(args.source)
    icon.save(assets / "icon.png", format="PNG", optimize=True)
    write_iconset(icon, assets / "icon.icns")


if __name__ == "__main__":
    main()
