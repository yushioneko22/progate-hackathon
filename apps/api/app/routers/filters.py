"""フィルタープリセットを配信するエンドポイント。

サーバー側の焼き込み (Phase A) とクライアント側のリアルタイムプレビュー (Phase B) が
同じプリセット定義を共有するための「真実の源」をHTTPで公開する。
"""

from fastapi import APIRouter

from app.core.config import settings
from app.filters.presets import DEFAULT_PRESET, PRESETS

router = APIRouter(prefix="/filters", tags=["filters"])


@router.get("")
async def list_filters() -> dict[str, object]:
    """利用可能なプリセット定義と、リアルタイムプレビューの解放状況を返す。

    realtime_preview_enabled は将来の課金機能 (Phase B) のためのフラグ。
    現状は常に無効(器のみ)で、課金連携を入れる際にユーザー単位の判定に差し替える。
    """
    return {
        "presets": list(PRESETS.values()),
        "default_preset": DEFAULT_PRESET,
        "realtime_preview_enabled": settings.realtime_preview_enabled,
    }
