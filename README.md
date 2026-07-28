# New API

> 统一管理多家 AI 服务的 API 网关与资产管理平台。

[![License](https://img.shields.io/badge/license-AGPL--3.0-orange.svg)](./LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25%2B-00ADD8?logo=go)](./go.mod)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](./web/default/package.json)

**语言：** [简体中文](./README.zh_CN.md) · [繁體中文](./README.zh_TW.md) · [English](./README.en.md) · [Français](./README.fr.md) · [日本語](./README.ja.md)

New API 是由 **QuantumNous** 维护的 AI API 网关。它将 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等上游服务接入统一接口，并提供渠道管理、智能路由、鉴权、额度与成本核算、日志、用户管理和管理控制台。

> [!IMPORTANT]
> 本项目仅适用于合法授权的 API 网关、组织内部鉴权、多模型管理、用量统计、成本核算和私有化部署。使用者必须合法取得上游服务权限，并遵守上游条款及所在地法律法规。

## 主要能力

- **统一接口**：支持 OpenAI Compatible、Responses、Realtime、Claude Messages、Gemini、Rerank 及多种图像、音频和任务接口。
- **多渠道路由**：渠道优先级与权重、失败重试、模型映射、批量密钥和可用性测试。
- **访问控制**：JWT、OAuth、OIDC、WebAuthn/Passkey、2FA、用户分组、令牌和模型权限。
- **用量与成本**：额度管理、模型倍率、分层/动态定价、充值与订阅、使用日志和统计看板。
- **运维能力**：SQLite、MySQL、PostgreSQL，Redis 缓存，多节点部署，健康检查和系统监控。
- **双前端**：现代化 `default` 控制台，以及保留兼容性的 `classic` 控制台。
- **国际化**：后端支持中英文；默认前端支持中文、英文、法语、日语、俄语和越南语。

## 技术架构

```text
Router -> Controller -> Service -> Model
                         |
                         +-> Relay -> Provider adapters
```

| 层级 | 技术与目录 |
| --- | --- |
| 后端 | Go、Gin、GORM；`router/`、`controller/`、`service/`、`model/` |
| 协议转发 | `relay/` 与 `relay/channel/` 中的供应商适配器 |
| 默认前端 | React 19、TypeScript、Base UI、Tailwind CSS、Rsbuild；`web/default/` |
| 经典前端 | React、Semi Design；`web/classic/` |
| 数据与缓存 | SQLite / MySQL / PostgreSQL、Redis |

## 快速部署

### Docker Compose

1. 克隆仓库并进入目录：

   ```bash
   git clone https://github.com/juangchuank-ops/new-api-main-copy.git
   cd new-api-main-copy
   ```

2. 修改 [`docker-compose.yml`](./docker-compose.yml) 中的数据库、Redis 密码和 `SESSION_SECRET`。生产环境禁止沿用示例密码。

3. 启动服务：

   ```bash
   docker compose up -d
   ```

4. 打开 <http://localhost:3000>，按照初始化向导创建管理员。

默认 Compose 配置使用 PostgreSQL 和 Redis。持久化数据分别保存在 Docker 卷和本地 `data/`、`logs/` 目录中。

### 单容器（SQLite）

```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v "$(pwd)/data:/data" \
  calciumion/new-api:latest
```

## 本地开发

### 环境要求

- Go 版本以 [`go.mod`](./go.mod) 为准
- [Bun](https://bun.sh/) 1.x
- Docker（推荐用于 PostgreSQL 和 Redis 开发环境）
- GNU Make（可选，用于项目快捷命令）

### 启动开发环境

```bash
# 启动后端、PostgreSQL 与 Redis
make dev-api

# 启动 default 与 classic 两套前端
make dev-web
```

默认前端地址为 <http://localhost:5173>，Classic 前端地址为 <http://localhost:5174>，后端 API 地址为 <http://localhost:3000>。

也可以分别启动：

```bash
# 后端（默认使用 SQLite；数据库和其他配置可写入本地 .env）
go run main.go

# 默认前端
cd web
bun install
cd default
bun run dev
```

## 构建与检查

```bash
# 构建默认前端与 Classic 前端
make build-all-frontends

# 后端测试
go test ./...

# 默认前端质量检查
cd web/default
bun run typecheck
bun run lint
bun run format:check
bun run build
```

完整容器镜像构建会依次构建两套前端，再将静态资源嵌入 Go 服务：

```bash
docker build -t new-api:local .
```

## 配置说明

常用环境变量示例位于 [`.env.example`](./.env.example)。部署前至少检查：

| 变量 | 用途 |
| --- | --- |
| `SQL_DSN` | MySQL 或 PostgreSQL 主数据库连接串；未设置时使用 SQLite |
| `REDIS_CONN_STRING` | Redis 连接串 |
| `SESSION_SECRET` | 多节点会话签名密钥，生产环境必须使用高强度随机值 |
| `PORT` | HTTP 监听端口，默认为 `3000` |
| `TZ` | 容器或服务时区 |

不要提交 `.env`、数据库文件、登录信息、Cookie、访问令牌或构建产物。仓库的 [`.gitignore`](./.gitignore) 已覆盖这些常见本地产物。

## 项目目录

```text
common/       通用配置、JSON、缓存、加密和网络工具
constant/     常量与渠道类型
controller/   HTTP 控制器
docs/         安装、渠道和 OpenAPI 文档
dto/          请求与响应数据结构
i18n/         后端国际化资源
middleware/   鉴权、限流、日志、CORS 等中间件
model/        GORM 模型、迁移与数据访问
oauth/        OAuth / OIDC 提供商实现
relay/        协议转换、计费与上游渠道适配
router/       API、Relay、Dashboard 和 Web 路由
service/      业务逻辑
setting/      系统、模型、倍率、性能等配置
web/default/  默认 React 19 控制台
web/classic/  Classic 兼容控制台
```

## 文档与支持

- [简体中文完整说明](./README.zh_CN.md)
- [OpenAPI 定义](./docs/openapi/)
- [渠道配置补充](./docs/channel/other_setting.md)
- [宝塔面板安装](./docs/installation/BT.md)
- [安全政策](./.github/SECURITY.md)
- [问题反馈](https://github.com/QuantumNous/new-api/issues)

## 贡献

提交改动前请阅读 [`AGENTS.md`](./AGENTS.md) 和相关子目录规范。后端改动需兼容 SQLite、MySQL 与 PostgreSQL；前端用户可见文案必须完成国际化。Pull Request 请使用 [项目模板](./.github/PULL_REQUEST_TEMPLATE.md)。

## 许可证与归属

本项目采用 [GNU Affero General Public License v3.0](./LICENSE)。第三方组件及其许可证见 [`THIRD-PARTY-LICENSES.md`](./THIRD-PARTY-LICENSES.md) 与 [`NOTICE`](./NOTICE)。

New API 项目及 **QuantumNous** 相关名称、标识、版权和归属信息均予以保留。
