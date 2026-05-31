"""写真からスライドショー動画(MP4)を生成する ffmpeg ラッパー。

クロスフェード(xfade) + Ken Burns(zoompan) + BGM で、モバイルの SlideshowScreen の
見た目に寄せたスライドショーを合成する。生成ロジックはここに集約し、サービス層からは
ローカルに用意した画像/BGMのパスを渡して呼ぶ。
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path

# 既定パラメータ。モバイルの SlideshowScreen(PHOTO_MS=3500, FADE_MS=900)に合わせる。
CLIP_SEC = 3.5  # 1枚の表示秒数
FADE_SEC = 0.9  # クロスフェード秒数
FPS = 30
WIDTH = 1080  # 縦キャンバス(スマホ/SNS向き)
HEIGHT = 1920


@dataclass
class MovieSpec:
    """動画生成の入力。将来この dataclass を“編集仕様”として拡張していく。"""

    image_paths: list[Path]
    bgm_path: Path
    output_path: Path
    clip_sec: float = CLIP_SEC
    fade_sec: float = FADE_SEC
    fps: int = FPS
    width: int = WIDTH
    height: int = HEIGHT


def total_duration(n: int, clip_sec: float = CLIP_SEC, fade_sec: float = FADE_SEC) -> float:
    """写真n枚・クロスフェードあわせた動画全体の長さ(秒)。"""
    if n <= 0:
        return 0.0
    return round(n * clip_sec - (n - 1) * fade_sec, 3)


def _video_filter(spec: MovieSpec, idx: int) -> str:
    """1枚分: キャンバスをcover-cropで埋め、Ken Burns(ゆっくりズームイン)を適用する。"""
    w, h = spec.width, spec.height
    frames = round(spec.clip_sec * spec.fps)
    # 小さい画像だと zoompan がジッターするため、一旦2倍に拡大してから処理する
    return (
        f"[{idx}:v]scale={w * 2}:{h * 2}:force_original_aspect_ratio=increase,"
        f"crop={w * 2}:{h * 2},"
        f"zoompan=z='min(zoom+0.0008,1.15)':d={frames}:"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps={spec.fps},"
        f"setsar=1,format=yuv420p[v{idx}]"
    )


def build_command(spec: MovieSpec) -> list[str]:
    """MovieSpec から ffmpeg コマンドを組み立てる。"""
    n = len(spec.image_paths)
    if n == 0:
        raise ValueError("画像が1枚もありません")

    total = total_duration(n, spec.clip_sec, spec.fade_sec)

    cmd: list[str] = ["ffmpeg", "-y", "-loglevel", "error"]
    for path in spec.image_paths:
        cmd += ["-loop", "1", "-t", str(spec.clip_sec), "-i", str(path)]
    # BGM はループ入力(動画長に足りるように)。入力インデックスは n。
    cmd += ["-stream_loop", "-1", "-i", str(spec.bgm_path)]

    filters = [_video_filter(spec, i) for i in range(n)]

    # xfade を連結。最終出力ラベルは vout。
    if n == 1:
        filters.append("[v0]copy[vout]")
    else:
        prev = "v0"
        for k in range(1, n):
            offset = round(k * (spec.clip_sec - spec.fade_sec), 3)
            label = "vout" if k == n - 1 else f"x{k}"
            filters.append(
                f"[{prev}][v{k}]xfade=transition=fade:"
                f"duration={spec.fade_sec}:offset={offset}[{label}]"
            )
            prev = label

    # 音声: 動画長にトリムし、末尾1秒でフェードアウト。
    fade_out_start = round(max(total - 1.0, 0.0), 3)
    filters.append(
        f"[{n}:a]atrim=0:{total},asetpts=PTS-STARTPTS,"
        f"afade=t=out:st={fade_out_start}:d=1[aout]"
    )

    cmd += [
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-t",
        str(total),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-r",
        str(spec.fps),
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        str(spec.output_path),
    ]
    return cmd


async def render(spec: MovieSpec) -> Path:
    """ffmpeg を実行してスライドショー動画を生成し、出力パスを返す。"""
    cmd = build_command(spec)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {stderr.decode(errors='replace')[-2000:]}")
    return spec.output_path
