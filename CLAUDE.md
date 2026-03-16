# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Niubility is an internal learning and culture platform for Qiniu (七牛), combining features similar to Bilibili (learning/sharing) and Xiaohongshu (corporate culture). It supports video and article content with categories for learning materials and culture content.

## Tech Stack

- **Backend**: Go 1.24 + [fox-gonic/fox](https://github.com/fox-gonic/fox) (Gin fork) + GORM + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) (Base UI)
- **Auth**: SSO + JWT (cookie-based)
- **Integration**: WeChat Work (企业微信) for department/user sync

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
cmd/server/
├── main.go                  # Entry point, loads config and starts server
├── config.example.yaml      # Configuration template
└── config.local.yaml        # Local config (gitignored)
internal/
├── config/                  # Configuration loading (YAML via Viper)
├── entity/                  # Data models (User, Content, Department, Setting)
├── handler/                 # HTTP handlers, route registration, middleware
├── service/                 # Business logic and database operations
└── website/                 # React frontend (Vite + TypeScript)
    └── src/
        ├── api/             # API client functions (client.ts, content.ts, user.ts, setting.ts)
        ├── components/      # Reusable UI components (ui/ for shadcn/ui components)
        ├── context/         # React Context (app-level state)
        ├── layouts/         # MainLayout, AdminLayout
        ├── types/           # TypeScript type definitions
        ├── views/           # Page components
        │   ├── home/        # Home page (content list for learning/culture)
        │   ├── contents/    # Content detail & editor
        │   ├── admin/       # Admin pages (contents, users, import, sync, settings)
        │   └── errors/      # Error pages (403, 404, 500)
        └── router.tsx       # Route definitions
pkg/
├── sso/                     # SSO authentication package
└── textencrypt/             # Text encryption (AES-256-GCM for sensitive config)
```

## Key Patterns

### Backend
- Handler → Service → Entity layering
- GORM auto-migration for database schema
- Routes in `handler/handler.go` with middleware for auth (`AuthMiddleware`) and admin checks (`RequireAdmin`)
- Admin routes grouped under `/api/v1/admin/` with `RequireAdmin` middleware
- Configuration via YAML file (`cmd/server/config.local.yaml`) loaded by Viper
- Sensitive settings (WeChat secrets) encrypted with AES-256-GCM in database

### Frontend
- React Router with layouts (MainLayout for users, AdminLayout for admin)
- shadcn/ui components (Base UI primitives) in `src/components/ui/`
- App context (`src/context/app.ts`) for global state (current user)
- API calls via axios client in `src/api/client.ts`
- Two content categories: `learning` and `culture`, accessible via `/learning` and `/culture` routes

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| User | `users` | User accounts with role (admin/user) and status (activated/deactivated) |
| Content | `contents` | Articles and videos with category (learning/culture) |
| Department | `departments` | Departments synced from WeChat Work |
| Setting | `settings` | Key-value configuration (WeChat credentials, etc.) |

## Content Types

- `article`: Text + images content
- `video`: Video content with optional cover image

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/health` | GET | Public | Health check |
| `/sso` | GET | Public | SSO callback |
| `/logout` | GET | Public | Logout |
| `/api/v1/boot` | GET | Authenticated | Boot info (current user) |
| `/api/v1/contents` | GET | Authenticated | List contents |
| `/api/v1/contents/:id` | GET | Authenticated | Get content |
| `/api/v1/contents` | POST | Admin | Create content |
| `/api/v1/contents/:id` | PUT/DELETE | Admin | Update/Delete content |
| `/api/v1/import` | POST | Admin | Import legacy data |
| `/api/v1/admin/users` | GET | Admin | List users |
| `/api/v1/admin/users/:id` | PATCH | Admin | Update user |
| `/api/v1/admin/departments` | GET | Admin | List departments |
| `/api/v1/admin/settings` | GET/PATCH | Admin | Manage settings |
| `/api/v1/admin/sync-wechat` | POST | Admin | Sync from WeChat Work |

## Frontend Routes

| Path | Layout | Component | Description |
|------|--------|-----------|-------------|
| `/learning` | MainLayout | Home | Learning content list |
| `/culture` | MainLayout | Home | Culture content list |
| `/contents/:id` | MainLayout | ContentDetail | Content detail page |
| `/contents/new` | MainLayout | ContentEditor | Create content |
| `/contents/:id/edit` | MainLayout | ContentEditor | Edit content |
| `/admin/contents` | AdminLayout | AdminContents | Content management |
| `/admin/contents/new` | AdminLayout | AdminContentEditor | Create content (admin) |
| `/admin/contents/:id` | AdminLayout | AdminContentEditor | Edit content (admin) |
| `/admin/users` | AdminLayout | AdminUsers | User management |
| `/admin/import` | AdminLayout | AdminImport | Data import |
| `/admin/sync` | AdminLayout | AdminSync | WeChat sync |
| `/admin/settings` | AdminLayout | AdminSettings | System settings |

## Configuration

Copy `cmd/server/config.example.yaml` to `cmd/server/config.local.yaml` and configure:
- `server.address`: Listen address (e.g., `0.0.0.0:9000`)
- `server.secret`: JWT signing secret
- `server.cookieSecure`: Enable Secure flag on cookies (set true for HTTPS)
- `server.encryptionKey`: 32-byte hex key for AES-256-GCM encryption (generate with `openssl rand -hex 32`)
- `database.dsn`: PostgreSQL connection string
- `sso`: SSO provider settings (host, clientID, secret)
