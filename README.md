# progate-hackathon-1

シンプルな Todo アプリ。クライアントは **Web (Next.js)** と **モバイル (React Native / Expo)** の 2 系統、バックエンドは **FastAPI**、DB は **PostgreSQL**。バックエンドと DB は Docker Compose で一括起動できます。

## 構成

```
apps/
├── api/          FastAPI (routers → services → repositories → models の4層)
├── web/          Next.js (App Router, React 19) — ブラウザ向け
└── mobile/       React Native (Expo SDK 54) — iOS / Web プレビュー
.github/workflows/ci.yml   lint / typecheck / test / Docker build
docker-compose.yml         api + web + db を起動 (mobile はホスト側で起動)
```

> モバイルアプリ (Expo / Metro) は Docker と相性が悪いためコンテナ化していません。`db` と `api` を Docker で立ち上げ、`mobile` はホストで `pnpm dev:mobile` を実行します。

| Layer            | 役割                              | 場所                     |
| ---------------- | --------------------------------- | ------------------------ |
| `routers/`       | HTTP 入出力 (FastAPI)             | `app/routers/`           |
| `services/`      | ビジネスロジック・UoW             | `app/services/`          |
| `repositories/`  | DB アクセス (SQLAlchemy)          | `app/repositories/`      |
| `models/`        | SQLAlchemy ORM モデル             | `app/models/`            |
| `schemas/`       | Pydantic 入出力スキーマ           | `app/schemas/`           |
| `core/`          | 設定・DB接続・Base                | `app/core/`              |

---

## 1. 必要なツール

Web / API / DB の動作確認だけなら Docker があれば動きます。モバイルアプリも触る場合は Node.js + pnpm が追加で必要です。

| ツール                              | バージョン | 必須                       | 用途                                | インストール例                                                |
| ----------------------------------- | ---------- | -------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| Docker Desktop                      | 最新       | ✅ Web/API/DB に必須       | コンテナ起動                        | <https://www.docker.com/products/docker-desktop/>             |
| Git                                 | 任意       | ✅ 必須                    | クローン                            | `brew install git` など                                       |
| Node.js                             | 22+        | ✅ モバイル動作確認に必須  | Expo / pnpm                         | `brew install node@22` / nvm / volta                          |
| pnpm                                | 10         | ✅ モバイル動作確認に必須  | パッケージ管理                      | `corepack enable && corepack prepare pnpm@10.5.0 --activate`  |
| Expo Go (実機 iPhone)               | 最新       | iOS 実機で確認するなら必須 | アプリを iPhone で起動              | App Store で「Expo Go」をインストール                         |
| Xcode (Mac)                         | 最新       | iOS Simulator を使うなら   | iOS Simulator を起動                | Mac App Store                                                 |
| Python                              | 3.12       | (任意)                     | コンテナ外で api を開発する場合     | `brew install python@3.12` / pyenv                            |
| [uv](https://docs.astral.sh/uv/)    | 0.5+       | (任意)                     | 同上 (Python の依存管理)            | `curl -LsSf https://astral.sh/uv/install.sh \| sh`            |

---

## 2. クイックスタート (Docker)

### Step 1. リポジトリをクローン

```sh
git clone <このリポジトリのURL>
cd progate-hackathon-1
```

### Step 2. 環境変数ファイルを作成

```sh
cp .env.example .env
```

デフォルト値で動きます。Postgres の認証情報やポートを変えたい場合のみ編集してください。

### Step 3. Docker Desktop を起動

メニューバー (Mac) / タスクトレイ (Win) で Docker Desktop が起動済み (鯨アイコンが緑) であることを確認します。  
ターミナルでの確認:

```sh
docker info >/dev/null && echo "OK" || echo "Docker が起動していません"
```

### Step 4. ビルドして起動

```sh
docker compose up --build
```

- **初回は 5〜10 分** かかります(イメージ pull + Python/Node 依存のインストール)。
- 2回目以降はキャッシュが効いて 1 分以内で立ち上がります。
- バックグラウンド実行したい場合は `-d` を追加: `docker compose up --build -d`

以下のような行が出たら起動完了の目安です。

```
db-1   | LOG:  database system is ready to accept connections
api-1  | INFO:     Uvicorn running on http://0.0.0.0:8787
web-1  | ✓ Ready in ...
web-1  | - Local:        http://localhost:3000
```

### Step 5. サービスの状態を確認

別のターミナルで:

```sh
docker compose ps
```

3 つとも `Up` になっていれば OK。`db` は `(healthy)` 表示が付きます。

---

## 3. 動作確認手順 (他メンバー向け)

### 3-1. ブラウザで Web を開く

ブラウザで <http://localhost:3000> を開きます。次のような Todo 画面が表示されます。

- 入力欄に `牛乳を買う` などを入力 → **追加** ボタン → リストに表示される
- チェックボックスをクリック → タイトルに取り消し線が入り、薄いグレーになる
- 各行の **削除** ボタン → リストから消える
- ページをリロードしても状態が保持されている (DB に保存されている証拠)

### 3-2. API を直接叩く

Swagger UI を見るのが一番ラクです: <http://localhost:8787/docs>

CLI で叩く場合のサンプル:

```sh
# ヘルスチェック
curl -s http://localhost:8787/health
# => {"ok":true}

# 一覧 (空)
curl -s http://localhost:8787/todos
# => []

# 作成
curl -s -X POST http://localhost:8787/todos \
  -H 'content-type: application/json' \
  -d '{"title":"牛乳を買う"}'
# => {"id":"...","title":"牛乳を買う","completed":false,...}

# 完了フラグを立てる (上のレスポンスの id を使う)
ID=<上で返ってきた UUID>
curl -s -X PATCH http://localhost:8787/todos/$ID \
  -H 'content-type: application/json' \
  -d '{"completed":true}'

# 削除
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8787/todos/$ID
# => 204

# バリデーションエラー (空タイトル) → 422
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8787/todos \
  -H 'content-type: application/json' -d '{"title":""}'
```

### 3-3. DB に直接接続したい場合 (任意)

```sh
docker compose exec db psql -U todo -d todo -c "SELECT id, title, completed FROM todos;"
```

### 3-4. ホットリロードの確認

- `apps/api/app/routers/todos.py` を編集 → 保存すると `api` コンテナの uvicorn が自動再起動
- `apps/web/src/app/page.tsx` を編集 → Next.js が即座にブラウザに反映

---

## 4. モバイルアプリ (Expo) を起動する

iPhone 実機 / iOS Simulator / ブラウザ (Expo Web) の 3 通りで確認できます。**バックエンドは Docker Compose で先に起動しておいてください**(セクション 2 参照)。

### 4-1. 初回セットアップ

```sh
pnpm install   # ルートで実行。apps/mobile の依存も入る
```

### 4-2. 起動

ルートディレクトリで:

```sh
pnpm dev:mobile        # Expo dev サーバーを起動 (QR コード表示)
# またはプラットフォーム指定:
pnpm dev:mobile:ios    # iOS Simulator を直接立ち上げる
pnpm dev:mobile:web    # ブラウザで開く (http://localhost:8081)
```

ターミナルに QR コードが表示されます。

### 4-3. iOS 実機 (iPhone) で確認

1. iPhone と Mac を **同じ Wi-Fi** に接続
2. iPhone の App Store で **Expo Go** をインストール
3. **`apps/mobile/.env` を作成し、Mac の LAN IP を指定**:

   ```sh
   cp apps/mobile/.env.example apps/mobile/.env
   # Mac の LAN IP を確認 (例: 192.168.1.42)
   ipconfig getifaddr en0
   # apps/mobile/.env を編集
   # EXPO_PUBLIC_API_URL=http://192.168.1.42:8787
   ```

   > 実機からは `localhost` が iPhone 自身を指すため、Mac の LAN IP を指定する必要があります。
   > Expo dev サーバーを再起動して反映してください。

4. iPhone の **カメラ** または **Expo Go** で QR コードをスキャン → アプリが起動

### 4-4. iOS Simulator で確認 (Xcode 必要)

```sh
pnpm dev:mobile:ios
```

初回は Simulator のダウンロードに時間がかかります。`EXPO_PUBLIC_API_URL` は不要(Simulator は `localhost` でホストに到達できます)。

### 4-5. ブラウザ (Expo Web) で確認

```sh
pnpm dev:mobile:web
```

<http://localhost:8081> が開きます。Web 版 (Next.js) と見た目は違いますが、同じ API を叩いて同じ動作をします。

### 4-6. 動作確認のポイント

- タスクを追加 → リストに表示される
- チェックボックスタップ → 取り消し線
- 削除タップ → リストから消える
- アプリをリロード(`r` を Expo CLI で押す)しても状態が保持される
- 同じ DB を見ているので、Web 版で追加したタスクがモバイル版にも出る (リロード後)

---

## 5. 停止・再起動・リセット

```sh
# 一時停止 (コンテナを停止、データは保持)
docker compose stop

# 再開
docker compose start

# 完全に削除 (コンテナ・ネットワークは消えるが Postgres データは残る)
docker compose down

# DB も含めて完全クリーンアップ (Postgres のボリュームを削除)
docker compose down -v

# イメージも作り直したい場合 (依存を変えたとき等)
docker compose build --no-cache
docker compose up
```

---

## 6. トラブルシューティング

### 起動時に `port is already allocated` / `address already in use`

すでに別のプロセスがそのポートを使っています。よくあるのは `3000` (他の Next.js dev) と `5432` (ローカル Postgres)。

**何が使っているかを調べる:**

```sh
lsof -i :3000 -P -n     # macOS / Linux
lsof -i :5432 -P -n
lsof -i :8787 -P -n
```

**対処 (どちらか):**

A. 競合しているプロセスを停止する  
B. `.env` でポートを変える (例: `WEB_PORT=3001`)。ただし現状の `docker-compose.yml` は左側のホストポートを固定しているため、変更する場合は `docker-compose.yml` の `ports:` の左側もあわせて編集してください。

### `docker compose up` が `Docker daemon is not running` で失敗

Docker Desktop を起動してください。鯨アイコンが緑になってから再実行します。

### `web` だけ起動が遅い / フリーズに見える

初回起動時に `pnpm install` を **コンテナ内** で実行するため、1〜2 分かかります。`docker compose logs -f web` でログを追えます。`Ready in ...` と出たら準備完了。

### コンテナが起動直後に落ちる (`Restarting`)

```sh
docker compose logs --tail=80 <サービス名>
```

でログを見て原因を確認します。多くは `DATABASE_URL` の typo か、Postgres がまだ起動していないタイミングでの接続失敗です。後者の場合 `docker compose up` をもう一度実行すれば healthcheck 待ちで解消します。

### 「マイグレーションが当たっていない」と言われる

`api` コンテナは起動時に `alembic upgrade head` を自動実行します。失敗していないかは `docker compose logs api | grep alembic` で確認してください。手動で適用するなら:

```sh
docker compose exec api alembic upgrade head
```

### Docker を完全に初期化したい

```sh
docker compose down -v
docker compose up --build
```

これで Postgres のデータも削除され、まっさらな状態から立ち上がります。

### Expo: iPhone 実機からアプリは開けたが「API 500 / Network request failed」

`EXPO_PUBLIC_API_URL` が `localhost` のままになっている可能性が高いです。実機から `localhost` は iPhone 自身を指すため、Mac の LAN IP に書き換えて Expo dev サーバーを再起動してください (セクション 4-3 参照)。  
また iPhone と Mac が同じ Wi-Fi にいるか、Mac のファイアウォールがブロックしていないかも確認してください。

### Expo: `Unable to resolve module ...` / バンドルが壊れているように見える

```sh
pnpm --filter @app/mobile start --clear   # Metro のキャッシュをクリア
```

それでも直らない場合:

```sh
rm -rf apps/mobile/node_modules apps/mobile/.expo node_modules
pnpm install
```

### Expo Go の SDK バージョン不一致と言われる

Expo Go アプリ側のバージョンと本プロジェクトの SDK が一致している必要があります。App Store で Expo Go を最新に更新してください。

---

## 7. Docker を使わずローカルで動かす場合

開発をガッツリやりたい人向け。コンテナ内 `pnpm install` を毎回待たなくて済むので、頻繁にコードを変更するならこちらが速いです。

```sh
# DB だけ Docker で立てる
docker compose up -d db

# API (シェル A)
cd apps/api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8787

# Web (シェル B)
pnpm install
pnpm --filter @app/web dev
```

`.env` で `DATABASE_URL` がコンテナ向け (`@db:5432`) になっている場合、ホストから直接 API を起動するなら `@localhost:5432` に書き換えるか、API シェルで一時的に環境変数を上書きしてください:

```sh
DATABASE_URL=postgresql+asyncpg://todo:todo@localhost:5432/todo \
  uv run uvicorn app.main:app --reload --port 8787
```

---

## 8. テスト / lint / 型チェック

```sh
pnpm test         # API テスト (pytest, SQLite in-memory)
pnpm lint         # ruff + next lint + mobile eslint
pnpm typecheck    # mypy + tsc --noEmit (web & mobile)
```

個別実行も可:

```sh
pnpm run test:api
pnpm run lint:web
pnpm run lint:mobile
pnpm run lint:api
pnpm run typecheck:web
pnpm run typecheck:mobile
pnpm run typecheck:api
```

---

## 9. DB マイグレーション

新しいリビジョンを追加:

```sh
cd apps/api
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
```

`docker compose up` 時は API コンテナが起動時に `alembic upgrade head` を自動実行します。

---

## 10. CI

`.github/workflows/ci.yml` が 4 ジョブを並列実行します。

1. **API**: ruff / mypy / pytest
2. **Web**: next lint / tsc / next build
3. **Mobile**: eslint / tsc (Expo / RN)
4. **Docker build**: api と web の本番イメージビルド (GitHub Actions Cache 利用)

`main` へのプッシュと PR で発火します。
