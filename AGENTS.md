# AGENTS.md

AI 编码助手（如 Claude Code、Cursor、GitHub Copilot 等）在此项目工作的技术指南。

## 项目概述

Niubility 是企业内部学习与文化平台，融合学习交流（类 Bilibili）和企业文化（类小红书）两大板块。支持视频 (video)、图库 (gallery)、文章 (article) 三种内容类型，提供评论、点赞、收藏、关注等社交功能。

## 技术栈

- **后端**: Go 1.25 + [fox-gonic/fox](https://github.com/fox-gonic/fox) (Gin fork) + GORM + PostgreSQL
- **前端**: React 18 + TypeScript + Vite + Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) (Base UI)
- **认证**: 密码登录 + 可选 SSO（OIDC / SAML 2.0）+ JWT (cookie-based)
- **存储**: S3 兼容对象存储（文件上传，后台可配置）
- **集成**: 企业微信（部门/用户同步，可选）

## 开发命令

```bash
task install        # 安装所有依赖（Go modules + 前端）
task dev            # 启动开发服务器（Vite + Go 热重载）
task build          # 构建生产二进制文件（内嵌前端资源）
task run            # 运行生产服务器（需先执行 task build）
task lint           # 自动修复代码风格（go mod tidy + gofmt + vet + staticcheck）
task check          # 运行所有检查，不修改文件（CI 友好）
task test           # 运行 Go 测试（竞态检测 + 覆盖率）
task clean          # 清理构建产物
task update-tools   # 安装/更新开发工具（reflex, staticcheck）
```

## 架构

```
cmd/niubility/
├── main.go                  # 入口，加载配置并启动服务
├── config.example.yaml      # 配置模板（仅 server.address + database.dsn）
└── config.local.yaml        # 本地配置（gitignore）
internal/
├── config/                  # 配置加载（YAML via Viper，极简：server + database）
├── entity/                  # 数据模型（User, Content, Comment, Like, Category, Department, Setting, Follow, Favorite, Attachment）
├── handler/                 # HTTP 处理器、路由注册、中间件
│   ├── handler.go           # Ctrl 结构体、路由注册
│   ├── middleware.go        # AuthMiddleware, RequireAdmin
│   ├── auth.go              # 登录、注册、JWT 辅助函数
│   ├── init.go              # 系统初始化
│   ├── user.go              # SSO 回调（OIDC/SAML）、Boot、登出
│   ├── profile.go           # 用户资料管理
│   ├── content.go           # 内容 CRUD
│   ├── comment.go           # 评论 CRUD
│   ├── like.go              # 点赞操作（统一接口）
│   ├── follow.go            # 关注操作
│   ├── favorite.go          # 收藏操作
│   ├── category.go          # 分类 CRUD 与排序
│   ├── upload.go            # S3 预签名 URL 与文件访问
│   └── setting.go           # 系统配置 CRUD
├── service/                 # 业务逻辑与数据库操作
│   ├── service.go           # Service 初始化（自动生成密钥，从 DB 加载配置）
│   ├── auth.go              # 认证服务
│   ├── user.go              # 用户 CRUD、认证、注册、超管初始化
│   ├── profile.go           # 用户资料服务
│   ├── setting.go           # 配置管理（敏感值 AES-256-GCM 加密存储）
│   ├── content.go           # 内容操作
│   ├── comment.go           # 评论操作
│   ├── like.go              # 点赞操作
│   ├── follow.go            # 关注操作
│   ├── favorite.go          # 收藏操作
│   ├── category.go          # 分类管理与初始数据
│   ├── upload.go            # S3 预签名 URL 生成
│   ├── wechat_sync.go       # 企业微信同步
│   └── department.go        # 部门操作
└── website/                 # React 前端（Vite + TypeScript）
    └── src/
        ├── api/             # API 客户端
        ├── components/      # 通用组件（ui/ 为 shadcn/ui 组件）
        ├── context/         # React Context（应用全局状态）
        ├── layouts/         # 布局组件（MainLayout, AdminLayout, SettingsLayout）
        ├── types/           # TypeScript 类型定义
        └── views/           # 页面组件
pkg/
├── sso/                     # SSO 认证（Provider 接口 + OIDC + SAML 2.0）
├── textencrypt/             # 文本加密（AES-256-GCM）
└── gormlog/                 # GORM 日志适配器
```

## 关键模式

### 后端

- **分层架构**: Handler → Service → Entity
- **GORM**: 自动迁移数据库 schema
- **路由**: 在 `handler/handler.go` 中注册，使用 `AuthMiddleware` 和 `RequireAdmin` 中间件
- **管理路由**: 在 `/api/v1/admin/` 下，需要 `RequireAdmin` 中间件
- **极简配置**: YAML 仅需 `server.address` 和 `database.dsn`；其他配置（JWT、SSO、企业微信、S3 等）存储在数据库 `settings` 表
- **密钥管理**: JWT 密钥和加密密钥首次启动时自动生成并持久化
- **敏感数据加密**: OIDC client secret、SAML 证书、企业微信 secret、S3 secret key 使用 AES-256-GCM 加密存储
- **SSO**: 支持 OIDC (Authorization Code Flow) 和 SAML 2.0 (SP-initiated)，通过 `pkg/sso` Provider 接口
- **系统初始化**: 首次部署通过 `/api/v1/init` 创建超级管理员

### 前端

- **路由**: React Router，使用 MainLayout（用户端）、AdminLayout（管理端）、SettingsLayout（个人设置）
- **UI 组件**: shadcn/ui (Base UI) 在 `src/components/ui/`
- **全局状态**: App context (`src/context/app.ts`) 管理当前用户、初始化状态、SSO/注册开关
- **API 调用**: axios client 在 `src/api/client.ts`
- **动态分类**: 从数据库加载，通过 `/:category` 路由访问
- **管理设置**: 分为 auth（SSO + 注册）、storage（S3）、wechat 子页面
- **启动流程**: `/api/v1/boot` → 未初始化 → `/init`；未登录 → `/login`

## 数据模型

| 模型 | 数据表 | 说明 |
|-------|-------|-------------|
| User | `users` | 用户账号，角色（super_admin/admin/user），密码（bcrypt），状态（activated/deactivated），关注数/粉丝数 |
| Content | `contents` | 内容（video/gallery/article），关联分类、主讲人、封面图，点赞数/收藏数/评论数 |
| Attachment | `attachments` | 内容附件（视频、图片、文档），支持批量上传，有点赞数 |
| Comment | `comments` | 评论（支持嵌套回复，可评论内容和附件） |
| Like | `likes` | 点赞（内容 + 评论 + 附件） |
| Favorite | `favorites` | 收藏 |
| Follow | `follows` | 关注关系 |
| Category | `categories` | 内容分类（slug、排序、启用状态） |
| Department | `departments` | 部门（从企业微信同步） |
| Setting | `settings` | 系统配置键值对（JWT、加密密钥、SSO、企业微信、S3 等） |

## 用户角色

| 角色 | 说明 |
|------|------|
| `super_admin` | 系统初始化时创建，拥有全部权限 |
| `admin` | 管理员，可管理内容、分类、用户 |
| `user` | 普通用户，可浏览、评论、点赞、收藏、关注 |

## 内容类型

| 类型 | 说明 |
|------|------|
| `video` | 视频内容，支持主讲人信息 |
| `gallery` | 图库内容，支持图片/短视频 |
| `article` | 文章内容，支持富文本 |

## API 路由

### 公开接口

| 路由 | 方法 | 说明 |
|-------|--------|------|
| `/health` | GET | 健康检查 |
| `/sso/callback` | GET | OIDC 回调 |
| `/sso/acs` | POST | SAML ACS（断言消费服务） |
| `/sso/metadata` | GET | SAML SP 元数据 XML |
| `/logout` | GET | 登出 |
| `/api/v1/boot` | GET | 获取启动信息（系统状态 + 当前用户） |
| `/api/v1/init` | POST | 初始化超级管理员（首次启动） |
| `/api/v1/login` | POST | 用户名 + 密码登录 |
| `/api/v1/register` | POST | 用户注册（启用时） |

### 用户接口（需登录）

| 路由 | 方法 | 说明 |
|-------|--------|------|
| `/api/v1/profile` | GET/PATCH | 获取/更新个人资料 |
| `/api/v1/profile/upload` | POST | 获取头像预签名 URL |
| `/api/v1/profile/change-password` | POST | 修改密码 |
| `/api/v1/profile/has-password` | GET | 检查是否设置密码 |
| `/api/v1/users/search` | GET | 搜索用户 |
| `/api/v1/users/:username/profile` | GET | 获取用户资料 |
| `/api/v1/users/:username/follow` | POST | 关注/取消关注用户 |
| `/api/v1/users/:username/following` | GET | 获取关注列表 |
| `/api/v1/users/:username/followers` | GET | 获取粉丝列表 |
| `/api/v1/users/:username/favorites` | GET | 获取用户收藏 |
| `/api/v1/contents` | GET | 内容列表 |
| `/api/v1/contents` | POST | 创建内容 |
| `/api/v1/contents/:id` | GET/PUT/DELETE | 内容详情/更新/删除 |
| `/api/v1/contents/:id/favorite` | POST | 收藏/取消收藏内容 |
| `/api/v1/favorites` | GET | 获取我的收藏 |
| `/api/v1/comments` | GET/POST | 评论列表/发表评论（统一接口） |
| `/api/v1/likes` | POST | 点赞/取消点赞（统一接口） |
| `/api/v1/categories` | GET | 获取启用的分类列表 |
| `/api/v1/upload/presign` | POST | 获取 S3 预签名上传 URL |
| `/attachments/*path` | GET | 获取附件文件 |
| `/avatars/*path` | GET | 获取头像文件 |

### 管理接口（需管理员权限）

| 路由 | 方法 | 说明 |
|-------|--------|------|
| `/api/v1/admin/users` | GET | 用户列表 |
| `/api/v1/admin/users/:id` | PATCH | 更新用户（角色/状态） |
| `/api/v1/admin/departments` | GET | 部门列表 |
| `/api/v1/admin/settings` | GET/PATCH | 系统配置管理 |
| `/api/v1/admin/sync-wechat` | POST | 从企业微信同步部门和用户 |
| `/api/v1/admin/categories` | GET/POST | 分类列表/创建分类 |
| `/api/v1/admin/categories/reorder` | POST | 分类排序 |
| `/api/v1/admin/categories/:id` | PUT/DELETE | 更新/删除分类 |

### 废弃接口

以下接口已废弃，建议使用新接口：

| 废弃接口 | 替代接口 |
|----------|----------|
| `POST /contents/:id/comments` | `POST /comments` |
| `GET /contents/:id/comments` | `GET /comments?content_id=` |
| `POST /contents/:id/like` | `POST /likes` |
| `POST /comments/:id/like` | `POST /likes` |
| `POST /attachments/:id/like` | `POST /likes` |

## 前端路由

| 路径 | 布局 | 说明 |
|------|------|------|
| `/init` | 无 | 系统初始化（首次启动） |
| `/login` | 无 | 用户登录 |
| `/register` | 无 | 用户注册（启用时） |
| `/` | MainLayout | 首页（全部内容） |
| `/videos` | MainLayout | 视频列表 |
| `/galleries` | MainLayout | 图库列表 |
| `/articles` | MainLayout | 文章列表 |
| `/following` | MainLayout | 关注动态 |
| `/:slug` | MainLayout | 分类页面或用户主页（@username） |
| `/video/:id` | MainLayout | 视频详情 |
| `/video/new` | MainLayout | 创建视频 |
| `/video/:id/edit` | MainLayout | 编辑视频 |
| `/gallery/:id` | MainLayout | 图库详情 |
| `/gallery/new` | MainLayout | 创建图库 |
| `/gallery/:id/edit` | MainLayout | 编辑图库 |
| `/article/:id` | MainLayout | 文章详情 |
| `/article/new` | MainLayout | 创建文章 |
| `/article/:id/edit` | MainLayout | 编辑文章 |
| `/settings/*` | SettingsLayout | 个人设置 |
| `/admin/contents` | AdminLayout | 内容管理 |
| `/admin/users` | AdminLayout | 用户管理 |
| `/admin/categories` | AdminLayout | 分类管理 |
| `/admin/settings/auth` | AdminLayout | 认证设置 |
| `/admin/settings/storage` | AdminLayout | 存储设置 |
| `/admin/settings/wechat` | AdminLayout | 企业微信设置 |

## 配置

复制 `cmd/niubility/config.example.yaml` 为 `cmd/niubility/config.local.yaml` 并配置：
- `server.address`: 监听地址（如 `0.0.0.0:9000`）
- `database.dsn`: PostgreSQL 连接字符串

其他配置（JWT 密钥、加密密钥、SSO、企业微信、S3、功能开关）通过管理后台设置页面管理，存储在数据库。JWT 密钥和加密密钥首次启动时自动生成。
