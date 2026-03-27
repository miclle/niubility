# Niubility

企业内部学习与文化平台，支持视频和图文内容的发布、浏览与管理。

## 功能特性

### 内容管理
- **视频内容** (video): 支持培训/会议录制视频，配套封面、标题、简介、主讲人信息
- **图库内容** (gallery): 支持图文/短视频内容，适合活动报道、精彩瞬间
- **文章内容** (article): 支持长图文内容，适合深度分享

### 用户系统
- **多种登录方式**: 密码登录 + SSO (OIDC / SAML 2.0) + 企业微信同步
- **用户资料**: 个人简介、头像、社交账号、位置信息
- **关注系统**: 关注/取消关注用户，查看关注列表和粉丝列表

### 互动功能
- **评论**: 支持嵌套回复，可评论内容和附件
- **点赞**: 支持对内容、评论、附件点赞
- **收藏**: 收藏感兴趣的内容

### 管理后台
- **内容管理**: 内容增删改查、状态管理（草稿/已发布）
- **用户管理**: 用户角色（super_admin/admin/user）、状态管理
- **分类管理**: 动态分类、拖拽排序
- **系统设置**: SSO 配置、S3 存储、企业微信同步

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Go 1.25 + [fox-gonic/fox](https://github.com/fox-gonic/fox) (Gin fork) + GORM + PostgreSQL |
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) (Base UI) |
| 认证 | 密码登录 + 可选 SSO（OIDC / SAML 2.0）+ JWT (cookie-based) |
| 存储 | S3 兼容对象存储（文件上传，后台可配置） |
| 集成 | 企业微信（部门/用户同步，可选） |

## 环境要求

- Go >= 1.25
- Node.js >= 22.14
- PostgreSQL
- [Task](https://taskfile.dev/) (任务运行器)
- [reflex](https://github.com/cespare/reflex) (Go 热重载，仅开发环境)

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/miclle/Niubility.git
cd Niubility

# 2. 安装依赖（Go modules + 前端）
task install

# 3. 初始化配置文件（自动从 config.example.yaml 复制）
# 编辑 cmd/niubility/config.local.yaml，填写数据库连接字符串
task dev
```

首次启动后访问页面，系统会引导创建超级管理员账号。SSO、企业微信、S3 存储等均在管理后台设置页面配置。

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

## 项目结构

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
            ├── home/        # 首页（按分类展示内容列表）
            ├── video/       # 视频详情与编辑
            ├── gallery/     # 图库详情与编辑
            ├── article/     # 文章详情与编辑
            ├── profile/     # 用户主页（内容、关注、粉丝、收藏）
            ├── following/   # 关注动态
            ├── settings/    # 个人设置（账号、内容、收藏、安全、通知）
            ├── admin/       # 管理后台
            │   ├── contents/    # 内容管理
            │   ├── users/       # 用户管理
            │   ├── categories/  # 分类管理（支持拖拽排序）
            │   └── settings/    # 系统设置（认证、存储、企业微信子页面）
            └── errors/      # 错误页面（403, 404, 500）
pkg/
├── sso/                     # SSO 认证（Provider 接口 + OIDC + SAML 2.0）
├── textencrypt/             # 文本加密（AES-256-GCM）
└── gormlog/                 # GORM 日志适配器
docs/
├── archive/                 # 历史文档
│   └── requirement.md       # 产品需求文档（原始）
└── cli-design.md            # CLI 工具设计方案
```

## 配置说明

复制 `cmd/niubility/config.example.yaml` 为 `cmd/niubility/config.local.yaml` 并配置：

| 配置项 | 说明 |
|--------|------|
| `server.address` | 监听地址，如 `0.0.0.0:9000` |
| `database.dsn` | PostgreSQL 连接字符串 |

其他所有配置（JWT 密钥、加密密钥、SSO、企业微信、S3 存储、功能开关等）均通过管理后台设置页面管理，存储在数据库 `settings` 表中。JWT 密钥和加密密钥在首次启动时自动生成。

## 数据模型

| 模型 | 数据表 | 说明 |
|------|--------|------|
| User | `users` | 用户账号，角色（super_admin/admin/user），密码（bcrypt），状态（activated/deactivated） |
| Content | `contents` | 内容（图文/视频/图库），关联分类、主讲人、封面图 |
| Attachment | `attachments` | 内容附件（视频、图片、文档），支持批量上传 |
| Comment | `comments` | 评论（支持嵌套回复） |
| Like | `likes` | 点赞（内容 + 评论 + 附件） |
| Favorite | `favorites` | 收藏 |
| Follow | `follows` | 关注关系 |
| Category | `categories` | 内容分类（slug、排序、启用状态） |
| Department | `departments` | 部门（从企业微信同步） |
| Setting | `settings` | 系统配置键值对（JWT、加密密钥、SSO、企业微信、S3 等） |

## 内容类型

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `video` | 视频内容，支持主讲人信息 | 培训视频、会议录制 |
| `gallery` | 图库内容，支持图片/短视频 | 活动报道、精彩瞬间 |
| `article` | 文章内容，支持富文本 | 深度分享、学习笔记 |

## 用户角色

| 角色 | 说明 |
|------|------|
| `super_admin` | 系统初始化时创建，拥有全部权限 |
| `admin` | 管理员，可管理内容、分类、用户 |
| `user` | 普通用户，可浏览、评论、点赞、收藏、关注 |

## API 概览

### 公开接口

| 路由 | 方法 | 说明 |
|------|------|------|
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
|------|------|------|
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
| `/api/v1/contents` | GET | 内容列表（支持分类、关键词、标签筛选） |
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
|------|------|------|
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

### 认证页面

| 路径 | 说明 |
|------|------|
| `/init` | 系统初始化（首次启动） |
| `/login` | 用户登录 |
| `/register` | 用户注册（启用时） |

### 主页面（MainLayout）

| 路径 | 说明 |
|------|------|
| `/` | 首页（全部内容） |
| `/videos` | 视频列表 |
| `/galleries` | 图库列表 |
| `/articles` | 文章列表 |
| `/following` | 关注动态 |
| `/:slug` | 分类页面或用户主页（@username） |

### 内容页面

| 路径 | 说明 |
|------|------|
| `/video/:id` | 视频详情 |
| `/video/new` | 创建视频 |
| `/video/:id/edit` | 编辑视频 |
| `/gallery/:id` | 图库详情 |
| `/gallery/new` | 创建图库 |
| `/gallery/:id/edit` | 编辑图库 |
| `/article/:id` | 文章详情 |
| `/article/new` | 创建文章 |
| `/article/:id/edit` | 编辑文章 |

### 用户主页（@username）

| 路径 | 说明 |
|------|------|
| `/@:username` | 用户内容 |
| `/@:username/videos` | 用户视频 |
| `/@:username/articles` | 用户文章 |
| `/@:username/speakers` | 主讲内容 |
| `/@:username/following` | 关注列表 |
| `/@:username/followers` | 粉丝列表 |
| `/@:username/favorites` | 用户收藏 |

### 个人设置（SettingsLayout）

| 路径 | 说明 |
|------|------|
| `/settings/account` | 账号设置 |
| `/settings/contents` | 我的内容 |
| `/settings/favorites` | 我的收藏 |
| `/settings/security` | 安全设置 |
| `/settings/notifications` | 通知设置 |

### 管理后台（AdminLayout）

| 路径 | 说明 |
|------|------|
| `/admin/contents` | 内容管理 |
| `/admin/users` | 用户管理 |
| `/admin/categories` | 分类管理 |
| `/admin/settings/auth` | 认证设置（SSO + 注册） |
| `/admin/settings/storage` | 存储设置（S3） |
| `/admin/settings/wechat` | 企业微信设置 |

### 错误页面

| 路径 | 说明 |
|------|------|
| `/forbidden` | 403 无权限 |
| `/500` | 服务器错误 |
| `*` | 404 未找到 |

## 开发指南

详细的技术架构、编码规范和开发模式请参考 [AGENTS.md](./AGENTS.md)。

## License

MIT
