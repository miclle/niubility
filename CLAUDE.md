# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Niubility is an internal learning and culture platform for Qiniu (七牛), combining features similar to Bilibili (learning/sharing) and Xiaohongshu (corporate culture). It supports video and article content with dynamic categories, comments, likes, and file uploads.

## Tech Stack

- **Backend**: Go 1.25 + [fox-gonic/fox](https://github.com/fox-gonic/fox) (Gin fork) + GORM + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) (Base UI)
- **Auth**: Password login + optional SSO (OIDC / SAML 2.0) + JWT (cookie-based)
- **Storage**: S3-compatible object storage for file uploads (configurable via admin settings)
- **Integration**: WeChat Work (企业微信) for department/user sync (optional, configured via admin settings)

## Development Commands

```bash
# Install all dependencies (Go modules + frontend)
task install

# Start development server (Vite + Go with hot-reload via reflex)
task dev

# Build production binary (includes embedded frontend)
task build

# Run production server (requires task build first)
task run

# Auto-fix code style (go mod tidy + gofmt + vet + staticcheck)
task lint

# Run all checks without modifying files (CI-friendly)
task check

# Run Go tests with race detection and coverage
task test

# Clean build artifacts
task clean

# Install/update development tools (reflex, staticcheck)
task update-tools
```

## Architecture

```
cmd/niubility/
├── main.go                  # Entry point, loads config and starts server
├── config.example.yaml      # Configuration template (only server.address + database.dsn)
└── config.local.yaml        # Local config (gitignored)
internal/
├── config/                  # Configuration loading (YAML via Viper, minimal: server + database)
├── entity/                  # Data models (User, Content, Comment, Like, Category, Department, Setting)
├── handler/                 # HTTP handlers, route registration, middleware
│   ├── handler.go           # Ctrl struct, route registration
│   ├── middleware.go         # AuthMiddleware, RequireAdmin
│   ├── auth.go              # Login, Register, JWT helpers
│   ├── init.go              # System initialization handler
│   ├── user.go              # SSO callbacks (OIDC/SAML), Boot, Logout, user CRUD, sync
│   ├── content.go           # Content CRUD
│   ├── comment.go           # Comment CRUD
│   ├── category.go          # Category CRUD and reorder
│   ├── upload.go            # S3 presigned URL and file access
│   └── setting.go           # Settings CRUD
├── service/                 # Business logic and database operations
│   ├── service.go           # Service init (auto-generates keys, loads from DB)
│   ├── user.go              # User CRUD, auth, registration, super admin init
│   ├── setting.go           # Settings with encryption for sensitive values
│   ├── content.go           # Content operations
│   ├── comment.go           # Comment operations
│   ├── like.go              # Like operations (content + comment)
│   ├── category.go          # Category CRUD and seeding
│   ├── upload.go            # S3 presigned URL generation
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
        │   ├── home/        # Home page (content list by category)
        │   ├── contents/    # Content detail & editor
        │   ├── admin/       # Admin pages
        │   │   ├── contents/    # Content management
        │   │   ├── users/       # User management
        │   │   ├── categories/  # Category management (drag-and-drop reorder)
        │   │   ├── import/      # Legacy data import
        │   │   ├── sync/        # WeChat sync
        │   │   └── settings/    # System settings (auth, storage, wechat sub-pages)
        │   └── errors/      # Error pages (403, 404, 500)
        └── router.tsx       # Route definitions
pkg/
├── sso/                     # SSO authentication (Provider interface + OIDC + SAML 2.0)
└── textencrypt/             # Text encryption (AES-256-GCM for sensitive config)
docs/
├── requirement.md           # Product requirement document
└── qiniu-sso-saml-guide.md # Qiniu SSO SAML 2.0 configuration guide
```

## Key Patterns

### Backend
- Handler → Service → Entity layering
- GORM auto-migration for database schema
- Routes in `handler/handler.go` with middleware for auth (`AuthMiddleware`) and admin checks (`RequireAdmin`)
- Admin routes grouped under `/api/v1/admin/` with `RequireAdmin` middleware
- **Minimal config**: Only `server.address` and `database.dsn` in YAML; all other settings (JWT secret, encryption key, SSO, WeChat, S3, etc.) are stored in the `settings` database table
- JWT secret and encryption key are auto-generated on first boot and persisted in database
- Sensitive settings (OIDC client secret, SAML certificate, WeChat secret, S3 secret key) encrypted with AES-256-GCM in database
- SSO supports OIDC (Authorization Code Flow) and SAML 2.0 (SP-initiated) via `pkg/sso` Provider interface
- System initialization flow: first deployment requires super admin setup via `/api/v1/init`

### Frontend
- React Router with layouts (MainLayout for users, AdminLayout for admin)
- shadcn/ui components (Base UI primitives) in `src/components/ui/`
- App context (`src/context/app.ts`) for global state (current user, initialized, SSO/registration flags)
- API calls via axios client in `src/api/client.ts`
- Dynamic categories from database, accessible via `/:category` routes
- Admin settings split into sub-pages: auth (SSO + registration), storage (S3), wechat
- Boot flow: `/api/v1/boot` → if not initialized → `/init`; if not logged in → `/login`

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| User | `users` | User accounts with role (super_admin/admin/user), password (bcrypt), and status (activated/deactivated) |
| Content | `contents` | Articles and videos with category, speaker, cover image |
| Comment | `comments` | Comments on content (supports nested replies) |
| Like | `likes` | Likes on content and comments |
| Category | `categories` | Dynamic content categories with slug, sort order, and active flag |
| Department | `departments` | Departments synced from WeChat Work |
| Setting | `settings` | Key-value configuration (JWT secret, encryption key, SSO, WeChat, S3, feature flags, etc.) |

## User Roles

| Role | Description |
|------|-------------|
| `super_admin` | Created during system initialization, full access |
| `admin` | Administrator, can manage content, categories, and users |
| `user` | Regular user, can view content, comment, and like |

## Content Types

- `article`: Text + images content
- `video`: Video content with optional cover image

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/health` | GET | Public | Health check |
| `/sso/callback` | GET | Public | OIDC callback |
| `/sso/acs` | POST | Public | SAML ACS (Assertion Consumer Service) |
| `/sso/metadata` | GET | Public | SAML SP metadata XML |
| `/logout` | GET | Public | Logout |
| `/api/v1/boot` | GET | Soft | System state + auth state |
| `/api/v1/init` | POST | Public | Initialize super admin (first boot only) |
| `/api/v1/login` | POST | Public | Username + password login |
| `/api/v1/register` | POST | Public | User registration (when enabled) |
| `/api/v1/users/search` | GET | Authenticated | Search users |
| `/api/v1/contents` | GET | Authenticated | List contents |
| `/api/v1/contents/:id` | GET | Authenticated | Get content |
| `/api/v1/contents` | POST | Admin | Create content |
| `/api/v1/contents/:id` | PUT/DELETE | Admin | Update/Delete content |
| `/api/v1/contents/:id/comments` | GET/POST | Authenticated | List/Create comments |
| `/api/v1/contents/:id/like` | POST | Authenticated | Like content |
| `/api/v1/comments/:id/like` | POST | Authenticated | Like comment |
| `/api/v1/categories` | GET | Authenticated | List active categories |
| `/api/v1/import` | POST | Admin | Import legacy data |
| `/api/v1/upload/presign` | POST | Admin | Get S3 presigned upload URL |
| `/api/v1/files/*path` | GET | Authenticated | Get file (presigned redirect) |
| `/api/v1/admin/users` | GET | Admin | List users |
| `/api/v1/admin/users/:id` | PATCH | Admin | Update user |
| `/api/v1/admin/departments` | GET | Admin | List departments |
| `/api/v1/admin/settings` | GET/PATCH | Admin | Manage settings |
| `/api/v1/admin/sync-wechat` | POST | Admin | Sync from WeChat Work |
| `/api/v1/admin/categories` | GET/POST | Admin | List all / Create category |
| `/api/v1/admin/categories/reorder` | POST | Admin | Reorder categories |
| `/api/v1/admin/categories/:id` | PUT/DELETE | Admin | Update/Delete category |

## Frontend Routes

| Path | Layout | Component | Description |
|------|--------|-----------|-------------|
| `/init` | None | Init | System initialization (first boot) |
| `/login` | None | Login | User login |
| `/register` | None | Register | User registration (when enabled) |
| `/:category` | MainLayout | Home | Content list by category slug |
| `/contents/:id` | MainLayout | ContentDetail | Content detail page |
| `/contents/new` | MainLayout | ContentEditor | Create content |
| `/contents/:id/edit` | MainLayout | ContentEditor | Edit content |
| `/admin/contents` | AdminLayout | AdminContents | Content management |
| `/admin/contents/new` | AdminLayout | AdminContentEditor | Create content (admin) |
| `/admin/contents/:id` | AdminLayout | AdminContentEditor | Edit content (admin) |
| `/admin/users` | AdminLayout | AdminUsers | User management |
| `/admin/categories` | AdminLayout | AdminCategories | Category management |
| `/admin/import` | AdminLayout | AdminImport | Data import |
| `/admin/sync` | AdminLayout | AdminSync | WeChat sync |
| `/admin/settings/auth` | AdminLayout | SettingsAuth | Auth & SSO settings |
| `/admin/settings/storage` | AdminLayout | SettingsStorage | S3 storage settings |
| `/admin/settings/wechat` | AdminLayout | SettingsWechat | WeChat Work settings |

## Configuration

Copy `cmd/niubility/config.example.yaml` to `cmd/niubility/config.local.yaml` and configure:
- `server.address`: Listen address (e.g., `0.0.0.0:9000`)
- `database.dsn`: PostgreSQL connection string

All other configuration (JWT secret, encryption key, SSO, WeChat, S3, feature flags) is managed through the admin settings UI and stored in the database. JWT secret and encryption key are auto-generated on first boot.
