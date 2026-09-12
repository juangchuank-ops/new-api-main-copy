# New API

> 複数の AI サービスを統一的に管理する API ゲートウェイと資産管理プラットフォーム。

[![License](https://img.shields.io/badge/license-AGPL--3.0-orange.svg)](./LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25%2B-00ADD8?logo=go)](./go.mod)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](./web/default/package.json)

**言語：** [简体中文](./README.md) · [繁體中文](./README.zh_TW.md) · [English](./README.en.md) · [Français](./README.fr.md) · **日本語**

New API は **QuantumNous** がメンテナンスする AI API ゲートウェイです。OpenAI、Claude、Gemini、Azure、AWS Bedrock など 40 以上のアップストリームサービスを統一インターフェースに接続し、チャネル管理、スマートルーティング、認証、クォータとコスト計算、ログ、ユーザー管理、デュアルフロントエンドの管理コンソールを提供します。

> [!IMPORTANT]
> 本プロジェクトは、合法的に認可された API ゲートウェイ、組織内の認証、マルチモデル管理、利用統計、コスト計算、プライベートデプロイにのみ使用することを想定しています。利用者はアップストリームサービスの権限を合法的に取得し、アップストリームの規約および所在地の法令を遵守しなければなりません。

## 主な機能

- **統一インターフェース**：OpenAI Compatible、Responses、Realtime、Claude Messages、Gemini、Rerank および各種の画像、音声、動画、タスクインターフェースに対応。
- **マルチチャネルルーティング**：40 以上のアップストリームプロバイダーアダプター、チャネル優先度と重み、失敗時リトライ、モデルマッピング、バッチキー、可用性テスト、チャネルアフィニティ。
- **アクセス制御**：JWT、OAuth、OIDC、WebAuthn/Passkey、2FA、ユーザーグループ、トークンとモデルの権限、IP ブラックリスト、ブラウザフィンガープリントブラックリスト、自動ブロック。
- **利用状況とコスト**：クォータ管理、モデル倍率、段階的/動的価格設定（式による課金）、チャージとサブスクリプション、利用ログ、統計ダッシュボードとランキング。
- **付加機能**：毎日チェックイン、招待コード、引き換えコード、送金、残高チャージ、サブスクリプションプラン、チケットセンター（ユーザーがチケットを提出し、管理者が処理）、ゲームセンター（テキサスホールデム、株/先物シミュレーション、マインスイーパなど）。
- **運用能力**：SQLite、MySQL、PostgreSQL、ClickHouse ログデータベース、Redis キャッシュ、マルチノードデプロイ、ヘルスチェック、システム監視、パフォーマンスメトリクス。
- **デュアルフロントエンド**：モダンな `default` コンソール（React 19 + Tailwind）と、互換性を維持した `classic` コンソール（Semi Design）。
- **国際化**：バックエンドは中国語と英語に対応。デフォルトフロントエンドは中国語、英語、フランス語、日本語、ロシア語、ベトナム語に対応。

## 技術アーキテクチャ

```text
                    ┌──────────────────────────────┐
                    │         HTTP 请求             │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────▼────────────────────┐
              │  router/  路由注册（API / Relay / Web）  │
              └────────────────────┬────────────────────┘
                                   │
              ┌────────────────────▼────────────────────┐
              │  middleware/ 鉴权、限流、日志、安全拦截   │
              └────────────────────┬────────────────────┘
                                   │
              ┌────────────────────▼────────────────────┐
              │  controller/  HTTP 控制器（业务入口）    │
              └────────────────────┬────────────────────┘
               ┌───────────────────┼───────────────────┐
               ▼                   ▼                   ▼
      ┌──────────────────┐ ┌───────────────┐ ┌──────────────────┐
      │ service/ 业务逻辑 │ │ relay/ 协议转发│ │ relay/channel/   │
      └────────┬─────────┘ └───────┬───────┘ │  40+ 供应商适配器 │
               │                   │         └──────────────────┘
               ▼                   ▼
      ┌──────────────────┐  ┌──────────────────┐
      │ model/ GORM 数据  │  │ oauth/ 第三方登录│
      │ 层 / 迁移         │  └──────────────────┘
      └──────────────────┘
```

| 層 | 技術とディレクトリ |
| --- | --- |
| バックエンド | Go 1.25、Gin、GORM；`router/`、`controller/`、`service/`、`model/` |
| プロトコル中継 | `relay/` と `relay/channel/` のプロバイダーアダプター、`relaykit/` の独立プロトコル変換モジュール |
| デフォルトフロントエンド | React 19、TypeScript、Base UI、Tailwind CSS、Rsbuild；`web/default/` |
| クラシックフロントエンド | React、Semi Design；`web/classic/` |
| データとキャッシュ | SQLite / MySQL / PostgreSQL、ClickHouse ログデータベース、Redis |

## クイックデプロイ

### Docker Compose

1. リポジトリをクローンしてディレクトリに入ります。

   ```bash
   git clone https://github.com/juangchuank-ops/new-api-main-copy.git
   cd new-api-main-copy
   ```

2. [`docker-compose.yml`](./docker-compose.yml) でデータベース、Redis のパスワード、`SESSION_SECRET` を変更してください。本番環境ではサンプルのパスワードを使用しないでください。

3. サービスを起動します。

   ```bash
   docker compose up -d
   ```

4. <http://localhost:3000> を開き、初期化ウィザードに従って管理者を作成します。

既定の Compose 設定では PostgreSQL と Redis を使用します。ストレージボリュームとローカルの `data/`、`logs/` ディレクトリに永続データが保存されます。

### シングルコンテナ（SQLite）

```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v "$(pwd)/data:/data" \
  calciumion/new-api:latest
```

## ローカル開発

### 環境要件

- Go のバージョンは [`go.mod`](./go.mod) に従う
- [Bun](https://bun.sh/) 1.x
- Docker（PostgreSQL と Redis の開発環境に推奨）
- GNU Make（任意、プロジェクトのショートカットコマンド用）

### 開発環境の起動

```bash
# バックエンド、PostgreSQL、Redis を起動
make dev-api

# default と classic の両フロントエンドを起動
make dev-web
```

デフォルトフロントエンドは <http://localhost:5173>、Classic フロントエンドは <http://localhost:5174>、バックエンド API は <http://localhost:3000> です。

個別に起動することもできます。

```bash
# バックエンド（既定では SQLite を使用。データベースなどの設定はローカル .env に記入可能）
go run main.go

# デフォルトフロントエンド
cd web
bun install
cd default
bun run dev
```

## ビルドと確認

```bash
# デフォルトフロントエンドと Classic フロントエンドをビルド
make build-all-frontends

# バックエンドのテスト
go test ./...

# デフォルトフロントエンドの品質チェック
cd web/default
bun run typecheck
bun run lint
bun run format:check
bun run build
```

完全なコンテナイメージのビルドでは、両フロントエンドを順にビルドした後、静的リソースを Go サービスに埋め込みます。

```bash
docker build -t new-api:local .
```

## 設定について

一般的な環境変数の例は [`.env.example`](./.env.example) にあります。デプロイ前に少なくとも以下を確認してください。

| 変数 | 用途 |
| --- | --- |
| `SQL_DSN` | MySQL または PostgreSQL のメインデータベース接続文字列。未設定の場合は SQLite を使用 |
| `LOG_SQL_DSN` | ClickHouse または MySQL のログデータベース接続文字列（任意） |
| `REDIS_CONN_STRING` | Redis 接続文字列 |
| `SESSION_SECRET` | マルチノードのセッション署名キー。本番環境では強度の高いランダム値を使用 |
| `PORT` | HTTP リッスンポート、既定値は `3000` |
| `TZ` | コンテナまたはサービスのタイムゾーン |
| `NODE_TYPE` | マルチノードの役割。メインノードは `master` |

`.env`、データベースファイル、ログイン情報、Cookie、アクセストークン、ビルド成果物はコミットしないでください。リポジトリの [`.gitignore`](./.gitignore) はこれらの一般的なローカル成果物を対象としています。

## プロジェクトディレクトリ

```text
common/       一般的な設定、JSON、キャッシュ、暗号化、ネットワークツール
constant/     定数とチャネルタイプ（API タイプ、チャネルタイプ、エンドポイントタイプなど）
controller/   HTTP コントローラー（ユーザー、チャネル、トークン、チャージ、サブスクリプション、ランキングなど）
docs/         インストール、チャネル、OpenAPI、ファイルごとのマニフェストドキュメント
dto/          リクエストとレスポンスのデータ構造
i18n/         バックエンドの国際化リソース
logger/       レベル付きロギングパッケージ
middleware/   認証、レート制限、ログ、CORS などのミドルウェア
model/        GORM モデル、マイグレーション、データアクセス
oauth/        OAuth / OIDC プロバイダーの実装
relay/        プロトコル変換、課金、アップストリームチャネル連携
relaykit/     独立した Go モジュール（プロトコル DTO と形式変換）
router/       API、Relay、Dashboard、Web のルート
service/      ビジネスロジック
setting/      システム、モデル、倍率、課金、パフォーマンスなどの設定
types/        型定義
pkg/          内部再利用パッケージ（billingexpr 課金式、cachex、ionet など）
web/default/  デフォルトの React 19 コンソール
web/classic/  Classic 互換コンソール
docs/file-map.md  ファイルごとのマニフェスト：各バックエンド Go ファイルの用途説明
```

各ディレクトリの主な役割とファイルごとの説明は、[**ファイルごとのマニフェスト（docs/file-map.md）**](./docs/file-map.md) をご覧ください。

## ドキュメントとサポート

- [ファイルごとのマニフェスト](./docs/file-map.md)
- [Classic ホームページ公開バナーの更新について](./docs/updates/classic-public-banners.md)
- [簡体中文の完全な説明](./README.zh_CN.md)
- [OpenAPI 定義](./docs/openapi/)
- [チャネル設定の補足](./docs/channel/other_setting.md)
- [BT パネルインストール](./docs/installation/BT.md)
- [セキュリティポリシー](./.github/SECURITY.md)
- [問題の報告](https://github.com/juangchuank-ops/new-api-main-copy/issues)

## コントリビューション

変更を送信する前に [`AGENTS.md`](./AGENTS.md) と関連するサブディレクトリの規約をお読みください。バックエンドの変更は SQLite、MySQL、PostgreSQL との互換性が必要です。フロントエンドのユーザー向け文言は国際化しなければなりません。Pull Request は[プロジェクトテンプレート](./.github/PULL_REQUEST_TEMPLATE.md)を使用してください。

## ライセンスと帰属

本プロジェクトは [GNU Affero General Public License v3.0](./LICENSE) に基づきます。サードパーティコンポーネントとそのライセンスは [`THIRD-PARTY-LICENSES.md`](./THIRD-PARTY-LICENSES.md) と [`NOTICE`](./NOTICE) に記載されています。

New API プロジェクトおよび **QuantumNous** に関連する名称、商標、著作権、帰属情報はすべて保持されます。