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
}

DEFAULT_PRESET = "classic-film"


def get_preset(preset_id: str | None) -> FilterPreset:
    """プリセットIDから定義を取得する。未知/未指定なら既定プリセット。"""
    if preset_id and preset_id in PRESETS:
        return PRESETS[preset_id]
    return PRESETS[DEFAULT_PRESET]
