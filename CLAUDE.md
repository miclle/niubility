# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Niubility is an internal learning and culture platform for Qiniu (七牛), combining features similar to Bilibili (learning/sharing) and Xiaohongshu (corporate culture). It supports video and article content with categories for learning materials and culture content.

## Tech Stack

- **Backend**: Go 1.24 + [fox-gonic/fox](https://github.com/fox-gonic/fox) (Gin fork) + GORM + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) (Base UI)
- **Auth**: Password login + optional SSO + JWT (cookie-based)
- **Integration**: WeChat Work (企业微信) for department/user sync (optional, configured via admin settings)

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
├── config.example.yaml      # Configuration template (only server.address + database.dsn)
└── config.local.yaml        # Local config (gitignored)
internal/
├── config/                  # Configuration loading (YAML via Viper, minimal: server + database)
├── entity/                  # Data models (User, Content, Department, Setting)
├── handler/                 # HTTP handlers, route registration, middleware
│   ├── handler.go           # Ctrl struct, route registration
│   ├── middleware.go         # AuthMiddleware, RequireAdmin
│   ├── auth.go              # Login, Register, JWT helpers
│   ├── init.go              # System initialization handler
│   ├── user.go              # SSO callback, Boot, Logout, user CRUD, sync
│   ├── content.go           # Content CRUD
│   └── setting.go           # Settings CRUD
├── service/                 # Business logic and database operations
│   ├── service.go           # Service init (auto-generates keys, loads from DB)
│   ├── user.go              # User CRUD, auth, registration, super admin init
│   ├── setting.go           # Settings with encryption for sensitive values
│   ├── content.go           # Content operations
│   └── department.go        # Department operations
└── website/                 # React frontend (Vite + TypeScript)
    └── src/
        ├── api/             # API client functions (client.ts, content.ts, user.ts, setting.ts)
        ├── components/      # Reusable UI components (ui/ for shadcn/ui components)
        ├── context/         # React Context (app-level state)
        ├── layouts/         # MainLayout, AdminLayout
        ├── types/           # TypeScript type definitions
        ├── views/           # Page components
        │   ├── init/        # System initialization page
        │   ├── login/       # Login page
        │   ├── register/    # User registration page
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
- **Minimal config**: Only `server.address` and `database.dsn` in YAML; all other settings (JWT secret, encryption key, SSO, WeChat, etc.) are stored in the `settings` database table
- JWT secret and encryption key are auto-generated on first boot and persisted in database
- Sensitive settings (SSO secret, WeChat secret) encrypted with AES-256-GCM in database
- System initialization flow: first deployment requires super admin setup via `/api/v1/init`

### Frontend
- React Router with layouts (MainLayout for users, AdminLayout for admin)
- shadcn/ui components (Base UI primitives) in `src/components/ui/`
- App context (`src/context/app.ts`) for global state (current user, initialized, SSO/registration flags)
- API calls via axios client in `src/api/client.ts`
- Two content categories: `learning` and `culture`, accessible via `/learning` and `/culture` routes
- Boot flow: `/api/v1/boot` → if not initialized → `/init`; if not logged in → `/login`

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| User | `users` | User accounts with role (super_admin/admin/user), password (bcrypt), and status (activated/deactivated) |
| Content | `contents` | Articles and videos with category (learning/culture) |
| Department | `departments` | Departments synced from WeChat Work |
| Setting | `settings` | Key-value configuration (JWT secret, encryption key, SSO, WeChat, feature flags, etc.) |

## User Roles

| Role | Description |
|------|-------------|
| `super_admin` | Created during system initialization, full access |
| `admin` | Administrator, can manage content and users |
| `user` | Regular user, can view content |

## Content Types

- `article`: Text + images content
- `video`: Video content with optional cover image

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/health` | GET | Public | Health check |
| `/sso` | GET | Public | SSO callback (only when SSO enabled) |
| `/logout` | GET | Public | Logout |
| `/api/v1/boot` | GET | Public | System state + auth state |
| `/api/v1/init` | POST | Public | Initialize super admin (first boot only) |
| `/api/v1/login` | POST | Public | Username + password login |
| `/api/v1/register` | POST | Public | User registration (when enabled) |
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
| `/init` | None | Init | System initialization (first boot) |
| `/login` | None | Login | User login |
| `/register` | None | Register | User registration (when enabled) |
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
- `database.dsn`: PostgreSQL connection string

All other configuration (JWT secret, encryption key, SSO, WeChat, feature flags) is managed through the admin settings UI and stored in the database. JWT secret and encryption key are auto-generated on first boot.
