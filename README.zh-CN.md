# Niubility

[English](./README.md) | [中文](./README.zh-CN.md)

Niubility 是面向企业内部的学习与文化平台，覆盖内容发布、浏览互动、后台管理与企业集成，并提供配套 CLI 支持终端场景下的登录、浏览与发布流程。

## 项目概述

Niubility 适用于企业内部知识沉淀、培训传播与文化内容分发。当前仓库已经包含以下能力：

- 四种内容类型：`video`、`gallery`、`article`、`podcast`
- 评论、点赞、收藏、关注、浏览记录等互动能力
- 用户、分类、内容、站点设置、认证设置、存储与资源分发、企业微信同步、数据库备份、服务节点等后台能力
- 可选企业集成：OIDC / SAML SSO、S3 兼容对象存储、企业微信部门与用户同步
- 独立 CLI 子项目，位于 [`cli/`](./cli/)，支持终端登录、浏览、文章发布和常见管理操作

后端会将前端构建产物嵌入到服务端二进制中，因此生产部署通常是一份可执行文件加数据库和可选对象存储即可运行。

## 当前功能

- `video`、`gallery`、`article`、`podcast` 的发布与浏览
- 基于 Tiptap 的文章编辑与基于 Video.js 的媒体播放
- 评论、点赞、收藏、关注、我的浏览记录
- 用户主页、关注动态、个人内容与收藏展示
- 管理后台支持用户管理、分类管理、内容管理、站点配置、认证配置、存储与资源分发、企业微信同步、数据库备份、服务节点监控
- 密码登录与可选 OIDC / SAML 2.0 SSO
- S3 兼容上传链路，以及可配置的资源分发 URL 与图片样式
- `settings` 表驱动的运行期配置，敏感值支持加密存储与脱敏返回
- PostgreSQL（默认）与 MySQL 双数据库支持
- CLI 支持密码登录、浏览器 SSO、内容浏览、文章发布，以及分类/用户/设置等管理命令

## 技术栈

- 后端：Go 1.25、`fox-gonic/fox`、GORM
- 数据库：PostgreSQL（默认）/ MySQL
- 前端：React 18、TypeScript 5、Vite 6、Tailwind CSS 4、shadcn/ui 4
  - React Router v7
  - React Query v5
  - Tiptap v2
  - Video.js v8
  - dnd-kit v6
- 集成：OIDC、SAML 2.0、企业微信、S3 兼容对象存储
- CLI：Go、cobra、viper

## 环境要求

- Go 1.25+
- Node.js 22.14+
- PostgreSQL 或 MySQL
- [Task](https://taskfile.dev/)
- `reflex`，用于 `task dev` 热重载
- `golangci-lint`，用于 `task check`
- 若要使用数据库备份能力，需要宿主机提供 `pg_dump` 或 `mysqldump`

## 本地启动

```bash
git clone https://github.com/miclle/niubility.git
cd Niubility
task install
```

复制本地配置：

```bash
cp cmd/niubility/config.example.yaml cmd/niubility/config.local.yaml
```

YAML 仅保留基础启动信息：

- `server.address`：监听地址
- `database.driver`：`postgres`（默认）或 `mysql`
- `database.dsn`：数据库连接串

其余运行期配置会在服务启动后从 `settings` 表读取，包括：

- JWT 签名密钥与加密密钥
- 注册开关与 Cookie 安全策略
- SSO 配置
- S3 存储配置
- 资源分发配置
- 站点品牌信息
- 企业微信同步配置
- 数据库备份行为配置

启动开发环境：

```bash
task dev
```

首次启动后，访问 `/init` 创建超级管理员账号。

## 常用命令

```bash
task install        # 安装 Go、CLI 和前端依赖
task dev            # 启动 Vite + Go 热重载
task build          # 构建内嵌前端资源的服务端二进制
task build-all      # 多平台构建服务端
task run            # 使用本地配置运行服务
task lint           # 自动整理 Go/CLI 代码并执行前端 lint
task check          # CI 对齐检查，不改写文件
task test           # Go 测试（race + coverage）
task clean          # 清理构建产物
task update-tools   # 安装/更新开发工具
task build-cli      # 构建独立 CLI
task build-cli-all  # 多平台构建 CLI
```

## 构建与部署

生产构建：

```bash
task build
```

本地非热重载运行：

```bash
task run
```

部署前建议确认：

- 数据库连通性正确
- 生产环境已配置 HTTPS 与反向代理
- 如需使用 S3 / 资源分发 / 企业微信 / SSO，已在后台完成配置
- 如需使用管理员触发的数据库备份，宿主机提供了 `pg_dump` 或 `mysqldump`
- 如需在后台查看服务节点状态，已配置节点心跳相关环境变量

服务启动后会自动上报当前节点心跳。以下环境变量为可选：

- `NIUBILITY_NODE_ID`
- `NIUBILITY_NODE_TYPE`（`web`、`worker`、`scheduler`，默认 `web`）
- `NIUBILITY_NODE_SERVICE_NAME`
- `NIUBILITY_NODE_DISPLAY_NAME`
- `NIUBILITY_NODE_VERSION`
- `NIUBILITY_NODE_ENV`
- `NIUBILITY_NODE_REGION`
- `NIUBILITY_NODE_ZONE`
- `NIUBILITY_NODE_CAPABILITIES`

## CLI

仓库包含独立 CLI，位于 [`cli/`](./cli/)。当前已实现的能力包括：

- `login`、`logout`、`whoami`
- `content list`、`content view`、`content create article`、`content edit`、`content delete`
- 分类管理
- 用户管理
- profile、comment、favorite、follow、like、settings 等命令
- 多 profile 隔离与 CLI 文案国际化

当前限制：CLI 的创建/编辑流程仍以文章为主，平台本身已支持 `gallery`、`video`、`podcast`，但 CLI 侧还没有完整的一等发布链路。

相关文档：

- [CLI README](./cli/README.md)
- [CLI 设计](./docs/cli-design.md)
- [CLI SSO 登录设计](./docs/cli-sso-login-design.md)

## 文档索引

- [功能清单](./docs/features.md)
- [路线图](./docs/roadmap.md)
- [CLI 设计](./docs/cli-design.md)
- [CLI SSO 登录设计](./docs/cli-sso-login-design.md)
- [内容审核与可见性设计](./docs/content-moderation-design.md)
- [数据库备份](./docs/database-backup-design.md)
- [企业微信 OAuth](./docs/wechat-oauth.md)

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
