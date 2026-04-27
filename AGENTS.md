# AGENTS.md

AI 编码助手在 Niubility 仓库中的统一技术规范。

除代码、命令、路径、类型名、接口名等专有内容外，说明性文字优先使用中文。错误信息、日志、代码注释和用户可见协议字段保持现有风格，不为了迎合工具而改写。

## 项目概述

Niubility 是企业内部学习与文化平台，当前支持 `video`、`gallery`、`article`、`podcast` 四种内容类型，提供评论、点赞、收藏、关注、浏览记录等社交能力，并支持可选 SSO、S3 对象存储、企业微信同步、资源分发、数据库备份与服务节点上报。项目包含主站服务（Go + React 嵌入式 SPA）和独立的 CLI 工具（Go + cobra）。

## 技术栈

- 后端：Go 1.25 + `fox-gonic/fox` v0.0.9 + GORM v1.31 + PostgreSQL（默认）/ MySQL
- 前端：React 18 + TypeScript 5 + Vite 6 + Tailwind CSS 4 + shadcn/ui 4
  - React Router v7（路由）
  - React Query v5（服务端状态）
  - Tiptap v2（富文本编辑器）
  - Video.js v8（视频播放）
  - dnd-kit v6（拖拽排序）
  - Lucide React（图标）
  - dayjs（日期处理）
  - Axios（HTTP 客户端）
- 认证：密码登录 + 可选 OIDC / SAML 2.0 + JWT Cookie
- 存储：S3 兼容对象存储
- 集成：企业微信部门和用户同步
- CLI：Go + cobra + viper（独立子项目，位于 `cli/`）

## 开发命令

```bash
task install        # 安装前后端依赖
task dev            # 启动开发环境（热重载）
task build          # 构建生产二进制（含前端）
task build-all      # 多平台构建
task run            # 生产模式运行
task lint           # 自动修复代码风格并执行检查
task check          # 完整检查（后端 + CLI + 前端类型 + mod tidy）
task test           # 运行测试（race 检测 + 覆盖率）
task clean          # 清理构建产物
task update-tools   # 更新开发工具
task build-cli      # 构建 CLI
task build-cli-all  # 多平台构建 CLI
```

## 目录概览

```text
cmd/niubility/            # 主站入口与本地配置
cli/                      # 独立 CLI 工具（cobra + viper）
internal/config/          # YAML 基础配置加载（支持 PostgreSQL / MySQL）
internal/entity/          # 数据模型与领域类型
internal/handler/         # HTTP 处理器、路由注册、中间件
internal/service/         # 业务逻辑、数据库操作、集成逻辑
website/src/              # React 前端
  ├── api/                #   API 请求函数
  ├── types/              #   TypeScript 类型定义
  ├── views/              #   页面组件
  │   ├── home/           #     首页
  │   ├── video/          #     视频详情与编辑
  │   ├── gallery/        #     图库详情与编辑
  │   ├── article/        #     文章详情与编辑
  │   ├── podcast/        #     播客详情与编辑
  │   ├── profile/        #     用户主页
  │   ├── following/      #     关注动态
  │   ├── settings/       #     用户设置（账号、内容、收藏、浏览、点赞、评论、安全、通知）
  │   ├── admin/          #     管理后台
  │   │   ├── contents/   #       内容管理（按类型分页）
  │   │   ├── users/      #       用户管理
  │   │   ├── categories/ #       分类管理
  │   │   ├── backups/    #       数据库备份
  │   │   ├── nodes/      #       服务节点
  │   │   └── settings/   #       系统设置
  │   ├── init/           #     系统初始化
  │   ├── login/          #     登录
  │   ├── register/       #     注册
  │   └── errors/         #     错误页面
  ├── components/         #   共享组件（UI、编辑器、上传、播放器等）
  ├── layouts/            #   布局组件（MainLayout、AdminLayout、SettingsLayout）
  └── router.tsx          #   路由配置
pkg/sso/                  # OIDC / SAML Provider
pkg/textencrypt/          # AES-256-GCM 文本加密
pkg/gormlog/              # GORM 日志适配器
.agents/rules/            # AI 协作细则
.agents/skills/           # AI 工作流技能
```

## AI 协作入口

所有工具在开始工作前必须先阅读本文件，再按任务类型补读对应规则：

- 后端接口与 handler：`.agents/rules/backend-handler.md`
- 业务逻辑与 service：`.agents/rules/backend-service.md`
- 复杂查询与 ORM / SQL 取舍：`.agents/rules/query-and-sql.md`
- settings、SSO、S3、资源分发、企业微信、数据库备份：`.agents/rules/settings-and-integrations.md`
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
- 支持 PostgreSQL（默认）和 MySQL，通过 YAML 配置 `driver` 切换
- YAML 仅保留基础启动配置（地址、数据库驱动和连接字符串），其他运行期配置以 `settings` 表为准
- JWT 密钥、加密密钥、SSO 凭据、企业微信密钥、S3 secret、备份错误明细等敏感值不得明文暴露
- 服务节点心跳由服务启动后自动上报；涉及节点状态展示时，不要绕开现有 `service_nodes` / heartbeat 逻辑

### 前端

- 路由使用 React Router v7，延续 `MainLayout`、`AdminLayout`、`SettingsLayout`
- 服务端状态管理使用 React Query（`@tanstack/react-query`），不引入额外状态管理库
- API 调用放在 `website/src/api/`
- 类型定义放在 `website/src/types/`
- 页面放在 `website/src/views/`
- 富文本编辑使用 Tiptap，视频播放使用 Video.js
- 拖拽排序使用 dnd-kit
- 优先复用现有 shadcn/ui 与 Tailwind 风格，不随意引入新的 UI 基础设施

### CLI

- 独立 Go 模块，位于 `cli/`，使用 cobra 命令框架和 viper 配置管理
- 通过 Cookie Jar 复用主站 JWT 会话，不引入独立认证协议
- 已支持密码登录与浏览器 SSO；涉及 SSO 改动时同步检查 `/api/v1/sso/cli/*`
- 构建：`task build-cli` 或 `task build-cli-all`

## 强制规则

- 修改代码前，阅读与任务直接相关的 `.agents/rules/*.md`
- 遵守现有分层和目录结构，不为局部改动重塑架构
- 涉及 API、设置项、上传链路、SSO、企业微信、数据库备份、服务节点时，检查前后端和文档联动
- 涉及敏感信息时，日志、测试数据、文档示例中都必须脱敏
- 文档中的流程图、时序图、状态流转图统一使用 `Mermaid`，不要再提交 ASCII 图或截图式流程图
- 没有完成相应验证前，不要宣称“已完成”“已修复”“测试通过”

## 推荐做法

- API 变更同步更新前端 client、类型和必要文档
- 新增后端逻辑优先补充对应单元测试
- 优先复用统一接口，不继续扩散已废弃接口模式
- 小步修改，保持 handler、service、view 文件职责清晰
- 设计文档要明确区分“已实现”“部分实现”“设计中”，不要让 roadmap 与 README 相互矛盾

## 本项目常见改动面

- 内容、评论、点赞、收藏、关注、浏览记录：注意计数字段、关联查询和权限
- 分类与路由：注意启用状态、排序、动态 `/:slug` 路由影响
- 上传与资源访问：注意 presign、对象 key、访问 URL、资源分发和权限边界
- 设置管理：注意 `entity.Setting*` 常量、service 读取逻辑、管理端表单和脱敏返回
- SSO 与企业微信：注意回调地址、协议字段、密钥脱敏和错误日志
- 数据库备份：注意 `pg_dump` / `mysqldump` 依赖、对象存储前缀、下载 TTL、错误脱敏和并发保护
- 服务节点：注意 node type、心跳超时、环境元信息与后台展示联动

## 提交前最小检查

- 每次提交前必须先执行 `task check`，未通过不得提交
- 运行与改动匹配的验证命令，至少覆盖被修改的核心路径
- 检查是否需要同步更新前端 API/types、设置页、文档或测试
- 检查是否引入了敏感信息、破坏了启动流程或偏离现有分层

更细的检查项见 `.agents/rules/testing.md` 与 `.agents/rules/change-checklist.md`。
