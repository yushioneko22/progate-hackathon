"""プリセット定義を画像バイト列に焼き込むフィルターエンジン (Pillow + numpy)。

presets.py のデータ駆動な定義を解釈して適用する。色補正は Skia ColorMatrix と
同じ 4x5 行列を使うため、将来クライアント (Skia) で同じ見た目を再現できる。
"""

from __future__ import annotations

import io

import numpy as np
from numpy.typing import NDArray
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener  # type: ignore[import-untyped]

from app.filters.presets import FilterPreset, Grain, Vignette

# iOS のカメラ画像 (HEIC/HEIF) を Pillow で開けるようにする
register_heif_opener()

# 処理コストとレスポンスを安定させるため長辺をこのサイズに収める
_MAX_EDGE = 1600
_JPEG_QUALITY = 88


def apply_preset(*, data: bytes, preset: FilterPreset) -> bytes:
    """画像バイト列にプリセットを焼き込み、JPEG バイト列を返す。"""
    image = _normalize(Image.open(io.BytesIO(data)))

    arr = np.asarray(image, dtype=np.float32) / 255.0  # HxWx3, 0..1
    arr = _apply_color_matrix(arr, preset["color_matrix"])
    arr = _apply_vignette(arr, preset["vignette"])
    arr = _apply_grain(arr, preset["grain"])

    out = Image.fromarray(np.clip(arr * 255.0, 0, 255).astype(np.uint8), mode="RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=_JPEG_QUALITY)
    return buf.getvalue()


def _normalize(image: Image.Image) -> Image.Image:
    """EXIF 回転を反映し、RGB 化して長辺を _MAX_EDGE に収める。"""
    transposed = ImageOps.exif_transpose(image)
    if transposed is not None:
        image = transposed
    if image.mode != "RGB":
        image = image.convert("RGB")
    longest = max(image.size)
    if longest > _MAX_EDGE:
        scale = _MAX_EDGE / longest
        new_size = (round(image.width * scale), round(image.height * scale))
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    return image


def _apply_color_matrix(arr: NDArray[np.float32], matrix: list[float]) -> NDArray[np.float32]:
    """Skia 互換 4x5 カラーマトリクスを RGB に適用する(アルファ行は無視)。"""
    m = np.asarray(matrix, dtype=np.float32).reshape(4, 5)
    mix = m[:3, :3]  # RGB 混色係数
    offset = m[:3, 4]  # オフセット (0..1)
    # arr @ mix.T で各画素の [R G B] に行列を掛ける
    return np.asarray(arr @ mix.T + offset, dtype=np.float32)


def _apply_vignette(arr: NDArray[np.float32], vignette: Vignette) -> NDArray[np.float32]:
    intensity = float(vignette["intensity"])
    if intensity <= 0.0:
        return arr
    radius = float(vignette["radius"])
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    # 中心からの正規化距離 (0..1, 角で約1)
    dist = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2) / np.sqrt(2.0)
    # radius を超えた分を 0..1 に正規化して減光量に変換
    falloff = np.clip((dist - radius) / max(1.0 - radius, 1e-3), 0.0, 1.0)
    mask = 1.0 - intensity * (falloff**2)
    return np.asarray(arr * mask[:, :, None], dtype=np.float32)


def _apply_grain(arr: NDArray[np.float32], grain: Grain) -> NDArray[np.float32]:
    amount = float(grain["amount"])
    if amount <= 0.0:
        return arr
    # 決定的なノイズ(再現性のため固定シード)
    rng = np.random.default_rng(42)
    noise = rng.normal(0.0, amount, size=arr.shape[:2]).astype(np.float32)
    return np.asarray(arr + noise[:, :, None], dtype=np.float32)
