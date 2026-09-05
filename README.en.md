# New API

> A unified AI API gateway and asset management platform for multiple AI services.

[![License](https://img.shields.io/badge/license-AGPL--3.0-orange.svg)](./LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25%2B-00ADD8?logo=go)](./go.mod)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](./web/default/package.json)

**Language:** [简体中文](./README.md) · [繁體中文](./README.zh_TW.md) · **English** · [Français](./README.fr.md) · [日本語](./README.ja.md)

New API is an AI API gateway maintained by **QuantumNous**. It connects 40+ upstream services including OpenAI, Claude, Gemini, Azure, and AWS Bedrock behind a unified interface, and provides channel management, intelligent routing, authentication, quota and cost accounting, logging, user management, and dual-frontend admin consoles.

> [!IMPORTANT]
> This project is intended solely for legally authorized API gateways, organizational authentication, multi-model management, usage tracking, cost accounting, and private deployments. Users must obtain upstream service permissions in compliance with upstream terms and local laws and regulations.

## Key Features

- **Unified Interface**: Supports OpenAI Compatible, Responses, Realtime, Claude Messages, Gemini, Rerank, and multiple image, audio, video, and task interfaces.
- **Multi-Channel Routing**: 40+ upstream provider adapters, channel priority and weight, failure retry, model mapping, batch keys, availability testing, and channel affinity.
- **Access Control**: JWT, OAuth, OIDC, WebAuthn/Passkey, 2FA, user groups, token and model permissions, IP blacklist, browser fingerprint blacklist, and auto-blocking.
- **Usage & Cost**: Quota management, model multipliers, tiered/dynamic pricing (expression-based billing), top-up and subscription, usage logs, statistics dashboards, and leaderboards.
- **Value-Added Features**: Daily check-in, invitation codes, redemption codes, transfers, balance top-up, subscription plans, gaming center (Texas Hold'em, stock/futures simulation, Minesweeper, and more).
- **Ops Capabilities**: SQLite, MySQL, PostgreSQL, ClickHouse log database, Redis cache, multi-node deployment, health checks, system monitoring, and performance metrics.
- **Dual Frontends**: Modern `default` console (React 19 + Tailwind) and compatibility-retaining `classic` console (Semi Design).
- **Internationalization**: Backend supports Chinese and English; default frontend supports Chinese, English, French, Japanese, Russian, and Vietnamese.

## Architecture

```text
                    ┌──────────────────────────────┐
                    │         HTTP Requests          │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────▼────────────────────┐
              │  router/  Route Registration (API / Relay / Web) │
              └────────────────────┬────────────────────┘
                                   │
              ┌────────────────────▼────────────────────┐
              │  middleware/  Auth, Rate Limiting, Logging, Security │
              └────────────────────┬────────────────────┘
                                   │
              ┌────────────────────▼────────────────────┐
              │  controller/  HTTP Controllers (Business Entry) │
              └────────────────────┬────────────────────┘
               ┌───────────────────┼───────────────────┐
               ▼                   ▼                   ▼
      ┌──────────────────┐ ┌───────────────┐ ┌──────────────────┐
      │ service/  Business Logic│ │ relay/  Protocol Relay│ │ relay/channel/   │
      └────────┬─────────┘ └───────┬───────┘ │  40+ Provider Adapters │
               │                   │         └──────────────────┘
               ▼                   ▼
      ┌──────────────────┐  ┌──────────────────┐
      │ model/  GORM Data│  │ oauth/  Third-Party Login│
      │ Layer / Migration│  └──────────────────┘
      └──────────────────┘
```

| Layer | Technology & Directories |
| --- | --- |
| Backend | Go 1.25, Gin, GORM; `router/`, `controller/`, `service/`, `model/` |
| Protocol Relay | `relay/` and `relay/channel/` provider adapters; `relaykit/` standalone protocol conversion module |
| Default Frontend | React 19, TypeScript, Base UI, Tailwind CSS, Rsbuild; `web/default/` |
| Classic Frontend | React, Semi Design; `web/classic/` |
| Data & Cache | SQLite / MySQL / PostgreSQL, ClickHouse log database, Redis |

## Quick Deployment

### Docker Compose

1. Clone the repository and enter the directory:

   ```bash
   git clone https://github.com/juangchuank-ops/new-api-main-copy.git
   cd new-api-main-copy
   ```

2. Edit [`docker-compose.yml`](./docker-compose.yml) to set the database, Redis password, and `SESSION_SECRET`. Do not use the example passwords in production.

3. Start the services:

   ```bash
   docker compose up -d
   ```

4. Open <http://localhost:3000> and follow the setup wizard to create an administrator.

The default Compose configuration uses PostgreSQL and Redis. Storage volumes and local `data/` and `logs/` directories persist data.

### Single Container (SQLite)

```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v "$(pwd)/data:/data" \
  calciumion/new-api:latest
```

## Local Development

### Prerequisites

- Go version as specified in [`go.mod`](./go.mod)
- [Bun](https://bun.sh/) 1.x
- Docker (recommended for PostgreSQL and Redis development environment)
- GNU Make (optional, for project shortcuts)

### Start Development Environment

```bash
# Start backend, PostgreSQL, and Redis
make dev-api

# Start both default and classic frontends
make dev-web
```

The default frontend is at <http://localhost:5173>, the Classic frontend at <http://localhost:5174>, and the backend API at <http://localhost:3000>.

You can also start them individually:

```bash
# Backend (uses SQLite by default; database and other config can be set in local .env)
go run main.go

# Default frontend
cd web
bun install
cd default
bun run dev
```

## Build & Quality Checks

```bash
# Build both default and classic frontends
make build-all-frontends

# Backend tests
go test ./...

# Default frontend quality checks
cd web/default
bun run typecheck
bun run lint
bun run format:check
bun run build
```

Full container image build builds both frontends sequentially, then embeds static assets into the Go service:

```bash
docker build -t new-api:local .
```

## Configuration

Common environment variables are listed in [`.env.example`](./.env.example). Before deploying, review at least:

| Variable | Purpose |
| --- | --- |
| `SQL_DSN` | MySQL or PostgreSQL main database connection string; uses SQLite if not set |
| `LOG_SQL_DSN` | ClickHouse or MySQL log database connection string (optional) |
| `REDIS_CONN_STRING` | Redis connection string |
| `SESSION_SECRET` | Multi-node session signing key; must use a strong random value in production |
| `PORT` | HTTP listen port, default `3000` |
| `TZ` | Container or service timezone |
| `NODE_TYPE` | Multi-node role; `master` for the primary node |

Do not commit `.env`, database files, login credentials, cookies, access tokens, or build artifacts. The repository's [`.gitignore`](./.gitignore) covers these common local artifacts.

## Project Directory

```text
common/       Common utilities: JSON, cache, crypto, and networking tools
constant/     Constants and channel types (API types, channel types, endpoint types, etc.)
controller/   HTTP controllers (users, channels, tokens, top-ups, subscriptions, leaderboards, etc.)
docs/         Installation, channel, OpenAPI, and per-file manifest documentation
dto/          Request and response data structures
i18n/         Backend internationalization resources
logger/       Leveled logging package
middleware/   Auth, rate limiting, logging, CORS, and other middleware
model/        GORM models, migrations, and data access
oauth/        OAuth / OIDC provider implementations
relay/        Protocol conversion, billing, and upstream channel adaptation
relaykit/     Standalone Go module (protocol DTO and format conversion)
router/       API, Relay, Dashboard, and Web routes
service/      Business logic
setting/      System, model, multiplier, billing, performance, and other configuration
types/        Type definitions
pkg/          Internal reusable packages (billingexpr, cachex, ionet, etc.)
web/default/  Default React 19 console
web/classic/  Classic compatibility console
docs/file-map.md  Per-file manifest: purpose of every backend Go file
```

For each directory's core responsibilities and per-file descriptions, see [**Per-File Manifest (docs/file-map.md)**](./docs/file-map.md).

## Documentation & Support

- [Per-File Manifest](./docs/file-map.md)
- [Classic Homepage Public Banner Update](./docs/updates/classic-public-banners.md)
- [Simplified Chinese README](./README.zh_CN.md)
- [OpenAPI Definitions](./docs/openapi/)
- [Channel Configuration Notes](./docs/channel/other_setting.md)
- [BT Panel Installation](./docs/installation/BT.md)
- [Security Policy](./.github/SECURITY.md)
- [Issue Tracker](https://github.com/juangchuank-ops/new-api-main-copy/issues)

## Contributing

Before submitting changes, read [`AGENTS.md`](./AGENTS.md) and relevant subdirectory conventions. Backend changes must be compatible with SQLite, MySQL, and PostgreSQL; frontend user-facing text must be internationalized. Please use the [project template](./.github/PULL_REQUEST_TEMPLATE.md) for pull requests.

## License & Attribution

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE). Third-party components and their licenses are listed in [`THIRD-PARTY-LICENSES.md`](./THIRD-PARTY-LICENSES.md) and [`NOTICE`](./NOTICE).

The New API project and **QuantumNous**-related names, marks, copyright, and attribution information are retained.
