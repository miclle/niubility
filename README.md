# Niubility

[English](./README.md) | [中文](./README.zh-CN.md)

Niubility is an internal learning and culture platform for enterprises. It combines content publishing, browsing, social interaction, administration, and enterprise integrations in a single Go + React application, with a companion CLI for terminal workflows.

## Overview

Niubility is designed for internal knowledge sharing, training delivery, and culture communication inside organizations. The current codebase includes:

- Four content types: `video`, `gallery`, `article`, and `podcast`
- Social features such as comments, likes, favorites, follows, and view history
- Admin management for users, categories, contents, site settings, storage, authentication, WeCom sync, database backups, and service nodes
- Optional enterprise integrations including OIDC / SAML SSO, S3-compatible object storage, and WeCom department/user sync
- A standalone CLI project under [`cli/`](./cli/) for login, browsing, publishing articles, and common management operations

The backend embeds the frontend build output into the server binary, so production deployment is typically a single executable plus a database and optional object storage.

## Current Capabilities

- Content publishing and browsing for `video`, `gallery`, `article`, and `podcast`
- Rich article editing with Tiptap and media playback with Video.js
- Comments, likes, favorites, follows, and personal history views
- User profiles, following feed, and profile content/favorite/follower pages
- Admin pages for users, categories, content moderation, site settings, auth settings, storage and delivery settings, WeCom sync, database backups, and service node monitoring
- Password login plus optional OIDC / SAML 2.0 SSO
- S3-compatible upload flow with configurable delivery URLs and image styles
- Runtime settings stored in the `settings` table, with encrypted storage and masked responses for sensitive values
- PostgreSQL (default) and MySQL support
- CLI support for password login and browser-based SSO, content listing/viewing, article publishing, category/user/settings management, and related operations

## Tech Stack

- Backend: Go 1.25, `fox-gonic/fox`, GORM
- Database: PostgreSQL (default) / MySQL
- Frontend: React 18, TypeScript 5, Vite 6, Tailwind CSS 4, shadcn/ui 4
  - React Router v7
  - React Query v5
  - Tiptap v2
  - Video.js v8
  - dnd-kit v6
- Integrations: OIDC, SAML 2.0, WeCom, S3-compatible object storage
- CLI: Go, cobra, viper

## Requirements

- Go 1.25+
- Node.js 22.14+
- PostgreSQL or MySQL
- [Task](https://taskfile.dev/)
- `reflex` for `task dev` hot reload
- `golangci-lint` for `task check`
- `pg_dump` or `mysqldump` if you plan to use database backup features

## Local Setup

```bash
git clone https://github.com/miclle/niubility.git
cd Niubility
task install
```

Create local config:

```bash
cp cmd/niubility/config.example.yaml cmd/niubility/config.local.yaml
```

The YAML file only keeps bootstrap configuration:

- `server.address`: listen address
- `database.driver`: `postgres` (default) or `mysql`
- `database.dsn`: database connection string

Most runtime settings are loaded from the `settings` table after startup, including:

- JWT signing secret and encryption key
- registration toggle and cookie security
- SSO settings
- S3 storage settings
- asset delivery settings
- site branding
- WeCom sync settings
- database backup behavior

Start development:

```bash
task dev
```

On the first launch, visit `/init` to create the initial super admin account.

## Common Commands

```bash
task install        # Install Go, CLI, and frontend dependencies
task dev            # Start Vite + Go hot reload
task build          # Build the server binary with embedded frontend
task build-all      # Cross-build server binaries
task run            # Run the server with local config
task lint           # Auto-fix Go/CLI style and run frontend lint
task check          # CI-aligned checks without rewriting files
task test           # Go tests with race detection and coverage
task clean          # Remove build artifacts
task update-tools   # Install/update dev tools
task build-cli      # Build the standalone CLI
task build-cli-all  # Cross-build the CLI
```

## Build and Deployment

Build production binary:

```bash
task build
```

Run locally in non-hot-reload mode:

```bash
task run
```

Before production rollout, confirm:

- database connectivity is correct
- HTTPS and reverse proxy settings are in place
- S3 / delivery / WeCom / SSO settings are configured if needed
- `pg_dump` or `mysqldump` is available on hosts that need admin-triggered database backups
- node heartbeat environment variables are configured if you want service node visibility in admin pages

The server reports its current node heartbeat automatically. These environment variables are optional:

- `NIUBILITY_NODE_ID`
- `NIUBILITY_NODE_TYPE` (`web`, `worker`, `scheduler`; default `web`)
- `NIUBILITY_NODE_SERVICE_NAME`
- `NIUBILITY_NODE_DISPLAY_NAME`
- `NIUBILITY_NODE_VERSION`
- `NIUBILITY_NODE_ENV`
- `NIUBILITY_NODE_REGION`
- `NIUBILITY_NODE_ZONE`
- `NIUBILITY_NODE_CAPABILITIES`

## CLI

The repository includes a standalone CLI in [`cli/`](./cli/). Current implemented areas include:

- `login`, `logout`, `whoami`
- `content list`, `content view`, `content create article`, `content edit`, `content delete`
- category management
- user management
- profile, comment, favorite, follow, like, and settings commands
- isolated profiles and localized CLI output

Current limitation: content creation/editing in the CLI is article-focused. `gallery`, `video`, and `podcast` exist in the platform but are not yet first-class CLI publish flows.

See:

- [CLI README](./cli/README.md)
- [CLI Design](./docs/cli-design.md)
- [CLI SSO Login Design](./docs/cli-sso-login-design.md)

## Documentation

- [Features](./docs/features.md)
- [Roadmap](./docs/roadmap.md)
- [CLI Design](./docs/cli-design.md)
- [CLI SSO Login Design](./docs/cli-sso-login-design.md)
- [Content Moderation and Visibility Design](./docs/content-moderation-design.md)
- [Database Backup](./docs/database-backup-design.md)
- [WeCom OAuth](./docs/wechat-oauth.md)

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
