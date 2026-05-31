from pathlib import Path

from app.movie import builder


def test_total_duration() -> None:
    # n枚 * CLIP - (n-1)*FADE
    assert builder.total_duration(0) == 0.0
    assert builder.total_duration(1) == builder.CLIP_SEC
    # 4枚, CLIP=3.5, FADE=0.9 -> 14 - 2.7 = 11.3
    assert builder.total_duration(4) == 11.3


def _spec(n: int) -> builder.MovieSpec:
    return builder.MovieSpec(
        image_paths=[Path(f"/tmp/p{i}.jpg") for i in range(n)],
        bgm_path=Path("/tmp/bgm.mp3"),
        output_path=Path("/tmp/out.mp4"),
    )


def test_build_command_multi() -> None:
    cmd = builder.build_command(_spec(3))
    joined = " ".join(cmd)
    assert cmd[0] == "ffmpeg"
    # 各写真の入力 + BGMのループ入力
    assert joined.count("-loop 1") == 3
    assert "-stream_loop -1" in joined
    # xfade が (n-1) 回、最終ラベルは vout
    assert joined.count("xfade=") == 2
    assert "[vout]" in joined
    assert "-movflags +faststart" in joined


def test_build_command_single_photo_has_no_xfade() -> None:
    cmd = builder.build_command(_spec(1))
    joined = " ".join(cmd)
    assert "xfade=" not in joined
    assert "[vout]" in joined


def test_build_command_rejects_empty() -> None:
    try:
        builder.build_command(_spec(0))
    except ValueError:
        return
    raise AssertionError("空の画像リストで ValueError が出るべき")
