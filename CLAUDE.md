# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Niubility is an internal learning and culture platform for Qiniu (七牛), combining features similar to Bilibili (learning/sharing) and Xiaohongshu (corporate culture). It supports video and article content with categories for learning materials and culture content.

## Tech Stack

- **Backend**: Go 1.24 + [fox-gonic/fox](https://github.com/fox-gonic/fox) (Gin fork) + GORM + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4 + Radix UI
- **Auth**: SSO + JWT (cookie-based)

## Development Commands

```bash
# Start development server (Vite + Go with hot-reload via reflex)
task dev

# Build production binary (includes embedded frontend)
task build

# Run production server (requires task build first)
task run

# Format Go code
task fmt

# Go vet
task vet

# Install frontend dependencies only
task website:install

# Build frontend only
task website:build
```

## Architecture

```
cmd/server/main.go          # Entry point, loads config and starts server
internal/
├── config/                  # Configuration loading (YAML via viper)
├── entity/                  # Data models (User, Content) with GORM tags
├── handler/                 # HTTP handlers, route registration, middleware
├── service/                 # Business logic and database operations
└── website/                 # React frontend (Vite + TypeScript)
    └── src/
        ├── api/             # API client functions
        ├── components/      # Reusable UI components
        ├── layouts/         # MainLayout, AdminLayout
        ├── views/           # Page components (home, admin, errors)
        └── router.tsx       # Route definitions
pkg/sso/                     # SSO authentication package
```

## Key Patterns

### Backend
- Handler → Service → Entity layering
- GORM auto-migration for database schema
- Routes in `handler/handler.go` with middleware for auth (`AuthMiddleware`) and admin checks (`RequireAdmin`)
- Configuration via YAML file (`cmd/server/config.local.yaml`)

### Frontend
- React Router with layouts (MainLayout for users, AdminLayout for admin)
- Outlet context for passing filter state from layout to pages
- API calls via axios client in `src/api/client.ts`
- Two content categories: `learning` and `culture`, accessible via `/learning` and `/culture` routes

## Content Types

- `article`: Text + images content
- `video`: Video content with optional cover image

## API Routes

| Route | Method | Auth |
|-------|--------|------|
| `/api/v1/contents` | GET | All users |
| `/api/v1/contents/:id` | GET | All users |
| `/api/v1/contents` | POST | Admin only |
| `/api/v1/contents/:id` | PUT/DELETE | Admin only |
| `/api/v1/import` | POST | Admin only |
| `/api/v1/users` | GET/PATCH | Admin only |
| `/sso` | GET | SSO callback |
| `/logout` | GET | Logout |

## Configuration

Copy `cmd/server/config.example.yaml` to `cmd/server/config.local.yaml` and configure:
- `server.address`: Listen address (e.g., `0.0.0.0:9000`)
- `server.secret`: JWT signing secret
- `database.dsn`: PostgreSQL connection string
- `sso`: SSO provider settings
