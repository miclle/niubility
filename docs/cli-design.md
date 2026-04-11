# Niubility CLI 设计与现状

## 文档定位

本文档同时描述两部分内容：

1. 当前 `cli/` 子项目已经实现了什么
2. 接下来 CLI 应继续如何收敛，而不是重新发明另一套协议

阅读时请优先以“当前实现状态”为准，路线图类内容再参考 [roadmap](./roadmap.md)。

## 当前实现状态

仓库已经包含独立 CLI 子项目，位于 [`cli/`](../cli/)。

### 已实现命令面

- 认证：`login`、`logout`、`whoami`
- 内容：`content list`、`content view`、`content create article`、`content edit`、`content delete`
- 分类：`category list/create/update/delete`
- 用户：`user list/view/create/update/delete`
- 个人资料：`profile`
- 互动：`comment`、`favorite`、`follow`、`like`
- 设置：`settings list/set`
- 配置：`config`

### 已实现认证方式

- 用户名密码登录
- 浏览器 SSO 登录
- Cookie Jar 会话复用
- 多 profile 隔离

### 当前限制

- CLI 侧真正打通的内容创建/编辑流程仍以 `article` 为主
- 虽然平台内容类型已包含 `podcast`，CLI 仍未提供播客/视频/图库的一等发布流程
- 文章详情查看目前主要是原始 HTML / 文本预览，不是完整富文本终端渲染体验

## 设计原则

- CLI 必须复用现有服务端 API，不另起一套 token 协议
- CLI 会话以 Cookie 为核心，不绕开 Web 鉴权模型
- 能通过 `GET /api/v1/boot` 获取的信息，不拆成多次请求重复拼装
- 对“已支持”和“规划支持”的边界要清晰，避免 README 与 CLI 帮助信息不一致

## 当前协议约束

### 认证与会话

当前平台的登录模型是：

- `POST /api/v1/login`
- 服务端签发 JWT
- 通过 `HttpOnly` Cookie 下发
- 后续请求靠 Cookie 完成鉴权

因此 CLI 的正确做法是：

- 保存 `server`
- 保存本地 Cookie Jar / access token 同步信息
- 后续请求自动携带 Cookie

### 启动与自检

`GET /api/v1/boot` 可返回：

- 系统是否已初始化
- 当前认证状态
- 当前用户信息
- 分类列表
- 是否允许注册
- 是否启用 SSO
- SSO 登录地址
- 站点配置

CLI 的登录前探测、自检、`whoami` 和一些初始化逻辑都应尽量复用该接口。

### 内容模型

平台当前内容类型为：

- `article`
- `gallery`
- `video`
- `podcast`

CLI 当前真正打通的是 `article` 的 Markdown 发布流程。其他内容类型在平台存在，但不应在 CLI 文档里被写成“已支持发布”。

### 上传链路

当前文件上传流程为：

1. `POST /api/v1/upload/presign`
2. 服务端返回 `presigned_url` 与 `key`
3. 客户端直传对象存储
4. 创建/更新内容时引用 `key`

CLI 文档需要明确：

- `key` 不是公开 URL
- CLI 负责本地文件到对象 key 的映射
- 访问 URL 的拼装依赖平台现有附件访问与分发逻辑

## 文章工作流

### 当前实现

- 读取 Markdown 文件
- 解析 front-matter
- 上传封面和附件
- Markdown 转 HTML
- 调用现有内容创建/更新接口

### front-matter 重点

- `title`
- `summary`
- `category`
- `tags`
- `status`
- `cover`
- `attachments`
- `speaker_id`
- `speaker_name`
- `speaker_bio`

### 说明

- 平台原生存储的文章正文是 HTML，不是 Markdown 原文
- Markdown 只是 CLI 作者输入格式

## SSO

CLI SSO 已有实现基础，详细设计见 [CLI SSO 登录设计](./cli-sso-login-design.md)。

当前原则是：

- 浏览器只与 Niubility 服务和 IdP 交互
- CLI 本地只接收短期有效的 ticket
- 服务端负责 OIDC / SAML 协议处理

## 后续方向

- 为 `gallery`、`video`、`podcast` 增加稳定的发布流程
- 打磨 `content view` 的终端阅读体验
- 补齐更多端到端验证
- 增加更完整的打包、版本与发布说明
