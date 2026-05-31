from app.filters import presets


def test_full_strength_single_preset_matches_base() -> None:
    eff = presets.effective_preset("classic-film", strength=1.0)
    base = presets.get_preset("classic-film")
    assert eff["color_matrix"] == base["color_matrix"]
    assert eff["vignette"]["intensity"] == base["vignette"]["intensity"]
    assert eff["grain"]["amount"] == base["grain"]["amount"]


def test_zero_strength_is_identity() -> None:
    eff = presets.effective_preset("classic-film", strength=0.0)
    assert eff["color_matrix"] == presets.PRESETS["none"]["color_matrix"]
    assert eff["vignette"]["intensity"] == 0.0
    assert eff["grain"]["amount"] == 0.0


def test_half_strength_is_between_identity_and_base() -> None:
    base = presets.get_preset("classic-film")
    eff = presets.effective_preset("classic-film", strength=0.5)
    # グレインは半分になる
    assert abs(eff["grain"]["amount"] - base["grain"]["amount"] * 0.5) < 1e-6
    # R成分(行列先頭)は identity(1.0) と base の中間
    assert 1.0 < eff["color_matrix"][0] < base["color_matrix"][0]


def test_mix_blends_two_presets() -> None:
    a = presets.get_preset("classic-film")
    b = presets.get_preset("retro-cool")
    eff = presets.effective_preset("classic-film", secondary_id="retro-cool", mix=0.5)
    mid = (a["color_matrix"][0] + b["color_matrix"][0]) / 2
    assert abs(eff["color_matrix"][0] - mid) < 1e-6


def test_mix_zero_keeps_primary() -> None:
    a = presets.get_preset("classic-film")
    eff = presets.effective_preset("classic-film", secondary_id="retro-cool", mix=0.0)
    assert eff["color_matrix"] == a["color_matrix"]


def test_params_are_clamped() -> None:
    # mix/strength が範囲外でもクラッシュせず [0,1] に丸められる
    eff = presets.effective_preset(
        "classic-film", secondary_id="retro-cool", mix=5.0, strength=-1.0
    )
    assert eff["color_matrix"] == presets.PRESETS["none"]["color_matrix"]
