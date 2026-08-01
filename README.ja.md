# New API

> 複数の AI サービスへのアクセスを統合する AI API ゲートウェイおよび資産管理プラットフォーム。

[![License](https://img.shields.io/badge/license-AGPL--3.0-orange.svg)](./LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25%2B-00ADD8?logo=go)](./go.mod)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](./web/default/package.json)

**言語:** [简体中文](./README.md) · [繁體中文](./README.zh_TW.md) · [English](./README.en.md) · [Français](./README.fr.md) · **日本語**

New API は **QuantumNous** が保守する AI API ゲートウェイです。OpenAI、Claude、Gemini、Azure、AWS Bedrock などの上流プロバイダーを統一インターフェースの背後で公開し、チャネル管理、スマートルーティング、認証、クォータとコスト計算、ログ、ユーザー管理、管理ダッシュボードを備えています。

> [!IMPORTANT]
> 本プロジェクトは、法的に認可された API ゲートウェイ、組織内認証、マルチモデル管理、利用統計、コスト計算、プライベートデプロイを目的としています。上流サービスのアクセス権は正当に取得し、上流の利用規約および適用される現地の法令を遵守する必要があります。

## 主な機能

- **統一インターフェース**: OpenAI Compatible、Responses、Realtime、Claude Messages、Gemini、Rerank に加え、複数の画像・音声・タスク向けインターフェースをサポート。
- **マルチチャネルルーティング**: チャネルの優先度と重み、失敗時のリトライ、モデルマッピング、バッチキー、可用性テスト。
- **アクセス制御**: JWT、OAuth、OIDC、WebAuthn/Passkey、2FA、ユーザーグループ、トークンとモデルの権限。
- **利用量とコスト**: クォータ管理、モデル倍率、段階的・動的価格設定、チャージとサブスクリプション、利用ログと統計ダッシュボード。
- **運用**: SQLite、MySQL、PostgreSQL、Redis キャッシュ、マルチノードデプロイ、ヘルスチェック、システム監視。
- **デュアルフロントエンド**: モダンな `default` コンソールに加え、互換性を維持する `classic` コンソール。
- **国際化**: バックエンドは中国語と英語に対応。デフォルトのフロントエンドは中国語、英語、フランス語、日本語、ロシア語、ベトナム語に対応。

## アーキテクチャ

```text
Router -> Controller -> Service -> Model
                         |
                         +-> Relay -> Provider adapters
```

| レイヤー | 技術スタックとディレクトリ |
| --- | --- |
| バックエンド | Go、Gin、GORM；`router/`、`controller/`、`service/`、`model/` |
| プロトコル中継 | `relay/` および `relay/channel/` 配下のプロバイダーアダプター |
| デフォルトのフロントエンド | React 19、TypeScript、Base UI、Tailwind CSS、Rsbuild；`web/default/` |
| クラシックフロントエンド | React、Semi Design；`web/classic/` |
| データとキャッシュ | SQLite / MySQL / PostgreSQL、Redis |

## クイックスタート

### Docker Compose

1. リポジトリをクローンしてディレクトリに入ります:

   ```bash
   git clone https://github.com/juangchuank-ops/new-api-main-copy.git
   cd new-api-main-copy
   ```

2. [`docker-compose.yml`](./docker-compose.yml) 内のデータベースと Redis のパスワード、および `SESSION_SECRET` を変更します。本番環境でサンプルのパスワードを使用したままにしないでください。

3. サービスを起動します:

   ```bash
   docker compose up -d
   ```

4. <http://localhost:3000> を開き、セットアップウィザードに従って管理者アカウントを作成します。

デフォルトの Compose 構成は PostgreSQL と Redis を使用します。永続データは Docker ボリュームと、ローカルの `data/` および `logs/` ディレクトリに保存されます。

### シングルコンテナ（SQLite）

```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v "$(pwd)/data:/data" \
  calciumion/new-api:latest
```

## ローカル開発

### 前提条件

- [`go.mod`](./go.mod) に記載されているバージョンの Go
- [Bun](https://bun.sh/) 1.x
- Docker（PostgreSQL と Redis の開発環境に推奨）
- GNU Make（任意。プロジェクトのショートカット用）

### 開発環境の起動

```bash
# バックエンド、PostgreSQL、Redis を起動
make dev-api

# default と classic の両方のフロントエンドを起動
make dev-web
```

デフォルトのフロントエンドは <http://localhost:5173>、Classic フロントエンドは <http://localhost:5174>、バックエンド API は <http://localhost:3000> で動作します。

個別に起動することもできます:

```bash
# バックエンド（デフォルトは SQLite。データベースやその他の設定はローカルの .env に記述できます）
go run main.go

# デフォルトのフロントエンド
cd web
bun install
cd default
bun run dev
```

## ビルドとチェック

```bash
# default と classic の両方のフロントエンドをビルド
make build-all-frontends

# バックエンドのテスト
go test ./...

# デフォルトのフロントエンドの品質チェック
cd web/default
bun run typecheck
bun run lint
bun run format:check
bun run build
```

完全なコンテナイメージをビルドすると、先に両方のフロントエンドがビルドされ、その後で静的アセットが Go サービスに埋め込まれます:

```bash
docker build -t new-api:local .
```

## 設定

一般的な環境変数は [`.env.example`](./.env.example) に示されています。デプロイ前に最低限、以下を確認してください:

| 変数 | 用途 |
| --- | --- |
| `SQL_DSN` | MySQL または PostgreSQL のプライマリデータベース接続文字列。未設定の場合は SQLite にフォールバック |
| `REDIS_CONN_STRING` | Redis 接続文字列 |
| `SESSION_SECRET` | マルチノードデプロイ用のセッション署名シークレット。本番環境では強力なランダム値である必要があります |
| `PORT` | HTTP のリッスンポート。デフォルトは `3000` |
| `TZ` | コンテナまたはサービスのタイムゾーン |

`.env`、データベースファイル、認証情報、Cookie、アクセストークン、ビルド成果物をコミットしないでください。リポジトリの [`.gitignore`](./.gitignore) には、これらの一般的なローカル成果物がすでに含まれています。

## プロジェクト構成

```text
common/       共有設定、JSON、キャッシュ、暗号化、ネットワークユーティリティ
constant/     定数とチャネルタイプ
controller/   HTTP コントローラー
docs/         インストール、チャネル、OpenAPI のドキュメント
dto/          リクエスト・レスポンスのデータ構造
i18n/         バックエンドの国際化リソース
middleware/   認証、レート制限、ロギング、CORS などのミドルウェア
model/        GORM モデル、マイグレーション、データアクセス
oauth/        OAuth / OIDC プロバイダー実装
relay/        プロトコル変換、課金、上流チャネルアダプター
router/       API、Relay、Dashboard、Web のルート
service/      ビジネスロジック
setting/      システム、モデル、倍率、パフォーマンスなどの設定
web/default/  デフォルトの React 19 コンソール
web/classic/  Classic 互換コンソール
```

## ドキュメントとサポート

- [簡体中文の完全な説明](./README.zh_CN.md)
- [OpenAPI 定義](./docs/openapi/)
- [追加のチャネル設定](./docs/channel/other_setting.md)
- [宝塔パネルのインストール](./docs/installation/BT.md)
- [セキュリティポリシー](./.github/SECURITY.md)
- [Issues](https://github.com/juangchuank-ops/new-api-main-copy/issues)

## コントリビューション

変更を提出する前に、[`AGENTS.md`](./AGENTS.md) と関連するサブディレクトリの規約を読んでください。バックエンドの変更は SQLite、MySQL、PostgreSQL との互換性を維持する必要があり、ユーザー向けのフロントエンドテキストは国際化する必要があります。Pull Request は [プロジェクトテンプレート](./.github/PULL_REQUEST_TEMPLATE.md) を使用してください。

## ライセンスと帰属

このプロジェクトは [GNU Affero General Public License v3.0](./LICENSE) の下でライセンスされています。サードパーティのコンポーネントとそのライセンスは、[`THIRD-PARTY-LICENSES.md`](./THIRD-PARTY-LICENSES.md) と [`NOTICE`](./NOTICE) に記載されています。

New API プロジェクトおよび **QuantumNous** の名称、ロゴ、著作権、帰属情報はすべて保持されます。
