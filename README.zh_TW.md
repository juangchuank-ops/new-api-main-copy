# New API

> 統一管理多家 AI 服務的 API 閘道與資產管理平台。

[![License](https://img.shields.io/badge/license-AGPL--3.0-orange.svg)](./LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25%2B-00ADD8?logo=go)](./go.mod)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](./web/default/package.json)

**語言：** [簡體中文](./README.md) · **繁體中文** · [English](./README.en.md) · [Français](./README.fr.md) · [日本語](./README.ja.md)

New API 是由 **QuantumNous** 維護的 AI API 閘道。它將 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等上游服務接入統一介面，並提供渠道管理、智慧路由、鑑權、額度與成本核算、日誌、使用者管理和管理控制台。

> [!IMPORTANT]
> 本專案僅適用於合法授權的 API 閘道、組織內部鑑權、多模型管理、用量統計、成本核算和私有化部署。使用者必須合法取得上游服務權限，並遵守上游條款及所在地法律法規。

## 主要能力

- **統一介面**：支援 OpenAI Compatible、Responses、Realtime、Claude Messages、Gemini、Rerank 及多種影像、音訊和任務介面。
- **多渠道路由**：渠道優先級與權重、失敗重試、模型對映、批次金鑰和可用性測試。
- **存取控制**：JWT、OAuth、OIDC、WebAuthn/Passkey、2FA、使用者群組、權杖和模型權限。
- **用量與成本**：額度管理、模型倍率、分層/動態定價、儲值與訂閱、使用日誌和統計看板。
- **維運能力**：SQLite、MySQL、PostgreSQL、Redis 快取，多節點部署，健康檢查和系統監控。
- **雙前端**：現代化 `default` 控制台，以及保留相容性的 `classic` 控制台。
- **國際化**：後端支援中英文；預設前端支援中文、英文、法語、日語、俄語和越南語。

## 技術架構

```text
Router -> Controller -> Service -> Model
                         |
                         +-> Relay -> Provider adapters
```

| 層級 | 技術與目錄 |
| --- | --- |
| 後端 | Go、Gin、GORM；`router/`、`controller/`、`service/`、`model/` |
| 協定轉發 | `relay/` 與 `relay/channel/` 中的供應商轉接器 |
| 預設前端 | React 19、TypeScript、Base UI、Tailwind CSS、Rsbuild；`web/default/` |
| 經典前端 | React、Semi Design；`web/classic/` |
| 資料與快取 | SQLite / MySQL / PostgreSQL、Redis |

## 快速部署

### Docker Compose

1. 複製倉庫並進入目錄：

   ```bash
   git clone https://github.com/juangchuank-ops/new-api-main-copy.git
   cd new-api-main-copy
   ```

2. 修改 [`docker-compose.yml`](./docker-compose.yml) 中的資料庫、Redis 密碼和 `SESSION_SECRET`。生產環境禁止沿用範例密碼。

3. 啟動服務：

   ```bash
   docker compose up -d
   ```

4. 開啟 <http://localhost:3000>，依照初始化精靈建立管理員。

預設 Compose 組態使用 PostgreSQL 和 Redis。持久化資料分別儲存在 Docker 卷與本機 `data/`、`logs/` 目錄中。

### 單一容器（SQLite）

```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v "$(pwd)/data:/data" \
  calciumion/new-api:latest
```

## 本機開發

### 環境需求

- Go 版本以 [`go.mod`](./go.mod) 為準
- [Bun](https://bun.sh/) 1.x
- Docker（推薦用於 PostgreSQL 和 Redis 開發環境）
- GNU Make（可選，用於專案快速指令）

### 啟動開發環境

```bash
# 啟動後端、PostgreSQL 與 Redis
make dev-api

# 啟動 default 與 classic 兩套前端
make dev-web
```

預設前端位址為 <http://localhost:5173>，Classic 前端位址為 <http://localhost:5174>，後端 API 位址為 <http://localhost:3000>。

也可以分別啟動：

```bash
# 後端（預設使用 SQLite；資料庫和其他組態可寫入本機 .env）
go run main.go

# 預設前端
cd web
bun install
cd default
bun run dev
```

## 建置與檢查

```bash
# 建置預設前端與 Classic 前端
make build-all-frontends

# 後端測試
go test ./...

# 預設前端品質檢查
cd web/default
bun run typecheck
bun run lint
bun run format:check
bun run build
```

完整容器映像建置會依序建置兩套前端，再將靜態資源嵌入 Go 服務：

```bash
docker build -t new-api:local .
```

## 組態說明

常用環境變數範例位於 [`.env.example`](./.env.example)。部署前至少檢查：

| 變數 | 用途 |
| --- | --- |
| `SQL_DSN` | MySQL 或 PostgreSQL 主資料庫連線字串；未設定時使用 SQLite |
| `REDIS_CONN_STRING` | Redis 連線字串 |
| `SESSION_SECRET` | 多節點工作階段簽章金鑰，生產環境必須使用高強度隨機值 |
| `PORT` | HTTP 監聽連接埠，預設為 `3000` |
| `TZ` | 容器或服務時區 |

請勿提交 `.env`、資料庫檔案、登入資訊、Cookie、存取權杖或建置產物。倉庫的 [`.gitignore`](./.gitignore) 已涵蓋這些常見本機產物。

## 專案目錄

```text
common/       通用組態、JSON、快取、加密和網路工具
constant/     常數與渠道類型
controller/   HTTP 控制器
docs/         安裝、渠道和 OpenAPI 文件
dto/          請求與回應資料結構
i18n/         後端國際化資源
middleware/   鑑權、限流、日誌、CORS 等中介軟體
model/        GORM 模型、遷移與資料存取
oauth/        OAuth / OIDC 提供者實作
relay/        協定轉換、計費與上游渠道轉接
router/       API、Relay、Dashboard 和 Web 路由
service/      業務邏輯
setting/      系統、模型、倍率、效能等組態
web/default/  預設 React 19 控制台
web/classic/  Classic 相容控制台
```

## 文件與支援

- [簡體中文完整說明](./README.zh_CN.md)
- [OpenAPI 定義](./docs/openapi/)
- [渠道組態補充](./docs/channel/other_setting.md)
- [寶塔面板安裝](./docs/installation/BT.md)
- [安全政策](./.github/SECURITY.md)
- [問題回饋](https://github.com/juangchuank-ops/new-api-main-copy/issues)

## 貢獻

提交變更前請閱讀 [`AGENTS.md`](./AGENTS.md) 和相關子目錄規範。後端變更需相容 SQLite、MySQL 與 PostgreSQL；前端使用者可見文案必須完成國際化。Pull Request 請使用 [專案範本](./.github/PULL_REQUEST_TEMPLATE.md)。

## 授權條款與歸屬

本專案採用 [GNU Affero General Public License v3.0](./LICENSE)。第三方元件及其授權條款見 [`THIRD-PARTY-LICENSES.md`](./THIRD-PARTY-LICENSES.md) 與 [`NOTICE`](./NOTICE)。

New API 專案及 **QuantumNous** 相關名稱、標識、版權與歸屬資訊均予以保留。
