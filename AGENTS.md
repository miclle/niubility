# AGENTS.md

AI 编码助手在 Niubility 仓库中的统一技术规范。

除代码、命令、路径、类型名、接口名等专有内容外，说明性文字优先使用中文。错误信息、日志、代码注释和用户可见协议字段保持现有风格，不为了迎合工具而改写。

## 项目概述

Niubility 是企业内部学习与文化平台，支持 `video`、`gallery`、`article` 三种内容类型，提供评论、点赞、收藏、关注等社交功能，并支持可选 SSO、S3 对象存储、企业微信同步。

## 技术栈

- 后端：Go 1.25 + `fox-gonic/fox` + GORM + PostgreSQL
- 前端：React 18 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui
- 认证：密码登录 + 可选 OIDC / SAML 2.0 + JWT Cookie
- 存储：S3 兼容对象存储
- 集成：企业微信部门和用户同步

## 开发命令

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

## 目录概览

```text
cmd/niubility/            # 入口与本地配置
internal/config/          # YAML 基础配置加载
internal/entity/          # 数据模型与领域类型
internal/handler/         # HTTP 处理器、路由注册、中间件
internal/service/         # 业务逻辑、数据库操作、集成逻辑
internal/website/src/     # React 前端
pkg/sso/                  # OIDC / SAML Provider
pkg/textencrypt/          # AES-256-GCM 文本加密
pkg/gormlog/              # GORM 日志适配器
.agents/rules/            # AI 协作细则
```

## AI 协作入口

所有工具在开始工作前必须先阅读本文件，再按任务类型补读对应规则：

- 后端接口与 handler：`.agents/rules/backend-handler.md`
- 业务逻辑与 service：`.agents/rules/backend-service.md`
- settings、SSO、S3、企业微信：`.agents/rules/settings-and-integrations.md`
- 前端页面、路由、API、类型：`.agents/rules/frontend.md`
- 测试与验证：`.agents/rules/testing.md`
- 提交前联动检查：`.agents/rules/change-checklist.md`

`CLAUDE.md`、Cursor 规则文件等工具入口只做导航，不应复制整份规范。

高频流程可优先使用仓库内 skill：

- `manage-settings`：处理 `settings` 表配置项的新增、修改、迁移、脱敏与联动检查

## 核心架构约束

### 后端

- 分层保持为 `Handler -> Service -> Entity`
- 路由统一在 `internal/handler/handler.go` 中注册
- 管理接口统一在 `/api/v1/admin/*` 下，并使用管理员鉴权
- YAML 仅保留基础启动配置，其他运行期配置以 `settings` 表为准
- JWT 密钥、加密密钥、SSO 凭据、企业微信密钥、S3 secret 等敏感值不得明文暴露

### 前端

- 路由使用 React Router，并延续 `MainLayout`、`AdminLayout`、`SettingsLayout`
- API 调用放在 `internal/website/src/api/`
- 类型定义放在 `internal/website/src/types/`
- 页面放在 `internal/website/src/views/`
- 优先复用现有 shadcn/ui 与 Tailwind 风格，不随意引入新的 UI 基础设施

## 强制规则

- 修改代码前，阅读与任务直接相关的 `.agents/rules/*.md`
- 遵守现有分层和目录结构，不为局部改动重塑架构
- 涉及 API、设置项、上传链路、SSO、企业微信时，检查前后端和文档联动
- 涉及敏感信息时，日志、测试数据、文档示例中都必须脱敏
- 文档中的流程图、时序图、状态流转图统一使用 `Mermaid`，不要再提交 ASCII 图或截图式流程图
- 没有完成相应验证前，不要宣称“已完成”“已修复”“测试通过”

## 推荐做法

- API 变更同步更新前端 client、类型和必要文档
- 新增后端逻辑优先补充对应单元测试
- 优先复用统一接口，不继续扩散已废弃接口模式
- 小步修改，保持 handler、service、view 文件职责清晰

## 本项目常见改动面

- 内容、评论、点赞、收藏、关注：注意计数字段、关联查询和权限
- 分类与路由：注意启用状态、排序、动态 `/:slug` 路由影响
- 上传与资源访问：注意 presign、对象 key、访问 URL 与权限边界
- 设置管理：注意 `entity.Setting*` 常量、service 读取逻辑、管理端表单和脱敏返回
- SSO 与企业微信：注意回调地址、协议字段、密钥脱敏和错误日志

## 提交前最小检查

- 运行与改动匹配的验证命令，至少覆盖被修改的核心路径
- 检查是否需要同步更新前端 API/types、设置页、文档或测试
- 检查是否引入了敏感信息、破坏了启动流程或偏离现有分层

更细的检查项见 `.agents/rules/testing.md` 与 `.agents/rules/change-checklist.md`。
