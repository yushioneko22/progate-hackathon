import io

import numpy as np
from PIL import Image

from app.filters import engine, presets


def _sample_jpeg(width: int = 64, height: int = 48) -> bytes:
    arr = np.zeros((height, width, 3), dtype=np.uint8)
    arr[:, :, 0] = 200  # 一様な赤系の画像
    buf = io.BytesIO()
    Image.fromarray(arr, "RGB").save(buf, format="JPEG")
    return buf.getvalue()


def test_get_preset_falls_back_to_default() -> None:
    assert presets.get_preset(None)["id"] == presets.DEFAULT_PRESET
    assert presets.get_preset("does-not-exist")["id"] == presets.DEFAULT_PRESET
    assert presets.get_preset("none")["id"] == "none"


def test_apply_preset_returns_valid_jpeg() -> None:
    src = _sample_jpeg()
    out = engine.apply_preset(data=src, preset=presets.get_preset("classic-film"))
    img = Image.open(io.BytesIO(out))
    img.load()
    assert img.format == "JPEG"
    assert img.mode == "RGB"
    assert img.size == (64, 48)


def test_apply_preset_downsizes_large_images() -> None:
    src = _sample_jpeg(width=4000, height=3000)
    out = engine.apply_preset(data=src, preset=presets.get_preset("classic-film"))
    img = Image.open(io.BytesIO(out))
    assert max(img.size) == engine._MAX_EDGE


def test_classic_film_warms_neutral_gray() -> None:
    # 中間グレーがクラシックフィルムで暖色(R>B)に寄ることを確認する
    arr = np.full((32, 32, 3), 128, dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, "RGB").save(buf, format="PNG")
    out = engine.apply_preset(data=buf.getvalue(), preset=presets.get_preset("classic-film"))
    result = np.asarray(Image.open(io.BytesIO(out)).convert("RGB"))
    center = result[16, 16]
    assert int(center[0]) > int(center[2])  # R > B (暖色)


def test_none_preset_keeps_colors_roughly_neutral() -> None:
    arr = np.full((32, 32, 3), 128, dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, "RGB").save(buf, format="PNG")
    out = engine.apply_preset(data=buf.getvalue(), preset=presets.get_preset("none"))
    result = np.asarray(Image.open(io.BytesIO(out)).convert("RGB"))
    center = result[16, 16]
    assert abs(int(center[0]) - int(center[2])) <= 2  # 色被りなし
