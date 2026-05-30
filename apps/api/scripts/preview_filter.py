"""フィルタープリセットのデバッグ用プレビュー生成スクリプト。

原本と各プリセット適用後を横並びにした比較画像を生成する。
presets.py を調整 → 本スクリプトを再実行 → 見た目を即確認、というループ用。

使い方:
    uv run python scripts/preview_filter.py <画像パス> [プリセットID ...]

例:
    uv run python scripts/preview_filter.py /tmp/device_original.jpg
    uv run python scripts/preview_filter.py photo.jpg classic-film
出力:
    <画像パス>.compare.jpg を生成(同じディレクトリ)。macOS なら Preview で自動表示。
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# scripts/ から実行しても app パッケージ(apps/api 直下)を解決できるようにする
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.filters.engine import apply_preset
from app.filters.presets import PRESETS, get_preset

_PANEL_HEIGHT = 900
_GAP = 24
_LABEL_H = 56
_PAD = 24
_FONT_CANDIDATES = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _load(path: Path) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def _fit(image: Image.Image, height: int = _PANEL_HEIGHT) -> Image.Image:
    width = round(image.width * height / image.height)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def _font(size: int = 32) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in _FONT_CANDIDATES:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def build_comparison(src_path: Path, preset_ids: list[str]) -> Path:
    src_bytes = src_path.read_bytes()
    panels: list[tuple[str, Image.Image, tuple[int, int, int]]] = [
        ("ORIGINAL (raw)", _fit(_load(src_path)), (230, 230, 230)),
    ]
    for pid in preset_ids:
        preset = get_preset(pid)
        out = apply_preset(data=src_bytes, preset=preset)
        panels.append((f"FILTERED ({preset['id']})", _fit(_load_bytes(out)), (255, 210, 120)))

    total_w = sum(p[1].width for p in panels) + _GAP * (len(panels) - 1) + _PAD * 2
    total_h = _PANEL_HEIGHT + _LABEL_H + _PAD * 2
    canvas = Image.new("RGB", (total_w, total_h), (28, 28, 30))
    draw = ImageDraw.Draw(canvas)
    font = _font()

    x = _PAD
    for label, panel, color in panels:
        canvas.paste(panel, (x, _LABEL_H + _PAD))
        draw.text((x, _PAD), label, fill=color, font=font)
        x += panel.width + _GAP

    out_path = src_path.with_suffix(src_path.suffix + ".compare.jpg")
    canvas.save(out_path, quality=92)
    return out_path


def _load_bytes(data: bytes) -> Image.Image:
    import io

    return _load_image(io.BytesIO(data))


def _load_image(buf: object) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(buf)).convert("RGB")  # type: ignore[arg-type]


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src_path = Path(sys.argv[1])
    if not src_path.exists():
        print(f"画像が見つかりません: {src_path}")
        sys.exit(1)
    preset_ids = sys.argv[2:] or [pid for pid in PRESETS if pid != "none"]

    out_path = build_comparison(src_path, preset_ids)
    print(f"比較画像を生成: {out_path}")
    if sys.platform == "darwin":
        subprocess.run(["open", str(out_path)], check=False)


if __name__ == "__main__":
    main()
