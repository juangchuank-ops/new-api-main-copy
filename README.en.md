# New API

> An AI API gateway and asset management platform that unifies access to multiple AI services.

[![License](https://img.shields.io/badge/license-AGPL--3.0-orange.svg)](./LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25%2B-00ADD8?logo=go)](./go.mod)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](./web/default/package.json)

**Language:** [简体中文](./README.md) · [繁體中文](./README.zh_TW.md) · **English** · [Français](./README.fr.md) · [日本語](./README.ja.md)

New API is an AI API gateway maintained by **QuantumNous**. It exposes OpenAI, Claude, Gemini, Azure, AWS Bedrock and other upstream providers behind a unified interface, with channel management, smart routing, authentication, quota and cost accounting, logging, user management, and an admin dashboard.

> [!IMPORTANT]
> This project is intended for lawfully authorized API gateways, internal organization authentication, multi-model management, usage statistics, cost accounting, and private deployment. You must obtain upstream service access legitimately and comply with upstream terms of service and applicable local laws.

## Key Features

- **Unified Interface**: OpenAI Compatible, Responses, Realtime, Claude Messages, Gemini, Rerank, plus multiple image, audio and task interfaces.
- **Multi-channel Routing**: channel priority and weights, failure retry, model mapping, batch keys and availability testing.
- **Access Control**: JWT, OAuth, OIDC, WebAuthn/Passkey, 2FA, user groups, token and model permissions.
- **Usage & Cost**: quota management, model ratios, tiered/dynamic pricing, top-up and subscription, usage logs and statistics dashboard.
- **Operations**: SQLite, MySQL, PostgreSQL, Redis cache, multi-node deployment, health checks and system monitoring.
- **Dual Frontend**: the modern `default` console, plus the compatibility-preserving `classic` console.
- **Internationalization**: backend in Chinese and English; the default frontend supports Chinese, English, French, Japanese, Russian and Vietnamese.

## Architecture

```text
Router -> Controller -> Service -> Model
                         |
                         +-> Relay -> Provider adapters
```

| Layer | Stack & Directory |
| --- | --- |
| Backend | Go, Gin, GORM; `router/`, `controller/`, `service/`, `model/` |
| Protocol relay | Provider adapters under `relay/` and `relay/channel/` |
| Default frontend | React 19, TypeScript, Base UI, Tailwind CSS, Rsbuild; `web/default/` |
| Classic frontend | React, Semi Design; `web/classic/` |
| Data & cache | SQLite / MySQL / PostgreSQL, Redis |

## Quick Start

### Docker Compose

1. Clone the repository and enter the directory:

   ```bash
   git clone https://github.com/juangchuank-ops/new-api-main-copy.git
   cd new-api-main-copy
   ```

2. Change the database and Redis passwords and `SESSION_SECRET` in [`docker-compose.yml`](./docker-compose.yml). Never keep the example passwords in production.

3. Start the services:

   ```bash
   docker compose up -d
   ```

4. Open <http://localhost:3000> and create the administrator account through the setup wizard.

The default Compose configuration uses PostgreSQL and Redis. Persistent data is stored in Docker volumes and in the local `data/` and `logs/` directories.

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

- Go version as declared in [`go.mod`](./go.mod)
- [Bun](https://bun.sh/) 1.x
- Docker (recommended for PostgreSQL and Redis development environments)
- GNU Make (optional, for project shortcuts)

### Starting the Development Environment

```bash
# Start the backend, PostgreSQL and Redis
make dev-api

# Start both the default and classic frontends
make dev-web
```

The default frontend runs at <http://localhost:5173>, the Classic frontend at <http://localhost:5174>, and the backend API at <http://localhost:3000>.

You can also start them individually:

```bash
# Backend (SQLite by default; database and other settings can go in a local .env)
go run main.go

# Default frontend
cd web
bun install
cd default
bun run dev
```

## Building & Checks

```bash
# Build the default and classic frontends
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

Building the full container image builds both frontends first, then embeds the static assets into the Go service:

```bash
docker build -t new-api:local .
```

## Configuration

Common environment variables are shown in [`.env.example`](./.env.example). At minimum, review the following before deploying:

| Variable | Purpose |
| --- | --- |
| `SQL_DSN` | MySQL or PostgreSQL primary database connection string; falls back to SQLite when unset |
| `REDIS_CONN_STRING` | Redis connection string |
| `SESSION_SECRET` | Session signing secret for multi-node deployments; must be a strong random value in production |
| `PORT` | HTTP listen port, defaults to `3000` |
| `TZ` | Container or service timezone |

Do not commit `.env`, database files, credentials, cookies, access tokens, or build artifacts. The repository's [`.gitignore`](./.gitignore) already covers these common local artifacts.

## Project Layout

```text
common/       Shared config, JSON, cache, crypto and network utilities
constant/     Constants and channel types
controller/   HTTP controllers
docs/         Installation, channel and OpenAPI documentation
dto/          Request/response data structures
i18n/         Backend internationalization resources
middleware/   Auth, rate limiting, logging, CORS and other middleware
model/        GORM models, migrations and data access
oauth/        OAuth / OIDC provider implementations
relay/        Protocol conversion, billing and upstream channel adapters
router/       API, relay, dashboard and web routes
service/      Business logic
setting/      System, model, ratio, performance and other settings
web/default/  Default React 19 console
web/classic/  Classic compatibility console
```

## Documentation & Support

- [简体中文完整说明](./README.zh_CN.md)
- [OpenAPI definitions](./docs/openapi/)
- [Additional channel settings](./docs/channel/other_setting.md)
- [BT Panel installation](./docs/installation/BT.md)
- [Security policy](./.github/SECURITY.md)
- [Issues](https://github.com/juangchuank-ops/new-api-main-copy/issues)

## Contributing

Read [`AGENTS.md`](./AGENTS.md) and the relevant subdirectory conventions before submitting changes. Backend changes must remain compatible with SQLite, MySQL and PostgreSQL; user-facing frontend text must be internationalized. Pull Requests should use the [project template](./.github/PULL_REQUEST_TEMPLATE.md).

## License & Attribution

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE). Third-party components and their licenses are listed in [`THIRD-PARTY-LICENSES.md`](./THIRD-PARTY-LICENSES.md) and [`NOTICE`](./NOTICE).

The New API project and **QuantumNous** names, logos, copyright and attribution information are retained.
