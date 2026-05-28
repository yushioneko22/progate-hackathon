#!/bin/sh
set -e

# マイグレーションを適用してから API を起動する。
# PORT は Render が注入する($PORT)。ローカル等で未設定なら 8787。
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8787}"
