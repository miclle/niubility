# Niubility

[English](./README.md) | [中文](./README.zh-CN.md)

企业内部学习与文化平台，帮助团队统一管理培训视频、图文内容、知识分享与文化传播内容，并提供适合企业场景的认证、存储和组织同步能力。

## 项目介绍

Niubility 面向企业内部知识沉淀与内容传播场景，支持从内容发布、浏览互动到后台管理的一体化流程。项目采用 Go + React 技术栈，内置前后端一体构建能力，适合以单体应用方式快速部署到企业内网或云环境。

它不仅覆盖常见的内容平台能力，也提供适合企业环境的扩展能力，例如可选 SSO、S3 兼容对象存储、企业微信组织同步，以及基于后台设置的运行期配置管理。同时提供了配套的 CLI 工具，支持在终端中发布和管理内容。

## 功能描述

- 内容发布与浏览：支持视频、图库、文章等企业常见内容形态，配备富文本编辑器（Tiptap）和视频播放器（Video.js）。
- 社交互动：支持评论、点赞、收藏、关注等互动行为，便于知识传播与内容沉淀。
- 后台管理：支持内容、分类、用户、系统设置等统一管理。
- 企业认证集成：支持账号密码登录，并可选接入 OIDC 或 SAML 2.0 SSO。
- 企业微信同步：可从企业微信同步部门与用户信息。
- 对象存储支持：可接入 S3 兼容存储，处理上传与资源访问，支持可配置的资源分发。
- 安全配置管理：运行期配置保存在数据库中，敏感信息支持 AES-256-GCM 加密存储与脱敏返回。
- 内容分享：支持通过链接和消息卡片分享内容。
- 多数据库支持：默认使用 PostgreSQL，也支持 MySQL。
- CLI 工具：支持在终端中发布和管理内容。

## 技术栈

- 后端：Go 1.25、`fox-gonic/fox`、GORM、PostgreSQL / MySQL
- 前端：React 18、TypeScript 5、Vite 6、Tailwind CSS 4、shadcn/ui 4
  - React Router v7、React Query v5、Tiptap v2、Video.js v8、dnd-kit、Lucide React、dayjs
- 认证：密码登录、JWT Cookie、可选 OIDC / SAML 2.0
- 存储：S3 兼容对象存储
- 集成：企业微信部门与用户同步
- CLI：Go、cobra、viper

## 安装要求

- Go 1.25 或更高版本
- Node.js 22.14 或更高版本
- PostgreSQL 或 MySQL
- [Task](https://taskfile.dev/)
- [reflex](https://github.com/cespare/reflex)（仅开发环境热重载需要）

## 安装与本地启动

```bash
git clone https://github.com/miclle/niubility.git
cd Niubility
task install
```

复制配置模板并按需修改数据库连接：

```bash
cp cmd/niubility/config.example.yaml cmd/niubility/config.local.yaml
```

`cmd/niubility/config.local.yaml` 目前只需要配置基础启动项：

- `server.address`：服务监听地址
- `database.driver`：数据库驱动，`postgres`（默认）或 `mysql`
- `database.dsn`：数据库连接字符串

其余运行期配置，例如 JWT 密钥、加密密钥、SSO、S3、企业微信等，首次启动后通过管理后台配置，相关敏感值不会以明文形式直接暴露。

启动开发环境：

```bash
task dev
```

首次启动后，系统会引导创建超级管理员账号。

## 常用命令

```bash
task install        # 安装依赖
task dev            # 启动开发环境（热重载）
task build          # 构建生产二进制（含前端）
task build-all      # 多平台构建
task run            # 生产模式运行
task lint           # 代码检查（gofmt、vet、staticcheck）
task check          # CI 对齐检查（后端、CLI、前端类型、mod tidy）
task test           # 运行测试（race 检测 + 覆盖率）
task clean          # 清理构建产物
task update-tools   # 更新开发工具
task build-cli      # 构建 CLI
task build-cli-all  # 多平台构建 CLI
```

## 部署说明

### 生产构建

```bash
task build
```

构建完成后会生成内嵌前端资源的服务端二进制，可直接用于部署。

### 生产运行

```bash
task run
```

部署时建议重点确认以下内容：

- PostgreSQL 或 MySQL 已可访问，且连接字符串配置正确。
- 应用对上传目录或对象存储拥有正确访问权限。
- 反向代理、负载均衡或网关已正确转发应用地址。
- 若启用 SSO、S3 或企业微信，需在后台完成对应配置。
- 生产环境应通过 HTTPS 暴露服务，以保障登录态与回调链路安全。

### 推荐部署流程

1. 准备数据库（PostgreSQL 或 MySQL）。
2. 配置 `cmd/niubility/config.local.yaml`。
3. 执行 `task build` 生成可执行文件。
4. 以 systemd、Supervisor、容器或其他方式运行服务。
5. 首次进入系统创建超级管理员。
6. 在后台补充 SSO、对象存储、企业微信等运行期配置。

## CLI 工具

Niubility 提供配套的 CLI 工具，支持在终端中发布和管理内容。完整设计文档参见 [docs/cli-design.md](./docs/cli-design.md)，当前实现进度参见 [docs/roadmap.md](./docs/roadmap.md)。

## 可选集成

- SSO：适用于统一身份认证场景，支持 OIDC 与 SAML 2.0。
- S3 兼容存储：适用于上传文件统一存储与访问控制场景。
- 企业微信同步：适用于自动同步组织架构和用户信息场景。
- 资源分发：支持签名 URL 和 CDN 集成的可配置资源分发。

## 项目文档

- [功能列表](./docs/features.md) — 完整功能清单与状态
- [路线图](./docs/roadmap.md) — 计划中与进行中的事项
- [CLI 设计方案](./docs/cli-design.md) — CLI 工具设计与实现计划
- [CLI SSO 登录设计](./docs/cli-sso-login-design.md) — CLI SSO 认证流程
- [企业微信 OAuth](./docs/wechat-oauth.md) — 企业微信 OAuth2 自动登录设计

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
