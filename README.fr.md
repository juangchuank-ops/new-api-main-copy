# New API

> Une passerelle d'API IA et une plateforme de gestion d'actifs qui unifient l'accès à plusieurs services d'IA.

[![License](https://img.shields.io/badge/license-AGPL--3.0-orange.svg)](./LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25%2B-00ADD8?logo=go)](./go.mod)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](./web/default/package.json)

**Langue :** [简体中文](./README.md) · [繁體中文](./README.zh_TW.md) · [English](./README.en.md) · **Français** · [日本語](./README.ja.md)

New API est une passerelle d'API IA maintenue par **QuantumNous**. Elle expose OpenAI, Claude, Gemini, Azure, AWS Bedrock et d'autres fournisseurs en amont derrière une interface unifiée, avec gestion des canaux, routage intelligent, authentification, comptabilité des quotas et des coûts, journalisation, gestion des utilisateurs et un tableau de bord d'administration.

> [!IMPORTANT]
> Ce projet est destiné aux passerelles d'API autorisées par la loi, à l'authentification interne des organisations, à la gestion multi-modèles, aux statistiques d'utilisation, à la comptabilité des coûts et au déploiement privé. Vous devez obtenir l'accès aux services en amont de manière légitime et vous conformer aux conditions d'utilisation de ces services ainsi qu'aux lois locales applicables.

## Principales fonctionnalités

- **Interface unifiée** : compatible OpenAI, Responses, Realtime, Claude Messages, Gemini, Rerank, ainsi que plusieurs interfaces d'images, d'audio et de tâches.
- **Routage multi-canaux** : priorités et poids des canaux, nouvelle tentative en cas d'échec, mappage des modèles, clés par lot et test de disponibilité.
- **Contrôle d'accès** : JWT, OAuth, OIDC, WebAuthn/Passkey, 2FA, groupes d'utilisateurs, jetons et permissions sur les modèles.
- **Utilisation et coûts** : gestion des quotas, ratios des modèles, tarification par paliers/dynamique, rechargement et abonnement, journaux d'utilisation et tableau de bord statistique.
- **Exploitation** : SQLite, MySQL, PostgreSQL, cache Redis, déploiement multi-nœuds, contrôles de santé et supervision du système.
- **Double interface** : la console moderne `default`, plus la console `classic` qui préserve la compatibilité.
- **Internationalisation** : le backend est en chinois et en anglais ; l'interface par défaut prend en charge le chinois, l'anglais, le français, le japonais, le russe et le vietnamien.

## Architecture

```text
Router -> Controller -> Service -> Model
                         |
                         +-> Relay -> Provider adapters
```

| Couche | Technologie et répertoire |
| --- | --- |
| Backend | Go, Gin, GORM ; `router/`, `controller/`, `service/`, `model/` |
| Relais de protocole | Adaptateurs de fournisseurs dans `relay/` et `relay/channel/` |
| Interface par défaut | React 19, TypeScript, Base UI, Tailwind CSS, Rsbuild ; `web/default/` |
| Interface classique | React, Semi Design ; `web/classic/` |
| Données et cache | SQLite / MySQL / PostgreSQL, Redis |

## Démarrage rapide

### Docker Compose

1. Clonez le dépôt et entrez dans le répertoire :

   ```bash
   git clone https://github.com/juangchuank-ops/new-api-main-copy.git
   cd new-api-main-copy
   ```

2. Modifiez les mots de passe de la base de données et de Redis ainsi que `SESSION_SECRET` dans [`docker-compose.yml`](./docker-compose.yml). Ne conservez jamais les mots de passe d'exemple en production.

3. Démarrez les services :

   ```bash
   docker compose up -d
   ```

4. Ouvrez <http://localhost:3000> et créez le compte administrateur via l'assistant de configuration.

La configuration Compose par défaut utilise PostgreSQL et Redis. Les données persistantes sont stockées dans les volumes Docker et dans les répertoires locaux `data/` et `logs/`.

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

- La version de Go déclarée dans [`go.mod`](./go.mod)
- [Bun](https://bun.sh/) 1.x
- Docker (recommandé pour les environnements de développement PostgreSQL et Redis)
- GNU Make (facultatif, pour les raccourcis du projet)

### Démarrage de l'environnement de développement

```bash
# Démarre le backend, PostgreSQL et Redis
make dev-api

# Démarre les interfaces default et classic
make dev-web
```

L'interface par défaut s'exécute sur <http://localhost:5173>, l'interface classique sur <http://localhost:5174> et l'API backend sur <http://localhost:3000>.

Vous pouvez aussi les démarrer individuellement :

```bash
# Backend (SQLite par défaut ; la base de données et d'autres réglages peuvent aller dans un .env local)
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

# Tests du backend
go test ./...

# Vérifications de qualité de l'interface par défaut
cd web/default
bun run typecheck
bun run lint
bun run format:check
bun run build
```

La construction de l'image conteneur complète construit d'abord les deux interfaces, puis intègre les ressources statiques dans le service Go :

```bash
docker build -t new-api:local .
```

## Configuration

Les variables d'environnement courantes sont présentées dans [`.env.example`](./.env.example). Au minimum, vérifiez ce qui suit avant de déployer :

| Variable | Rôle |
| --- | --- |
| `SQL_DSN` | Chaîne de connexion à la base de données principale MySQL ou PostgreSQL ; se replie sur SQLite si non définie |
| `REDIS_CONN_STRING` | Chaîne de connexion Redis |
| `SESSION_SECRET` | Secret de signature de session pour les déploiements multi-nœuds ; doit être une valeur aléatoire forte en production |
| `PORT` | Port d'écoute HTTP, par défaut `3000` |
| `TZ` | Fuseau horaire du conteneur ou du service |

Ne commitez pas `.env`, les fichiers de base de données, les identifiants, les cookies, les jetons d'accès ou les artefacts de construction. Le [`.gitignore`](./.gitignore) du dépôt couvre déjà ces artefacts locaux courants.

## Structure du projet

```text
common/       Configuration partagée, JSON, cache, chiffrement et utilitaires réseau
constant/     Constantes et types de canaux
controller/   Contrôleurs HTTP
docs/         Documentation d'installation, de canaux et OpenAPI
dto/          Structures de données de requête/réponse
i18n/         Ressources d'internationalisation du backend
middleware/   Authentification, limitation de débit, journalisation, CORS et autres intergiciels
model/        Modèles GORM, migrations et accès aux données
oauth/        Implémentations des fournisseurs OAuth / OIDC
relay/        Conversion de protocole, facturation et adaptateurs de canaux en amont
router/       Routes API, relay, tableau de bord et web
service/      Logique métier
setting/      Réglages système, de modèle, de ratio, de performance et autres
web/default/  Console par défaut React 19
web/classic/  Console de compatibilité classique
```

## Documentation et support

- [Documentation complète en chinois simplifié](./README.zh_CN.md)
- [Définitions OpenAPI](./docs/openapi/)
- [Réglages supplémentaires des canaux](./docs/channel/other_setting.md)
- [Installation via le panneau BT](./docs/installation/BT.md)
- [Politique de sécurité](./.github/SECURITY.md)
- [Problèmes](https://github.com/juangchuank-ops/new-api-main-copy/issues)

## Contribution

Lisez [`AGENTS.md`](./AGENTS.md) et les conventions des sous-répertoires concernés avant de soumettre des modifications. Les modifications du backend doivent rester compatibles avec SQLite, MySQL et PostgreSQL ; le texte d'interface destiné aux utilisateurs doit être internationalisé. Les pull requests doivent utiliser le [modèle du projet](./.github/PULL_REQUEST_TEMPLATE.md).

## Licence et attribution

Ce projet est sous licence [GNU Affero General Public License v3.0](./LICENSE). Les composants tiers et leurs licences sont listés dans [`THIRD-PARTY-LICENSES.md`](./THIRD-PARTY-LICENSES.md) et [`NOTICE`](./NOTICE).

Les noms, logos, droits d'auteur et informations d'attribution du projet New API et de **QuantumNous** sont conservés.
