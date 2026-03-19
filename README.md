# Niubility

七牛内部学习与文化平台，融合学习交流（类 Bilibili）和企业文化（类小红书）两大板块，支持视频和图文内容的发布、浏览与管理。

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
# 编辑 cmd/server/config.local.yaml，填写数据库连接字符串
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
cmd/server/
├── main.go                  # 入口，加载配置并启动服务
├── config.example.yaml      # 配置模板（仅 server.address + database.dsn）
└── config.local.yaml        # 本地配置（gitignore）
internal/
├── config/                  # 配置加载（YAML via Viper，极简：server + database）
├── entity/                  # 数据模型（User, Content, Comment, Like, Category, Department, Setting）
├── handler/                 # HTTP 处理器、路由注册、中间件
│   ├── handler.go           # Ctrl 结构体、路由注册
│   ├── middleware.go         # AuthMiddleware, RequireAdmin
│   ├── auth.go              # 登录、注册、JWT 辅助函数
│   ├── init.go              # 系统初始化
│   ├── user.go              # SSO 回调（OIDC/SAML）、Boot、登出、用户管理、同步
│   ├── content.go           # 内容 CRUD
│   ├── comment.go           # 评论 CRUD
│   ├── category.go          # 分类 CRUD 与排序
│   ├── upload.go            # S3 预签名 URL 与文件访问
│   └── setting.go           # 系统配置 CRUD
├── service/                 # 业务逻辑与数据库操作
│   ├── service.go           # Service 初始化（自动生成密钥，从 DB 加载配置）
│   ├── user.go              # 用户 CRUD、认证、注册、超管初始化
│   ├── setting.go           # 配置管理（敏感值 AES-256-GCM 加密存储）
│   ├── content.go           # 内容操作
│   ├── comment.go           # 评论操作
│   ├── like.go              # 点赞操作（内容 + 评论）
│   ├── category.go          # 分类管理与初始数据
│   ├── upload.go            # S3 预签名 URL 生成
│   └── department.go        # 部门操作
└── website/                 # React 前端（Vite + TypeScript）
    └── src/
        ├── api/             # API 客户端
        ├── components/      # 通用组件（ui/ 为 shadcn/ui 组件）
        ├── context/         # React Context（应用全局状态）
        ├── layouts/         # 布局组件（MainLayout, AdminLayout）
        ├── types/           # TypeScript 类型定义
        └── views/           # 页面组件
            ├── home/        # 首页（按分类展示内容列表）
            ├── contents/    # 内容详情与编辑
            ├── admin/       # 管理后台
            │   ├── contents/    # 内容管理
            │   ├── users/       # 用户管理
            │   ├── categories/  # 分类管理（支持拖拽排序）
            │   ├── import/      # 旧数据导入
            │   ├── sync/        # 企业微信同步
            │   └── settings/    # 系统设置（认证、存储、企业微信子页面）
            └── errors/      # 错误页面（403, 404, 500）
pkg/
├── sso/                     # SSO 认证（Provider 接口 + OIDC + SAML 2.0）
└── textencrypt/             # 文本加密（AES-256-GCM）
docs/
├── requirement.md           # 产品需求文档
└── qiniu-sso-saml-guide.md # 七牛 SSO SAML 2.0 对接指南
```

## 配置说明

复制 `cmd/server/config.example.yaml` 为 `cmd/server/config.local.yaml` 并配置：

| 配置项 | 说明 |
|--------|------|
| `server.address` | 监听地址，如 `0.0.0.0:9000` |
| `database.dsn` | PostgreSQL 连接字符串 |

其他所有配置（JWT 密钥、加密密钥、SSO、企业微信、S3 存储、功能开关等）均通过管理后台设置页面管理，存储在数据库 `settings` 表中。JWT 密钥和加密密钥在首次启动时自动生成。

## 数据模型

| 模型 | 数据表 | 说明 |
|------|--------|------|
| User | `users` | 用户账号，角色（super_admin/admin/user），密码（bcrypt），状态（activated/deactivated） |
| Content | `contents` | 内容（图文/视频），关联分类、主讲人、封面图 |
| Comment | `comments` | 评论（支持嵌套回复） |
| Like | `likes` | 点赞（内容 + 评论） |
| Category | `categories` | 内容分类（slug、排序、启用状态） |
| Department | `departments` | 部门（从企业微信同步） |
| Setting | `settings` | 系统配置键值对（JWT、加密密钥、SSO、企业微信、S3 等） |

## 内容模型

- **类型**: `article`（图文）、`video`（视频）
- **分类**: 数据库驱动的动态分类，管理员可在后台增删改排序

## API 概览

| 路由 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/health` | GET | 公开 | 健康检查 |
| `/sso/callback` | GET | 公开 | OIDC 回调 |
| `/sso/acs` | POST | 公开 | SAML ACS（断言消费服务） |
| `/sso/metadata` | GET | 公开 | SAML SP 元数据 XML |
| `/logout` | GET | 公开 | 登出 |
| `/api/v1/boot` | GET | 软认证 | 获取启动信息（系统状态 + 当前用户） |
| `/api/v1/init` | POST | 公开 | 初始化超级管理员（首次启动） |
| `/api/v1/login` | POST | 公开 | 用户名 + 密码登录 |
| `/api/v1/register` | POST | 公开 | 用户注册（启用时） |
| `/api/v1/users/search` | GET | 已登录 | 搜索用户 |
| `/api/v1/contents` | GET | 已登录 | 内容列表（支持分类、关键词筛选） |
| `/api/v1/contents/:id` | GET | 已登录 | 内容详情 |
| `/api/v1/contents` | POST | 管理员 | 创建内容 |
| `/api/v1/contents/:id` | PUT/DELETE | 管理员 | 更新/删除内容 |
| `/api/v1/contents/:id/comments` | GET/POST | 已登录 | 评论列表/发表评论 |
| `/api/v1/contents/:id/like` | POST | 已登录 | 点赞内容 |
| `/api/v1/comments/:id/like` | POST | 已登录 | 点赞评论 |
| `/api/v1/categories` | GET | 已登录 | 获取启用的分类列表 |
| `/api/v1/upload/presign` | POST | 管理员 | 获取 S3 预签名上传 URL |
| `/api/v1/files/*path` | GET | 已登录 | 获取文件（预签名重定向） |
| `/api/v1/import` | POST | 管理员 | 导入旧平台数据 |
| `/api/v1/admin/users` | GET | 管理员 | 用户列表 |
| `/api/v1/admin/users/:id` | PATCH | 管理员 | 更新用户（角色/状态） |
| `/api/v1/admin/departments` | GET | 管理员 | 部门列表 |
| `/api/v1/admin/settings` | GET/PATCH | 管理员 | 系统配置管理 |
| `/api/v1/admin/sync-wechat` | POST | 管理员 | 从企业微信同步部门和用户 |
| `/api/v1/admin/categories` | GET/POST | 管理员 | 分类列表/创建分类 |
| `/api/v1/admin/categories/reorder` | POST | 管理员 | 分类排序 |
| `/api/v1/admin/categories/:id` | PUT/DELETE | 管理员 | 更新/删除分类 |
