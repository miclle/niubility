# Architecture

## Overview

Niubility follows a three-layer architecture:

```
Handler (HTTP)  →  Service (business logic)  →  Entity (data model + ORM)
```

- **Handler** (`internal/handler/`) — receives HTTP requests via [fox-gonic/fox](https://github.com/fox-gonic/fox), validates input, calls Service, and formats responses.
- **Service** (`internal/service/`) — contains all business logic, database operations (via GORM), encryption, external integrations (WeChat, S3, SSO).
- **Entity** (`internal/entity/`) — defines data models (structs + GORM tags), constants, enums, and value objects. No business logic.

Supporting packages:

| Package | Responsibility |
|---|---|
| `pkg/textencrypt` | AES-GCM encryption for sensitive settings |
| `pkg/gormlog` | GORM log adapter |
| `pkg/sso` | OIDC and SAML SSO flows |
| `internal/config` | YAML config parsing |
| `internal/website` | Embedded React SPA (Vite build) |
| `cmd/niubility` | Application entry point |
| `cli/` | Companion CLI tool |

## Service Layer Domains

The `Service` struct implements 17 domain interfaces defined in `internal/service/domain.go`. Each interface groups related methods and documents the boundary of a business domain:

| Domain | File | Responsibility |
|---|---|---|
| `SettingDomain` | `setting.go` | Settings CRUD, typed config accessors (S3, OIDC, SAML, WeChat, Delivery, Site, Backup) |
| `AuthDomain` | `auth.go`, `service.go` | Super admin init, registration, authentication, password management, SSO type |
| `UserDomain` | `user.go` | User CRUD, search, managed user creation |
| `SessionDomain` | `session.go` | Session create, touch, revoke, get, active check |
| `ContentDomain` | `content.go` | Content CRUD with attachments |
| `ContentViewDomain` | `content_view.go` | View recording and history queries |
| `CommentDomain` | `comment.go` | Comment CRUD, pinning, my-comments |
| `LikeDomain` | `like.go` | Like toggle, liked-IDs batch, my-likes grouped |
| `FavoriteDomain` | `favorite.go` | Favorite toggle and list |
| `FollowDomain` | `follow.go` | Follow toggle, following/followers lists |
| `CategoryDomain` | `category.go` | Category CRUD, reorder, content counts |
| `UploadDomain` | `upload.go` | S3 presigned URLs, file URL resolution, CORS config |
| `BackupDomain` | `backup.go` | Database backup start, list, download URL |
| `NodeDomain` | `node.go` | Service node heartbeat and listing |
| `DepartmentDomain` | `department.go` | Department sync from WeChat, listing |
| `WechatSyncDomain` | `wechat_sync.go` | WeChat user sync (single + batch) |
| `ProfileDomain` | `profile.go` | Profile update, content/like/speaker counts |

Compile-time interface satisfaction checks ensure `*Service` implements all interfaces.

## Route Registration

All HTTP routes are registered in `internal/handler/handler.go` via `RegisterRoutes()`. Routes are organized by domain group with section comments:

1. **SSO & auth callbacks** — `/sso/*`, `/logout`
2. **Health check** — `/health`
3. **File access** — `/attachments/*`, `/avatars/*`, `/site-resources/*`
4. **Public API** — `/api/v1/boot`, `/api/v1/init`, `/api/v1/login`, `/api/v1/register`, SSO CLI flow
5. **User search & profile** — `/api/v1/users/search`, `/api/v1/profile/*`
6. **Content CRUD** — `/api/v1/contents/*`, favorites, views
7. **Categories** — `/api/v1/categories`
8. **Comments** — `/api/v1/comments/*`
9. **Likes** — `/api/v1/likes/*`
10. **Follows** — `/api/v1/users/:username/follow*`
11. **Upload** — `/api/v1/upload/presign`
12. **Admin routes** — `/api/v1/admin/*` (user mgmt, settings, backup, nodes, WeChat, categories, comments)

Admin routes use `RequireAdmin` middleware. All other API routes require authentication via `AuthMiddleware` (JWT cookie).

### Future direction

When route count grows further, consider decentralizing registration by having each handler file expose a `RegisterXxxRoutes(group)` function, called from `RegisterRoutes`. This would reduce modification frequency of `handler.go`.

## Frontend Architecture

The frontend is a React 18 SPA built with Vite 6, located in `internal/website/`:

- **Routing**: React Router v7 with lazy-loaded views
- **State**: React Query for server state, React context for global app state
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **i18n**: i18next with namespace-based translation files
- **Testing**: Vitest with jsdom environment

### Layout structure

- `MainLayout` — public-facing layout with top nav
- `AdminLayout` — admin panel with collapsible sidebar
  - `admin/AdminSidebar` — navigation items, expandable sections
  - `admin/AdminUserMenu` — create-content dropdown + user dropdown

## Testing

### Backend

- Service tests use in-memory SQLite via `setupTestService()` / `NewTestService()`
- Handler tests use `setupTestEnv()` which creates a full `fox.Engine` with routes, backed by SQLite
- Run: `go test ./...` or `task test`

### Frontend

- Vitest for pure utility function tests (`utils.test.ts`, `content-url.test.ts`)
- Run: `cd internal/website && npx vitest run` or `task test`

## Configuration

Settings are stored in the `settings` database table as key-value pairs. Sensitive values (secrets, private keys) are encrypted with AES-GCM using an auto-generated encryption key. The encryption key and JWT secret are generated on first boot and stored in the settings table.

See `internal/entity/setting.go` for all setting key constants and `internal/service/setting.go` for config accessor methods.
