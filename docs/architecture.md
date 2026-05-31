# 変ルンです (Kawarun Desu) — アーキテクチャ図

タイムロック型の写真アルバムアプリ。指定した「公開日」まで写真を見られず、レトロフィルターやスライドショー動画生成を備える。

---

## 1. システム全体構成

```mermaid
graph TB
    subgraph Clients["クライアント"]
        Mobile["📱 Mobile App<br/>(Expo SDK 54 / RN 0.81)<br/>apps/mobile"]
        Web["🌐 Web App<br/>(Next.js 15 / React 19)<br/>apps/web"]
    end

    subgraph Backend["バックエンド (apps/api)"]
        API["⚡ FastAPI (Python 3.12)<br/>Uvicorn / SQLAlchemy 2.0 async"]
        BG["🎬 Background Tasks<br/>動画生成 (ffmpeg)"]
        API -.->|add_task| BG
    end

    subgraph External["外部サービス"]
        Google["🔑 Google OAuth<br/>(id_token 検証)"]
        Supabase["🗄️ Supabase Storage<br/>(S3互換 / photos バケット)"]
    end

    DB[("🐘 PostgreSQL 16<br/>asyncpg")]

    Mobile -->|REST + Bearer JWT| API
    Web -->|REST + Bearer JWT| API
    Mobile -.->|OAuth| Google
    Web -.->|OAuth| Google
    API -->|id_token 検証| Google
    API <-->|ORM| DB
    API <-->|画像/動画 upload・download| Supabase
    BG --> Supabase
    BG --> DB

    Clients -.->|画像/動画 public URL 参照| Supabase
```

---

## 2. バックエンド レイヤー構成 (4層)

```mermaid
graph LR
    subgraph api["apps/api/app"]
        R["routers/<br/>HTTPエンドポイント"]
        SC["schemas/<br/>Pydantic I/O"]
        SV["services/<br/>ビジネスロジック / UoW"]
        RP["repositories/<br/>DBアクセス"]
        MD["models/<br/>ORMエンティティ"]
        CO["core/<br/>config・db・auth・jwt<br/>security・storage"]
    end

    R --> SC
    R --> SV
    SV --> RP
    RP --> MD
    R --> CO
    SV --> CO
    RP --> CO
```

| 主要ルーター | 役割 | 認証 |
|---|---|---|
| `/health` | ヘルスチェック | 不要 |
| `/auth/{register,login,google}` | ユーザー認証・JWT発行 | 不要 |
| `/albums` | アルバムCRUD | 必要 |
| `/albums/{id}/photos` | 写真一覧・アップロード | 必要 |
| `/albums/{id}/movie` | スライドショー動画生成 (202非同期) | 必要 |
| `/filters` | フィルタープリセット一覧 | — |

---

## 3. 認証フロー (Google OAuth + JWT) — `feat/google-login-jwt`

```mermaid
sequenceDiagram
    participant C as クライアント<br/>(Mobile/Web)
    participant G as Google OAuth
    participant API as FastAPI AuthService
    participant DB as PostgreSQL

    Note over C,G: ① Google ログイン
    C->>G: expo-auth-session / OAuth
    G-->>C: id_token

    Note over C,API: ② バックエンド検証
    C->>API: POST /auth/google { id_token }
    API->>G: verify_oauth2_token() 署名・aud検証
    G-->>API: claims (sub, email, picture, name)

    Note over API,DB: ③ アカウント作成 / 連携
    API->>DB: find_by_email(email)
    alt 新規ユーザー
        API->>DB: INSERT users (google_sub, avatar_url)
    else 既存 (google_sub 未設定)
        API->>DB: UPDATE users SET google_sub (アカウント連携)
    end

    Note over API,C: ④ JWT 発行
    API->>API: create_access_token(user.id)<br/>HS256 / exp 30日
    API-->>C: TokenResponse { token, user }
    C->>C: token を AsyncStorage / localStorage に保存

    Note over C,API: 以降の保護APIは Authorization: Bearer <JWT>
    C->>API: GET /albums (Bearer)
    API->>API: get_current_user() decode + DB照合
    API-->>C: 200 / 401
```

メール+パスワード認証 (bcrypt ハッシュ) も併用可能。`/auth/login` で同様に JWT を発行。

---

## 4. 主要データフロー: 写真アップロード & 動画生成

```mermaid
sequenceDiagram
    participant C as クライアント
    participant API as FastAPI
    participant F as Filter処理<br/>(Pillow/NumPy)
    participant S as Supabase Storage
    participant DB as PostgreSQL
    participant BG as Background Task

    Note over C,DB: 写真アップロード (フィルター適用)
    C->>API: POST /albums/{id}/photos<br/>FormData {file, filter_preset?}
    API->>F: フィルター適用
    F-->>API: 加工済み画像
    API->>S: upload_photo() (original + 加工)
    API->>DB: INSERT photos (storage_key, filter_preset)
    API-->>C: PhotoRead { id, urls }

    Note over C,BG: スライドショー動画生成 (非同期)
    C->>API: POST /albums/{id}/movie (Bearer)
    API->>DB: INSERT movies (status='pending')
    API-->>C: 202 Accepted { status: pending }
    API->>BG: background_tasks.add_task(generate)
    BG->>S: 写真download → ffmpeg → MP4 upload
    BG->>DB: UPDATE movies SET status='ready', storage_key
    C->>API: GET /albums/{id}/movie (polling)
    API-->>C: { status: ready, url }
```

---

## 5. データモデル (ER)

```mermaid
erDiagram
    users ||--o{ albums : "created_by"
    users ||--o{ album_members : ""
    albums ||--o{ album_members : ""
    albums ||--o{ photos : ""
    albums ||--o{ movies : ""
    albums ||--o{ invite_codes : ""
    users ||--o{ photos : "uploaded_by"

    users {
        uuid id PK
        string email UK
        string password_hash
        string google_sub UK "OAuth連携"
        string display_name
        string avatar_url
    }
    albums {
        uuid id PK
        string title
        uuid created_by FK
        datetime reveal_date "公開日"
        int max_exposures "既定27"
        string bgm_url
    }
    album_members {
        uuid user_id FK
        uuid album_id FK
    }
    photos {
        uuid id PK
        uuid album_id FK
        uuid uploaded_by FK
        string storage_key
        string original_key
        string filter_preset
        datetime taken_at
    }
    movies {
        uuid id PK
        uuid album_id FK
        string status "pending|processing|ready|failed"
        string storage_key
        string error
    }
    invite_codes {
        uuid album_id FK
    }
```

---

## 6. 技術スタック

| 領域 | 技術 | 配置 |
|---|---|---|
| Mobile | Expo SDK 54 / React Native 0.81 / React 19 | `apps/mobile` |
| Web | Next.js 15 (App Router) / React 19 | `apps/web` |
| Backend | FastAPI 0.115 / Uvicorn / Python 3.12 | `apps/api` |
| ORM / DB | SQLAlchemy 2.0 async / asyncpg / PostgreSQL 16 | `apps/api` |
| 認証 | PyJWT (HS256) / google-auth | `core/jwt.py`, `services/auth.py` |
| 画像処理 | Pillow / NumPy (HEIC/HEIF対応) | `services/photo.py` |
| ストレージ | Supabase Storage (S3互換) | `core/storage.py` |
| Monorepo | pnpm 10.5 workspaces / Node 22+ | root |
| インフラ | Docker Compose (dev) / Render (prod) | `docker-compose.yml`, `render.yaml` |
| CI/CD | GitHub Actions (lint/typecheck/test/build) | `.github/workflows/ci.yml` |
```
