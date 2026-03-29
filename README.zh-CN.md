# Niubility

[English](./README.md) | [中文](./README.zh-CN.md)

企业内部学习与文化平台，帮助团队统一管理培训视频、图文内容、知识分享与文化传播内容，并提供适合企业场景的认证、存储和组织同步能力。

## 项目介绍

Niubility 面向企业内部知识沉淀与内容传播场景，支持从内容发布、浏览互动到后台管理的一体化流程。项目采用 Go + React 技术栈，内置前后端一体构建能力，适合以单体应用方式快速部署到企业内网或云环境。

它不仅覆盖常见的内容平台能力，也提供适合企业环境的扩展能力，例如可选 SSO、S3 兼容对象存储、企业微信组织同步，以及基于后台设置的运行期配置管理。

## 功能描述

- 内容发布与浏览：支持视频、图库、文章等企业常见内容形态。
- 社交互动：支持评论、点赞、收藏、关注等互动行为，便于知识传播与内容沉淀。
- 后台管理：支持内容、分类、用户、系统设置等统一管理。
- 企业认证集成：支持账号密码登录，并可选接入 OIDC 或 SAML 2.0 SSO。
- 企业微信同步：可从企业微信同步部门与用户信息。
- 对象存储支持：可接入 S3 兼容存储，处理上传与资源访问。
- 安全配置管理：运行期配置保存在数据库中，敏感信息支持加密存储与脱敏返回。

## 技术栈

- 后端：Go 1.25、`fox-gonic/fox`、GORM、PostgreSQL
- 前端：React 18、TypeScript、Vite、Tailwind CSS 4、shadcn/ui
- 认证：密码登录、JWT Cookie、可选 OIDC / SAML 2.0
- 存储：S3 兼容对象存储
- 集成：企业微信部门与用户同步

## 安装要求

- Go 1.25 或更高版本
- Node.js 22.14 或更高版本
- PostgreSQL
- [Task](https://taskfile.dev/)
- [reflex](https://github.com/cespare/reflex)（仅开发环境热重载需要）

## 安装与本地启动

```bash
git clone https://github.com/miclle/Niubility.git
cd Niubility
task install
```

复制配置模板并按需修改数据库连接：

```bash
cp cmd/niubility/config.example.yaml cmd/niubility/config.local.yaml
```

`cmd/niubility/config.local.yaml` 目前只需要配置基础启动项：

- `server.address`：服务监听地址
- `database.dsn`：PostgreSQL 连接字符串

其余运行期配置，例如 JWT 密钥、加密密钥、SSO、S3、企业微信等，首次启动后通过管理后台配置，相关敏感值不会以明文形式直接暴露。

启动开发环境：

```bash
task dev
```

首次启动后，系统会引导创建超级管理员账号。

## 常用命令

```bash
task install
task dev
task build
task run
task lint
task check
task test
task clean
task update-tools
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

- PostgreSQL 已可访问，且连接字符串配置正确。
- 应用对上传目录或对象存储拥有正确访问权限。
- 反向代理、负载均衡或网关已正确转发应用地址。
- 若启用 SSO、S3 或企业微信，需在后台完成对应配置。
- 生产环境应通过 HTTPS 暴露服务，以保障登录态与回调链路安全。

### 推荐部署流程

1. 准备 PostgreSQL 数据库。
2. 配置 `cmd/niubility/config.local.yaml`。
3. 执行 `task build` 生成可执行文件。
4. 以 systemd、Supervisor、容器或其他方式运行服务。
5. 首次进入系统创建超级管理员。
6. 在后台补充 SSO、对象存储、企业微信等运行期配置。

## 可选集成

- SSO：适用于统一身份认证场景，支持 OIDC 与 SAML 2.0。
- S3 兼容存储：适用于上传文件统一存储与访问控制场景。
- 企业微信同步：适用于自动同步组织架构和用户信息场景。

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
