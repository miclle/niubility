# Niubility

[English](./README.md) | [中文](./README.zh-CN.md)

Niubility is an internal learning and culture platform for enterprises. It helps teams manage training videos, editorial content, knowledge sharing, and culture-focused communication in one place, with enterprise-ready authentication, storage, and organization sync capabilities.

## Overview

Niubility is designed for internal knowledge sharing and content distribution inside organizations. It provides an integrated workflow covering content publishing, discovery, engagement, and administrative management.

The project uses a Go + React stack and supports integrated full-stack builds, making it suitable for fast deployment in private networks or cloud environments. In addition to standard content platform features, it includes enterprise-oriented capabilities such as optional SSO, S3-compatible object storage, WeCom synchronization, and runtime configuration managed through the admin console. A companion CLI tool is also available for content publishing and management from the terminal.

## Features

- Content publishing and browsing for videos, galleries, and articles, with a rich text editor (Tiptap) and video player (Video.js).
- Social engagement including comments, likes, favorites, and follows.
- Admin management for content, categories, users, and system settings.
- Enterprise authentication with password login and optional OIDC or SAML 2.0 SSO.
- WeCom synchronization for departments and users.
- S3-compatible object storage integration for upload and asset access, with configurable asset delivery.
- Secure runtime configuration with AES-256-GCM encrypted storage and masked output for sensitive values.
- Share content via copyable links and messages.
- Multi-database support: PostgreSQL (default) and MySQL.
- CLI tool for terminal-based content publishing and management.

## Tech Stack

- Backend: Go 1.25, `fox-gonic/fox`, GORM, PostgreSQL / MySQL
- Frontend: React 18, TypeScript 5, Vite 6, Tailwind CSS 4, shadcn/ui 4
  - React Router v7, React Query v5, Tiptap v2, Video.js v8, dnd-kit, Lucide React, dayjs
- Authentication: password login, JWT cookies, optional OIDC / SAML 2.0
- Storage: S3-compatible object storage
- Integration: WeCom department and user sync
- CLI: Go, cobra, viper

## Requirements

- Go 1.25 or later
- Node.js 22.14 or later
- PostgreSQL or MySQL
- [Task](https://taskfile.dev/)
- [reflex](https://github.com/cespare/reflex) for hot reload in development

## Installation and Local Setup

```bash
git clone https://github.com/miclle/niubility.git
cd Niubility
task install
```

Copy the config template and update the database connection:

```bash
cp cmd/niubility/config.example.yaml cmd/niubility/config.local.yaml
```

`cmd/niubility/config.local.yaml` only needs the basic startup settings:

- `server.address`: server listen address
- `database.driver`: database driver, `postgres` (default) or `mysql`
- `database.dsn`: database connection string

All other runtime settings, such as JWT secrets, encryption keys, SSO, S3, and WeCom integration, are configured from the admin console after the first startup. Sensitive values are not exposed in plain text.

Start the development environment:

```bash
task dev
```

On the first launch, the system guides you through creating the initial super admin account.

## Common Commands

```bash
task install        # Install dependencies
task dev            # Start development environment (hot reload)
task build          # Build production binary (includes frontend)
task build-all      # Build for all platforms
task run            # Run in production mode
task lint           # Code linting (gofmt, vet, staticcheck)
task check          # Full check (lint + frontend types + mod tidy)
task test           # Run tests with race detection
task clean          # Clean build artifacts
task update-tools   # Update development tools
task build-cli      # Build CLI tool
task build-cli-all  # Build CLI for all platforms
```

## Deployment

### Production Build

```bash
task build
```

The build output is a backend binary with the frontend assets embedded, ready for deployment.

### Production Run

```bash
task run
```

Before going live, make sure:

- PostgreSQL or MySQL is reachable and the connection string is correct.
- The application has the required access to local upload paths or object storage.
- Your reverse proxy, load balancer, or gateway forwards traffic correctly.
- SSO, S3, and WeCom are configured in the admin console if you plan to use them.
- The service is exposed over HTTPS in production to protect sessions and callback flows.

### Recommended Deployment Flow

1. Prepare the database (PostgreSQL or MySQL).
2. Configure `cmd/niubility/config.local.yaml`.
3. Run `task build` to generate the executable.
4. Run the service with systemd, Supervisor, containers, or your preferred process manager.
5. Create the initial super admin after first access.
6. Complete runtime configuration such as SSO, object storage, and WeCom in the admin console.

## CLI Tool

Niubility includes a companion CLI tool for terminal-based content publishing and management. See [docs/cli-design.md](./docs/cli-design.md) for the full design document and [docs/roadmap.md](./docs/roadmap.md) for the current implementation status.

## Optional Integrations

- SSO for centralized identity management with OIDC and SAML 2.0 support.
- S3-compatible storage for uploads and asset delivery.
- WeCom sync for organization structure and user provisioning.
- Configurable asset delivery with support for signed URLs and CDN integration.

## Documentation

- [Features](./docs/features.md) — complete feature list and status
- [Roadmap](./docs/roadmap.md) — planned and in-progress items
- [CLI Design](./docs/cli-design.md) — CLI tool design and implementation plan
- [CLI SSO Login Design](./docs/cli-sso-login-design.md) — SSO authentication flow for CLI
- [WeCom OAuth](./docs/wechat-oauth.md) — WeCom OAuth2 auto-login design

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
