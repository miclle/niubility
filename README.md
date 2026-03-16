# Niubility

七牛内部学习与文化平台，融合学习交流（类 Bilibili）和企业文化（类小红书）两大板块，支持视频和图文内容的发布、浏览与管理。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Go 1.24 + [fox-gonic/fox](https://github.com/fox-gonic/fox) (Gin fork) + GORM + PostgreSQL |
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) (Base UI) |
| 认证 | SSO + JWT (cookie-based) |
| 集成 | 企业微信（部门/用户同步） |

## 环境要求

- Go >= 1.24
- Node.js >= 22.14
- PostgreSQL
- [Task](https://taskfile.dev/) (任务运行器)
- [reflex](https://github.com/cespare/reflex) (Go 热重载，仅开发环境)

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/miclle/Niubility.git
cd Niubility

# 2. 初始化配置文件（自动从 config.example.yaml 复制）
task init-config
# 编辑 cmd/server/config.local.yaml，填写数据库连接和 SSO 配置

# 3. 启动开发服务器（前端 Vite + 后端 Go 热重载）
task dev
```

## 开发命令

```bash
task dev                # 启动开发服务器（Vite + Go 热重载）
task build              # 构建生产二进制文件（内嵌前端资源）
task run                # 运行生产服务器（需先执行 task build）
task fmt                # 格式化 Go 代码
task vet                # 运行 go vet
task website:install    # 安装前端依赖
task website:build      # 构建前端
```

## 项目结构

```
cmd/server/
├── main.go                  # 入口，加载配置并启动服务
├── config.example.yaml      # 配置模板
└── config.local.yaml        # 本地配置（gitignore）
internal/
├── config/                  # 配置加载（YAML via Viper）
├── entity/                  # 数据模型（User, Content, Department, Setting）
├── handler/                 # HTTP 处理器、路由注册、中间件
├── service/                 # 业务逻辑与数据库操作
└── website/                 # React 前端（Vite + TypeScript）
    └── src/
        ├── api/             # API 客户端
        ├── components/      # 通用组件（ui/ 为 shadcn/ui 组件）
        ├── context/         # React Context（应用全局状态）
        ├── layouts/         # 布局组件（MainLayout, AdminLayout）
        ├── types/           # TypeScript 类型定义
        └── views/           # 页面组件
            ├── home/        # 首页（学习/文化内容列表）
            ├── contents/    # 内容详情与编辑
            ├── admin/       # 管理后台（内容、用户、导入、同步、设置）
            └── errors/      # 错误页面（403, 404, 500）
pkg/
├── sso/                     # SSO 认证
└── textencrypt/             # 文本加密（AES-256-GCM）
docs/
└── requirement.md           # 产品需求文档
```

## 配置说明

复制 `cmd/server/config.example.yaml` 为 `cmd/server/config.local.yaml` 并配置：

| 配置项 | 说明 |
|--------|------|
| `server.address` | 监听地址，如 `0.0.0.0:9000` |
| `server.secret` | JWT 签名密钥 |
| `server.cookieSecure` | 是否启用 Cookie Secure 标记（HTTPS 环境设为 true） |
| `server.encryptionKey` | AES-256-GCM 加密密钥（32 字节 hex，用于敏感配置加密） |
| `database.dsn` | PostgreSQL 连接字符串 |
| `sso.host` | SSO 服务地址 |
| `sso.clientID` | SSO 客户端 ID |
| `sso.secret` | SSO 客户端密钥 |

## 内容模型

- **类型**: `article`（图文）、`video`（视频）
- **分类**: `learning`（学习交流）、`culture`（企业文化）

## API 概览

| 路由 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/health` | GET | 公开 | 健康检查 |
| `/sso` | GET | 公开 | SSO 回调 |
| `/logout` | GET | 公开 | 登出 |
| `/api/v1/boot` | GET | 已登录 | 获取启动信息（当前用户等） |
| `/api/v1/contents` | GET | 已登录 | 内容列表（支持分类、关键词、标签筛选） |
| `/api/v1/contents/:id` | GET | 已登录 | 内容详情 |
| `/api/v1/contents` | POST | 管理员 | 创建内容 |
| `/api/v1/contents/:id` | PUT | 管理员 | 更新内容 |
| `/api/v1/contents/:id` | DELETE | 管理员 | 删除内容 |
| `/api/v1/import` | POST | 管理员 | 导入旧平台数据 |
| `/api/v1/admin/users` | GET | 管理员 | 用户列表 |
| `/api/v1/admin/users/:id` | PATCH | 管理员 | 更新用户（角色/状态） |
| `/api/v1/admin/departments` | GET | 管理员 | 部门列表 |
| `/api/v1/admin/settings` | GET/PATCH | 管理员 | 系统配置管理 |
| `/api/v1/admin/sync-wechat` | POST | 管理员 | 从企业微信同步部门和用户 |
