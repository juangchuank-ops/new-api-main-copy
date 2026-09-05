# New API

> Une passerelle API unifiée et une plateforme de gestion d'actifs pour plusieurs services d'IA.

[![License](https://img.shields.io/badge/license-AGPL--3.0-orange.svg)](./LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25%2B-00ADD8?logo=go)](./go.mod)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](./web/default/package.json)

**Langue :** [简体中文](./README.md) · [繁體中文](./README.zh_TW.md) · [English](./README.en.md) · **Français** · [日本語](./README.ja.md)

New API est une passerelle d'API IA maintenue par **QuantumNous**. Elle connecte plus de 40 services en amont (OpenAI, Claude, Gemini, Azure, AWS Bedrock, etc.) derrière une interface unifiée et offre la gestion des canaux, le routage intelligent, l'authentification, la gestion des quotas et des coûts, la journalisation, la gestion des utilisateurs et des consoles d'administration à double interface.

> [!IMPORTANT]
> Ce projet est destiné uniquement aux passerelles API légalement autorisées, à l'authentification interne des organisations, à la gestion multi-modèles, au suivi d'utilisation, à la comptabilité des coûts et aux déploiements privés. Les utilisateurs doivent obtenir les autorisations des services en amont de manière légale et respecter les conditions des fournisseurs ainsi que les lois et réglementations locales.

## Fonctionnalités principales

- **Interface unifiée** : prend en charge OpenAI Compatible, Responses, Realtime, Claude Messages, Gemini, Rerank et de nombreuses interfaces d'images, d'audio, de vidéo et de tâches.
- **Routage multi-canaux** : plus de 40 adaptateurs de fournisseurs en amont, priorité et pondération des canaux, nouvelle tentative en cas d'échec, mappage des modèles, clés par lot, tests de disponibilité et affinité des canaux.
- **Contrôle d'accès** : JWT, OAuth, OIDC, WebAuthn/Passkey, 2FA, groupes d'utilisateurs, autorisations de jetons et de modèles, liste noire d'adresses IP, liste noire d'empreintes de navigateur et blocage automatique.
- **Utilisation et coûts** : gestion des quotas, multiplicateurs de modèles, tarification par paliers/dynamique (facturation par expressions), recharges et abonnements, journaux d'utilisation, tableaux de bord statistiques et classements.
- **Fonctionnalités à valeur ajoutée** : check-in quotidien, codes d'invitation, codes d'échange, transferts, recharges de solde, plans d'abonnement, centre de jeux (Texas Hold'em, simulation boursière/de contrats à terme, démineur, etc.).
- **Capacités opérationnelles** : SQLite, MySQL, PostgreSQL, base de journaux ClickHouse, cache Redis, déploiement multi-nœuds, vérifications de santé, supervision système et métriques de performance.
- **Double interface** : console `default` moderne (React 19 + Tailwind) et console `classic` compatible (Semi Design).
- **Internationalisation** : le backend prend en charge le chinois et l'anglais ; l'interface par défaut prend en charge le chinois, l'anglais, le français, le japonais, le russe et le vietnamien.

## Architecture

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

| Couche | Technologies et répertoires |
| --- | --- |
| Backend | Go 1.25, Gin, GORM ; `router/`, `controller/`, `service/`, `model/` |
| Relais de protocole | adaptateurs de fournisseurs `relay/` et `relay/channel/` ; module de conversion de protocole indépendant `relaykit/` |
| Interface par défaut | React 19, TypeScript, Base UI, Tailwind CSS, Rsbuild ; `web/default/` |
| Interface classique | React, Semi Design ; `web/classic/` |
| Données et cache | SQLite / MySQL / PostgreSQL, base de journaux ClickHouse, Redis |

## Déploiement rapide

### Docker Compose

1. Clonez le dépôt et entrez dans le répertoire :

   ```bash
   git clone https://github.com/juangchuank-ops/new-api-main-copy.git
   cd new-api-main-copy
   ```

2. Modifiez [`docker-compose.yml`](./docker-compose.yml) pour définir la base de données, le mot de passe Redis et `SESSION_SECRET`. N'utilisez pas les mots de passe de l'exemple en production.

3. Démarrez les services :

   ```bash
   docker compose up -d
   ```

4. Ouvrez <http://localhost:3000> et suivez l'assistant d'initialisation pour créer un administrateur.

La configuration Compose par défaut utilise PostgreSQL et Redis. Les volumes de stockage ainsi que les répertoires locaux `data/` et `logs/` conservent les données persistantes.

### Conteneur unique (SQLite)

```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v "$(pwd)/data:/data" \
  calciumion/new-api:latest
```

## Développement local

### Prérequis

- Version de Go indiquée dans [`go.mod`](./go.mod)
- [Bun](https://bun.sh/) 1.x
- Docker (recommandé pour l'environnement de développement PostgreSQL et Redis)
- GNU Make (optionnel, pour les commandes rapides du projet)

### Démarrage de l'environnement de développement

```bash
# Démarre le backend, PostgreSQL et Redis
make dev-api

# Démarre les interfaces default et classic
make dev-web
```

L'interface par défaut est à l'adresse <http://localhost:5173>, l'interface Classic à <http://localhost:5174> et l'API backend à <http://localhost:3000>.

Vous pouvez aussi les lancer séparément :

```bash
# Backend (utilise SQLite par défaut ; base de données et autres réglages dans .env local)
go run main.go

# Interface par défaut
cd web
bun install
cd default
bun run dev
```

## Construction et vérifications

```bash
# Construit les interfaces default et classic
make build-all-frontends

# Tests backend
go test ./...

# Contrôle qualité de l'interface par défaut
cd web/default
bun run typecheck
bun run lint
bun run format:check
bun run build
```

La construction complète de l'image conteneur construit les deux interfaces successivement, puis intègre les ressources statiques dans le service Go :

```bash
docker build -t new-api:local .
```

## Configuration

Des exemples de variables d'environnement figurent dans [`.env.example`](./.env.example). Avant le déploiement, vérifiez au moins :

| Variable | Utilité |
| --- | --- |
| `SQL_DSN` | Chaîne de connexion de la base principale MySQL ou PostgreSQL ; utilise SQLite si non définie |
| `LOG_SQL_DSN` | Chaîne de connexion de la base de journaux ClickHouse ou MySQL (optionnel) |
| `REDIS_CONN_STRING` | Chaîne de connexion Redis |
| `SESSION_SECRET` | Clé de signature de session multi-nœuds ; doit être une valeur aléatoire forte en production |
| `PORT` | Port d'écoute HTTP, défini par défaut à `3000` |
| `TZ` | Fuseau horaire du conteneur ou du service |
| `NODE_TYPE` | Rôle multi-nœuds ; `master` pour le nœud principal |

Ne committez pas `.env`, les fichiers de base de données, les identifiants de connexion, les cookies, les jetons d'accès ou les artefacts de construction. Le [`.gitignore`](./.gitignore) du dépôt couvre ces artefacts locaux courants.

## Répertoire du projet

```text
common/        Utilitaires de configuration, JSON, cache, chiffrement et réseau
constant/      Constantes et types de canaux (types d'API, types de canaux, types de points de terminaison, etc.)
controller/    Contrôleurs HTTP (utilisateurs, canaux, jetons, recharges, abonnements, classements, etc.)
docs/          Documentation d'installation, de canaux, OpenAPI et manifeste fichier par fichier
dto/           Structures de données de requête et de réponse
i18n/          Ressources d'internationalisation du backend
logger/        Package de journalisation par niveaux
middleware/    Authentification, limitation de débit, journalisation, CORS et autres intergiciels
model/         Modèles GORM, migrations et accès aux données
oauth/         Implémentations des fournisseurs OAuth / OIDC
relay/         Conversion de protocole, facturation et adaptation des canaux en amont
relaykit/      Module Go autonome (DTO de protocole et conversion de formats)
router/        Routes API, Relay, Dashboard et Web
service/       Logique métier
setting/       Configuration système, modèles, multiplicateurs, facturation, performances, etc.
types/         Définitions de types
pkg/           Packages internes réutilisables (billingexpr, cachex, ionet, etc.)
web/default/   Console React 19 par défaut
web/classic/   Console de compatibilité Classic
docs/file-map.md  Manifeste fichier par fichier : rôle de chaque fichier Go du backend
```

Pour les responsabilités principales de chaque répertoire et les descriptions fichier par fichier, consultez le [**Manifeste fichier par fichier (docs/file-map.md)**](./docs/file-map.md).

## Documentation et support

- [Manifeste fichier par fichier](./docs/file-map.md)
- [Mise à jour de la bannière publique de l'accueil Classic](./docs/updates/classic-public-banners.md)
- [Documentation complète en chinois simplifié](./README.zh_CN.md)
- [Définitions OpenAPI](./docs/openapi/)
- [Notes de configuration des canaux](./docs/channel/other_setting.md)
- [Installation avec panneau BT](./docs/installation/BT.md)
- [Politique de sécurité](./.github/SECURITY.md)
- [Suivi des problèmes](https://github.com/juangchuank-ops/new-api-main-copy/issues)

## Contribution

Avant de soumettre des modifications, lisez [`AGENTS.md`](./AGENTS.md) et les conventions des sous-répertoires concernés. Les changements du backend doivent être compatibles avec SQLite, MySQL et PostgreSQL ; les textes visibles de l'interface doivent être internationalisés. Utilisez le [modèle de projet](./.github/PULL_REQUEST_TEMPLATE.md) pour les pull requests.

## Licence et attribution

Ce projet est sous licence [GNU Affero General Public License v3.0](./LICENSE). Les composants tiers et leurs licences figurent dans [`THIRD-PARTY-LICENSES.md`](./THIRD-PARTY-LICENSES.md) et [`NOTICE`](./NOTICE).

Le projet New API ainsi que les noms, marques, droits d'auteur et informations d'attribution liés à **QuantumNous** sont conservés.