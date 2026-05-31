"""レトロフィルターのプリセット定義（クライアント/サーバー共通の「真実の源」）。

フィルターは「コード」ではなく「データ」として定義する。これにより:
  - サーバー (Pillow) は焼き込み (Phase A) に使う
  - クライアント (Skia) は将来リアルタイムプレビュー (Phase B) に同じ定義を使う
両者が同じ定義を読むことで、プレビューと現像結果の見た目を一致させられる。

色補正は Skia ColorMatrix 互換の 4x5 行列で表現する:
  [ rR rG rB rA rOffset
    gR gG gB gA gOffset
    bR bG bB bA bOffset
    aR aG aB aA aOffset ]
各成分・オフセットは 0..1 に正規化した色空間で扱う(写真は不透明なのでアルファ行は恒等)。
"""

from __future__ import annotations

from typing import TypedDict


class Vignette(TypedDict):
    intensity: float  # 0..1 周辺をどれだけ暗くするか
    radius: float  # 0..1 減光が始まる中心からの相対半径


class Grain(TypedDict):
    amount: float  # 0..1 粒状ノイズの強さ


class FilterPreset(TypedDict):
    id: str
    name: str
    description: str
    color_matrix: list[float]  # 長さ20 (4x5) の Skia 互換カラーマトリクス
    vignette: Vignette
    grain: Grain


# 恒等行列(無加工)。新規プリセットの土台に使う。
_IDENTITY: list[float] = [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
]


PRESETS: dict[str, FilterPreset] = {
    # 無加工。原本そのままを焼きたい場合の明示的な選択肢。
    "none": {
        "id": "none",
        "name": "オリジナル",
        "description": "フィルターなし",
        "color_matrix": _IDENTITY,
        "vignette": {"intensity": 0.0, "radius": 1.0},
        "grain": {"amount": 0.0},
    },
    # 既定のフィルム調。暖色寄り・軽い彩度上げ・周辺減光。「写ルンです」風。
    "classic-film": {
        "id": "classic-film",
        "name": "クラシックフィルム",
        "description": "暖色トーンと色あせたフィルム調(黒の持ち上げ・周辺減光・粒状)",
        # 暖色化(R強め/B落とし)に加え、オフセットで黒を持ち上げて
        # ミルキーに色あせたフィルムの質感を出す(R>G>B のオフセットで暖色フェード)。
        "color_matrix": [
            1.15, 0.00, 0.02, 0, 0.06,
            0.02, 1.05, 0.02, 0, 0.04,
            0.00, 0.05, 0.80, 0, 0.03,
            0.00, 0.00, 0.00, 1, 0.00,
        ],
        "vignette": {"intensity": 0.55, "radius": 0.6},
        "grain": {"amount": 0.085},
    },
    # モノクロフィルム。輝度変換(0.299/0.587/0.114)でグレースケール化し、
    # 強めのグレインと周辺減光で白黒フィルムの質感を出す。
    "monochrome": {
        "id": "monochrome",
        "name": "モノクロ",
        "description": "白黒フィルム調(強めの粒状とコントラスト)",
        "color_matrix": [
            0.299, 0.587, 0.114, 0, 0.03,
            0.299, 0.587, 0.114, 0, 0.03,
            0.299, 0.587, 0.114, 0, 0.04,
            0.000, 0.000, 0.000, 1, 0.00,
        ],
        "vignette": {"intensity": 0.6, "radius": 0.55},
        "grain": {"amount": 0.11},
    },
    # クールな色あせフィルム。青を持ち上げ、影に青みのオフセットを乗せて
    # 暖色のclassic-filmとは逆方向の落ち着いたトーンにする。
    "retro-cool": {
        "id": "retro-cool",
        "name": "レトロクール",
        "description": "青みがかった色あせフィルム調",
        "color_matrix": [
            0.90, 0.00, 0.05, 0, 0.02,
            0.03, 0.98, 0.03, 0, 0.04,
            0.03, 0.06, 1.12, 0, 0.07,
            0.00, 0.00, 0.00, 1, 0.00,
        ],
        "vignette": {"intensity": 0.5, "radius": 0.62},
        "grain": {"amount": 0.07},
    },
}

DEFAULT_PRESET = "classic-film"


def get_preset(preset_id: str | None) -> FilterPreset:
    """プリセットIDから定義を取得する。未知/未指定なら既定プリセット。"""
    if preset_id and preset_id in PRESETS:
        return PRESETS[preset_id]
    return PRESETS[DEFAULT_PRESET]


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _lerp_list(a: list[float], b: list[float], t: float) -> list[float]:
    return [_lerp(x, y, t) for x, y in zip(a, b, strict=True)]


def _blend_pair(a: FilterPreset, b: FilterPreset, t: float) -> tuple[list[float], Vignette, Grain]:
    """2つのプリセットのパラメータを比率 t で線形補間する(t=0 で a, t=1 で b)。"""
    color = _lerp_list(a["color_matrix"], b["color_matrix"], t)
    vignette: Vignette = {
        "intensity": _lerp(a["vignette"]["intensity"], b["vignette"]["intensity"], t),
        "radius": _lerp(a["vignette"]["radius"], b["vignette"]["radius"], t),
    }
    grain: Grain = {"amount": _lerp(a["grain"]["amount"], b["grain"]["amount"], t)}
    return color, vignette, grain


def effective_preset(
    primary_id: str | None,
    *,
    secondary_id: str | None = None,
    mix: float = 0.0,
    strength: float = 1.0,
) -> FilterPreset:
    """ブレンド済みの実効プリセットを組み立てる。

    1. 2フィルター混合: blended = primary×(1-mix) + secondary×mix
    2. 強度適用:        effective = none(無加工)×(1-strength) + blended×strength

    色行列・ビネット・グレインを線形補間するだけなので、将来クライアント(Skia)でも
    同じ計算でプレビューを一致させられる。
    """
    mix = _clamp01(mix)
    strength = _clamp01(strength)

    primary = get_preset(primary_id)
    # 2フィルター混合(secondary 指定かつ mix>0 のときのみ)
    if secondary_id and secondary_id in PRESETS and mix > 0:
        color, vignette, grain = _blend_pair(primary, PRESETS[secondary_id], mix)
        label = f"{primary['id']}+{secondary_id}@{mix:.2f}"
    else:
        color = list(primary["color_matrix"])
        vignette = dict(primary["vignette"])  # type: ignore[assignment]
        grain = dict(primary["grain"])  # type: ignore[assignment]
        label = primary["id"]

    # 強度適用(none へ向けて補間)。strength=1 なら素通り。
    if strength < 1.0:
        none = PRESETS["none"]
        color = _lerp_list(none["color_matrix"], color, strength)
        vignette = {
            "intensity": vignette["intensity"] * strength,
            "radius": _lerp(none["vignette"]["radius"], vignette["radius"], strength),
        }
        grain = {"amount": grain["amount"] * strength}
        label = f"{label}x{strength:.2f}"

    return {
        "id": label,
        "name": primary["name"],
        "description": "blended",
        "color_matrix": color,
        "vignette": vignette,
        "grain": grain,
    }
