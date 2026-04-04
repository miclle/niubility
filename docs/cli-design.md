# Niubility CLI 工具设计方案

## 文档定位

本文档同时承载两层信息：

1. **愿景设计**：描述 Niubility CLI 长期希望覆盖的使用场景与能力边界
2. **落地设计**：基于当前仓库已有 API、认证方式、内容模型与上传链路，收敛出可实施的 MVP 与分阶段路线图

阅读时应优先区分“长期方向”和“当前实现约束”。后续开发、排期与实现评审，应以“落地设计”和相关 roadmap 文档为准，例如 [docs/roadmap.md](./roadmap.md)。

## 愿景设计

### 产品目标

为 Niubility 平台提供一个面向技术用户的命令行工具，让用户能够在终端中完成以下事情：

1. **本地写作并发布内容**：使用自己熟悉的编辑器和文件组织方式，发布文章、图库或视频内容
2. **终端浏览平台内容**：查看列表、过滤、搜索、阅读详情，不必频繁切换浏览器
3. **脚本化批量操作**：结合 shell、管道和 CI，完成批量发布、导出、校验、管理操作

### 长期能力地图

长期来看，CLI 可以覆盖以下能力：

- 认证与会话管理
- 内容浏览、筛选、搜索、详情查看
- 文章发布与更新
- 图库、视频内容发布与更新
- 评论、点赞、收藏、关注等互动能力
- 个人内容与收藏管理
- 批量导入、导出、迁移
- TUI 浏览模式
- shell completion 与脚本友好输出

### 愿景命令集

以下命令集代表长期方向，不等同于当前阶段必须一次性实现：

```bash
niubility login
niubility logout
niubility whoami

niubility content list
niubility content ls
niubility content view <id>
niubility content get <id>
niubility content create article <file.md>
niubility content new article <file.md>
niubility content create gallery <dir>
niubility content new gallery <dir>
niubility content create video <dir>
niubility content new video <dir>
niubility content edit <id>
niubility content delete <id>
niubility content rm <id>

niubility category list
niubility category ls

niubility comment list --content <id>
niubility comment ls --content <id>
niubility comment create --content <id>
niubility like toggle --type content --id <id>
niubility favorite list
niubility favorite ls
niubility favorite toggle <id>
```

## 当前仓库现状与关键约束

当前 Niubility 仓库已经提供了 CLI 所需的大部分基础接口，但 CLI 设计必须对齐现有实现，不能假设存在另一套协议。

### 认证与会话

当前后端并不是返回 bearer token 给前端保存，而是：

- `POST /api/v1/login` 校验用户名密码
- 服务端签发 JWT
- JWT 通过 `HttpOnly` Cookie `NIUBILITY` 下发
- 后续接口由中间件从 Cookie 中完成鉴权

因此 CLI 的首选实现方案不是“保存 token 字符串”，而是：

- 保存 `server` 地址
- 保存一个本地 cookie jar 或等价的会话持久化文件
- 后续请求自动携带 Cookie

如果未来后端新增专用 token/API key 机制，可以再迭代认证设计；在现阶段不应以不存在的 token 协议为前提。

### 启动与系统状态

当前存在 `GET /api/v1/boot`，可以一次性返回：

- 系统是否已初始化
- 当前认证状态
- 当前用户信息
- 分类列表
- 是否允许注册
- 是否启用 SSO
- SSO 登录地址

CLI 启动、自检、`whoami`、首次配置和分类缓存，均应优先复用 `boot`，而不是额外拼装多个请求。

### 内容模型

当前平台内容类型固定为：

- `article`
- `gallery`
- `video`

内容公共字段包括：

- `title`
- `summary`
- `body`
- `cover_url`
- `type`
- `status`
- `category`
- `tags`
- `speaker_id`
- `speaker_name`
- `speaker_bio`
- `attachments`

其中：

- `article` 的正文当前实际存储为 HTML，而不是 Markdown 原文
- `gallery` 与 `video` 严重依赖附件数组而非单一正文
- `status` 当前为 `draft` / `published`

因此 CLI 如果支持“本地 Markdown 发布文章”，本质上是在 CLI 侧完成 **Markdown -> HTML** 转换，再调用现有内容创建接口。

### 上传链路

当前文件上传链路为：

1. 调用 `POST /api/v1/upload/presign`
2. 后端返回 `presigned_url` 与 `key`
3. 客户端直接 PUT 到对象存储
4. 内容创建时在 `attachments` 或 `cover_url/body` 中引用返回的 `key`
5. 平台通过 `/attachments/{key}` 或 `/avatars/{key}` 访问文件

需要注意：

- 返回的 `key` 是对象文件名，不是完整 URL
- 实际对象存储中的 key 会带 `attachments/` 或 `avatars/` 前缀
- CLI 不能把 presign 返回值误认为公开 URL
- CLI 应统一负责“本地路径 -> 上传 -> 替换引用 key/访问路径”的映射

### 文章正文与附件关系

当前 Web 端文章编辑流程不是“纯 Markdown 存储”，而是：

- 正文编辑器输出 HTML
- 正文中的图片 URL 需要同时进入附件列表
- 封面图也会进入附件列表并标记 `is_cover`
- 文档附件单独进入 `attachments`

因此 CLI 文档必须明确：

- Markdown 正文是作者输入格式，不是平台原生存储格式
- 发布时需要提取本地图片、封面图、文档附件并构造 `attachments`
- `content view` 如果做终端阅读，需要考虑 HTML -> 纯文本/Markdown 风格展示，而不是假设接口直接返回 Markdown

### 已有筛选与分页能力

当前内容列表接口已经支持：

- `category`
- `type`
- `status`
- `keyword`
- `tag`
- `sort`
- `author_id`
- `speaker_id`
- `followed_by_user_id`
- cursor 分页

CLI 设计应直接暴露这些能力，而不是只停留在 `--category`、`--type` 两个参数。

### 现有约束

- 当前仓库没有独立的 CLI 工程，CLI 仍是新建子项目
- 当前文章内容链路围绕 HTML 展示，CLI 需要做格式适配
- 当前没有专用“批量管理接口”或“CLI 专用 token”
- 当前评论、点赞、收藏、关注接口可复用，但不应挤占 MVP
- 当前图库短视频存在 200MB 大小约束；前端还额外做了 120 秒时长限制，CLI 是否复用该限制需要在实现阶段明确

## 技术选型

### 核心栈

| 组件 | 选择 | 说明 |
|------|------|------|
| 语言 | Go | 与平台后端一致，单二进制分发 |
| 命令框架 | [cobra](https://github.com/spf13/cobra) | Go CLI 标准框架，支持子命令、自动补全、帮助生成 |
| 配置管理 | [viper](https://github.com/spf13/viper) | 管理 `server`、本地用户配置、会话文件路径等 |
| HTTP 客户端 | Go `net/http` | 搭配 cookie jar 即可满足当前会话模型 |
| Markdown 解析 | 待实现时选型 | 用于 front-matter 解析、正文转换、资源提取 |
| 终端渲染 | 待实现时选型 | 仅在明确 `content view` 的输入输出后引入；不预设必须使用 glamour |
| 交互式 TUI | 后续阶段再引入 | 当前不是 MVP 必需，避免过早引入 bubbletea |

### 选型调整说明

相较早期设想，这里做两个收敛：

1. **不把 TUI 当作 MVP 前提**
   当前核心目标是先把协议跑通、发布链路打通、命令行参数打磨好

2. **不把“终端渲染 Markdown”当作既定事实**
   因为当前文章详情实际拿到的是 HTML，终端展示策略需要围绕 HTML 兼容与降级渲染设计

## 落地设计

### 设计原则

1. **优先复用现有 API，不引入并行协议**
2. **先把 article 场景做扎实，再扩展 gallery/video**
3. **先支持非交互命令与脚本化输出，再考虑 TUI**
4. **MVP 以“能发布、能查看、能管理基础会话”为先**
5. **所有命令都要兼顾人读输出与脚本调用**

### CLI 配置

建议配置目录：

```text
~/.config/niubility/
├── config.yaml      # server、默认输出格式、编辑器等
└── cookies.json     # 会话持久化
```

建议配置项：

- `server`
- `output`：`table` / `json`
- `editor`
- `default_status`
- `timeout`

建议配置文件示例：

```yaml
server: "http://127.0.0.1:9000"
output: "table"
editor: "vim"
default_status: "draft"
timeout: "30s"
cookie_jar: "~/.config/niubility/cookies.json"
```

字段约定：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `server` | string | 是 | Niubility 服务地址，默认不带 `/api/v1` 后缀 |
| `output` | string | 否 | 默认输出格式，支持 `table` / `json` |
| `editor` | string | 否 | `content edit` 使用的编辑器命令 |
| `default_status` | string | 否 | 新建内容默认状态，建议仅允许 `draft` / `published` |
| `timeout` | string | 否 | HTTP 请求超时时间 |
| `cookie_jar` | string | 否 | 会话文件路径，默认放在配置目录下 |

实现约束：

- CLI 启动时应自动创建配置目录
- `~` 应展开为用户目录
- 读取失败时，如果文件不存在，允许按默认值启动
- 配置文件损坏时应给出明确错误，不应静默覆盖

### 命令设计

### alias 约定

为了兼顾易记忆和 shell 习惯，建议采用以下规则：

- 一级命令不做极短缩写，例如不把 `content` 缩成 `c`
- 二级动作允许提供常见 alias，如 `list -> ls`、`delete -> rm`
- alias 只作为便捷入口，帮助文档与示例仍以完整命令为主
- 新增 alias 时应避免和已有命令语义冲突

建议 alias：

| 完整命令 | alias |
|------|------|
| `content list` | `content ls` |
| `content view` | `content get` |
| `content create` | `content new` |
| `content delete` | `content rm` |
| `category list` | `category ls` |
| `comment list` | `comment ls` |
| `favorite list` | `favorite ls` |

#### Phase 1 命令

```bash
niubility login
niubility logout
niubility whoami

niubility category list
niubility category ls

niubility content list
niubility content ls
niubility content view <id>
niubility content get <id>
niubility content create article <file.md>
niubility content new article <file.md>
niubility content delete <id>
niubility content rm <id>
```

#### Phase 2 命令

```bash
niubility content edit <id>
niubility favorite list
niubility favorite ls
niubility comment list --content <id>
niubility comment ls --content <id>
niubility comment create --content <id>
niubility like toggle --type content --id <id>
```

#### Phase 3 命令

```bash
niubility content create gallery <dir>
niubility content new gallery <dir>
niubility content create video <dir>
niubility content new video <dir>
niubility tui
niubility completion <shell>
```

### 命令细节

#### `login`

行为建议：

1. 从参数或交互输入读取用户名密码
2. 调用 `/api/v1/login`
3. 将响应 Cookie 保存到本地 cookie jar
4. 再调用 `/api/v1/boot` 校验登录状态
5. 输出当前用户、站点地址、认证结果

可选参数建议：

- `--server`
- `--username`
- `--password-stdin`

#### `logout`

行为建议：

- 删除本地 cookie jar
- 可选调用 `/logout`
- 清除本地缓存状态

#### `whoami`

行为建议：

- 调用 `/api/v1/boot`
- 输出：
  - 当前用户
  - 认证状态
  - 系统初始化状态
  - 注册/SSO 状态

#### `category list`

调用接口：

- `GET /api/v1/categories`

展示建议：

- `name`
- `slug`
- `content_count`
- `sort_order`

#### `content list`

调用接口：

- `GET /api/v1/contents`

建议支持参数：

- `--limit`
- `--cursor`
- `--category`
- `--type`
- `--status`
- `--keyword`
- `--tag`
- `--sort`
- `--author-id`
- `--speaker-id`
- `--followed-by-user-id`
- `--json`

默认行为建议：

- 默认按服务端行为获取已发布内容
- 输出紧凑表格：`id/title/type/category/status/created_at`
- 显示 `next_cursor`，便于脚本继续翻页

#### `content view <id>`

调用接口：

- `GET /api/v1/contents/:id`

展示策略建议：

- `article`：输出标题、摘要、标签、作者、正文的终端友好版本
- `video`：输出标题、简介、主讲人、视频附件、文档附件
- `gallery`：输出标题、摘要、媒体列表、封面项

注意：

- 不应假设正文是 Markdown
- 对 article 应优先做 HTML -> 终端文本的安全降级
- 附件 URL 应输出可复制访问链接

#### `content create article <file.md>`

这是第一阶段最重要的命令，需要明确采用“作者输入 Markdown，平台存储 HTML”的适配方案。

输入文件建议支持 front-matter：

```markdown
---
title: Go 性能优化实践
summary: 分享常见的 Go 性能优化技巧
category: learning
tags: [go, 性能]
status: draft
cover: ./cover.png
attachments:
  - ./slides.pdf
speaker_name: 张三
speaker_bio: 基础架构工程师
---

正文内容...
```

建议流程：

1. 读取 front-matter 与 Markdown 正文
2. 将 Markdown 转为平台可接受的 HTML
3. 扫描正文中的本地图片引用
4. 如存在封面图、正文图片、文档附件，则逐个走 presign + PUT 上传
5. 将正文中的本地路径替换为平台访问路径
6. 构造 `attachments`
7. 调用 `POST /api/v1/contents`
8. 输出内容 ID、状态、访问链接

附件构造约定建议：

- 封面图：进入 `attachments`，类型为 `image`，`is_cover=true`
- 正文内图片：进入 `attachments`，类型为 `image`
- 附件区文档：进入 `attachments`，类型为 `document`

#### `content delete <id>`

调用接口：

- `DELETE /api/v1/contents/:id`

建议：

- 默认二次确认
- 支持 `--yes`

### front-matter 约定

为降低实现歧义，第一阶段建议仅支持以下 front-matter 字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 内容标题 |
| `summary` | string | 否 | 内容摘要 |
| `category` | string | 是 | 分类 slug |
| `tags` | string array | 否 | 标签列表 |
| `status` | string | 否 | `draft` / `published` |
| `cover` | string | 否 | 封面图本地路径 |
| `attachments` | string array | 否 | 文档附件本地路径列表 |
| `speaker_id` | string | 否 | 主讲人用户 ID |
| `speaker_name` | string | 否 | 非绑定用户时的主讲人名 |
| `speaker_bio` | string | 否 | 主讲人简介 |

路径解析规则：

- 所有相对路径都相对于当前 Markdown 文件所在目录解析
- 正文中的本地图片相对路径遵循同一规则
- 找不到文件时直接失败，不做静默跳过
- 同一文件被重复引用时，第一阶段可不做跨位置去重，但应保持行为稳定

字段冲突规则：

- 如果同时给出 `speaker_id` 和 `speaker_name`，优先使用 `speaker_id`
- 未提供 `status` 时，使用 CLI 配置中的 `default_status`
- 未提供 `summary` 时，不自动从正文截断生成

### 输出格式约定

第一阶段建议所有命令统一支持：

- 默认人读输出：`table`
- 机器可读输出：`--json`

`table` 约定：

- 面向终端阅读，允许简化字段、截断长文本
- 适合 `list`、`whoami`、`category list`

`json` 约定：

- 尽量保留原始响应字段命名
- 若做过 CLI 层二次封装，应在命令帮助中说明
- 错误时将错误信息输出到 stderr，stdout 不输出半结构化文本

建议输出规则：

- 成功结果输出到 stdout
- 错误信息输出到 stderr
- `--json` 模式下不应混入表格或说明性文案

### 退出码约定

建议约定以下退出码，便于脚本与 CI 使用：

| 退出码 | 含义 |
|------|------|
| `0` | 成功 |
| `1` | 通用运行时错误 |
| `2` | 参数错误或输入不合法 |
| `3` | 未认证或会话失效 |
| `4` | 权限不足 |
| `5` | 资源不存在 |
| `6` | 上传失败 |
| `7` | 配置错误 |

映射建议：

- 本地参数校验失败：退出码 `2`
- 配置文件读取失败：退出码 `7`
- 服务端 `401`：退出码 `3`
- 服务端 `403`：退出码 `4`
- 服务端 `404`：退出码 `5`
- presign 或 PUT 失败：退出码 `6`
- 其他服务端 `5xx`：退出码 `1`

### 错误处理策略

#### 通用原则

- 优先返回明确、短小、可执行的错误信息
- 不在错误中泄露 Cookie、密码、预签名 URL、对象存储凭据
- 对脚本友好场景，错误文本保持稳定，不频繁改写措辞

#### 典型场景

1. **会话失效**
   - 表现：接口返回 `401`
   - CLI 行为：提示重新执行 `niubility login`

2. **权限不足**
   - 表现：接口返回 `403`
   - CLI 行为：明确提示当前账号无权执行该操作

3. **资源不存在**
   - 表现：接口返回 `404`
   - CLI 行为：输出资源 ID 与命令上下文，例如“content `<id>` 不存在或无权访问”

4. **上传部分失败**
   - 表现：某个附件 presign 成功，但 PUT 失败
   - CLI 行为：立即终止本次发布；第一阶段不尝试自动清理已上传对象

5. **正文引用文件缺失**
   - 表现：Markdown 中图片或 front-matter 附件路径不存在
   - CLI 行为：在调用后端前直接失败，并列出缺失路径

6. **配置错误**
   - 表现：未设置 `server`、配置文件损坏、timeout 非法
   - CLI 行为：直接失败，不发起网络请求

### 接口映射表

以下映射表以第一阶段和第二阶段命令为主。

| CLI 命令 | 方法 | 路径 | 认证要求 | 关键请求/说明 |
|------|------|------|------|------|
| `login` | `POST` | `/api/v1/login` | 否 | `username`、`password`，从响应中保存 Cookie |
| `whoami` | `GET` | `/api/v1/boot` | 软鉴权 | 读取认证状态、用户、分类、初始化状态 |
| `category list` | `GET` | `/api/v1/categories` | 否 | 返回可见分类与 `content_count` |
| `content list` | `GET` | `/api/v1/contents` | 否/按接口默认行为 | 支持 `category/type/status/keyword/tag/sort/cursor` 等 |
| `content view <id>` | `GET` | `/api/v1/contents/:id` | 否，但草稿需登录且为作者/管理员 | article/video/gallery 共用 |
| `content create article <file.md>` | `POST` | `/api/v1/upload/presign` | 是 | 为封面、正文图片、文档附件逐个申请 presign |
| `content create article <file.md>` | `POST` | `/api/v1/contents` | 是 | 提交 `title/body/cover_url/type/status/category/tags/attachments` |
| `content delete <id>` | `DELETE` | `/api/v1/contents/:id` | 是 | 仅作者或管理员可删除 |
| `favorite list` | `GET` | `/api/v1/favorites` | 是 | 支持分页 |
| `comment list --content <id>` | `GET` | `/api/v1/comments` | 是 | 必须传 `content_id` |
| `comment create --content <id>` | `POST` | `/api/v1/comments` | 是 | `content_id/body`，可选回复字段 |
| `like toggle --type <t> --id <id>` | `POST` | `/api/v1/likes` | 是 | `target_type` 支持 `content/comment/attachment` |

补充说明：

- `logout` 主要是本地会话清理，可选调用 `/logout`
- article 发布流程至少会包含一次内容创建请求和多次上传请求
- 第一阶段不要求封装 favorites/comments/likes，但文档已为第二阶段保留接口映射

### gallery / video 的后续落地方向

`gallery` 与 `video` 的 CLI 支持建议放到第二阶段之后，原因如下：

- 它们比 article 更依赖附件组织与元数据构造
- `video` 需要组织视频列表、封面、文档附件、主讲人字段
- `gallery` 需要组织图片/短视频顺序、封面项、尺寸/时长等信息

建议届时采用“目录 + manifest”模式，而不是把复杂元数据硬塞进命令参数，例如：

```text
my-gallery/
├── manifest.yaml
├── cover.jpg
├── 001.jpg
├── 002.jpg
└── clip.mp4
```

## 项目结构（预期）

```text
cli/
├── cmd/
│   ├── root.go
│   ├── login.go
│   ├── logout.go
│   ├── whoami.go
│   ├── category.go
│   └── content.go
├── internal/
│   ├── api/                 # HTTP client、请求封装、错误映射
│   ├── auth/                # cookie jar、会话持久化
│   ├── config/              # 本地配置读取
│   ├── content/             # 内容构造、front-matter、HTML 转换、附件映射
│   ├── upload/              # presign + PUT 上传流程
│   ├── output/              # table/json 输出
│   └── tui/                 # 后续阶段引入
├── main.go
├── go.mod
├── Taskfile.yaml
└── README.md
```

## 分阶段路线图

### Phase 0：协议对齐

- [x] 明确 CLI 会话存储格式（cookie jar 文件）
- [x] 明确 article 发布时 Markdown -> HTML 转换策略
- [x] 明确正文图片、封面图、文档附件的统一映射规则
- [x] 明确 `content view` 对 article HTML 的终端展示策略

### Phase 1：可用 MVP

- [x] CLI 脚手架
- [x] 全局配置与 `--server`
- [x] cookie jar 持久化
- [x] `login`
- [x] `logout`
- [x] `whoami`
- [x] `category list`
- [x] `content list`
- [x] `content view`
- [x] `content create article <file.md>`
- [x] `content delete`
- [x] `user list / view / create / update / delete`（超出 MVP 范围，已实现）
- [x] SSO 登录（`login --sso`，超出 MVP 范围，已实现）
- [x] Profile 多环境支持（`--profile`，超出 MVP 范围，已实现）

### Phase 2：增强能力

- [x] `content edit <id>`
- [x] `favorite list` / `favorite toggle`
- [x] `comment list` / `comment create` / `comment delete`
- [x] `like toggle`
- [x] `follow toggle` / `following list` / `followers list`
- [ ] `profile view` / `profile update` / `profile change-password`
- [ ] 更完善的 `--json` 输出与错误码约定
- [ ] 打包与发布流程

### Phase 2.5：管理员增强

- [x] `category create` / `category update` / `category delete`
- [ ] `category reorder`
- [ ] `settings list` / `settings update`
- [ ] `comment pin`（管理员）

### Phase 3：扩展内容类型与体验

- [ ] `content create gallery <dir>`
- [ ] `content create video <dir>`
- [ ] shell completion
- [ ] TUI 浏览模式
- [ ] 批量导入/导出

## 当前建议的实现优先级

如果近期真的要开始做 CLI，建议优先顺序如下：

1. 打通 `login -> whoami -> category list -> content list`
2. 打通 article 的上传与发布链路
3. 补 `content view`
4. 再做删除、编辑、互动命令
5. 最后再考虑 TUI 与多内容类型发布

## 测试策略

建议按四层组织测试，而不是只靠手工验证。

### 1. 单元测试

覆盖范围建议：

- 配置读取与默认值
- alias 与参数解析
- front-matter 解析
- Markdown -> HTML 转换
- 本地路径解析
- 上传引用替换
- 输出格式化
- 退出码映射

### 2. API 集成测试

建议使用 mock server 或 `httptest`，覆盖：

- `login -> whoami`
- `category list`
- `content list`
- `content view`
- `content create article`
- `content delete`
- `401/403/404/500` 映射

### 3. 端到端测试

建议在本地真实环境验证：

1. 启动 Niubility
2. 准备一个可用测试账号
3. 如需上传，准备可用 S3 配置
4. 依次执行：
   - `login`
   - `whoami`
   - `category list`
   - `content list`
   - `content create article demo.md`
   - `content view <id>`
   - `content delete <id>`

### 4. Golden Tests

适合以下命令：

- `content list`
- `content view`
- `category list`
- `whoami`

用于稳定检查人读输出，避免格式改动破坏脚本或使用体验。

## Phase 1 验收标准

只有满足以下条件，才可以认为第一阶段完成。

### 功能验收

- `login` 能成功保存会话，失败时能区分账号错误与配置错误
- `logout` 能清理本地会话
- `whoami` 能正确显示认证状态与当前用户
- `category list` 能列出分类与内容数
- `content list` 能分页、过滤，并输出 `next_cursor`
- `content view` 能正确展示 article/video/gallery 基本信息
- `content create article <file.md>` 能成功上传本地资源并创建内容
- `content delete <id>` 能删除当前用户有权限删除的内容

### 错误场景验收

- 未登录时访问受保护命令会返回明确错误并给出重新登录提示
- 参数错误时返回稳定退出码
- 本地图片或附件缺失时，在调用后端前失败
- presign 失败与 PUT 失败可明确区分
- 无权限删除他人内容时正确提示

### 测试验收

- 核心模块有单元测试
- 关键命令有 API 集成测试
- 至少有一条 article 发布成功的端到端验证路径
- 关键输出至少覆盖一组 golden tests 或等价校验

### 文档验收

- `README` 补充 CLI 用法
- 帮助命令与文档中的 alias、参数、示例保持一致
- 明确记录尚未支持的能力，如 gallery/video 发布、SSO 登录等

## 非目标

以下内容不应进入第一阶段：

- 自定义并行后端协议
- 独立的 CLI 鉴权体系
- 图库与视频的复杂交互式发布器
- 后台管理能力镜像到 CLI
- 为 TUI 提前重构全部命令层

## 待后续明确的问题

- ~~CLI 是否要支持 SSO 登录，还是第一阶段仅支持用户名密码~~ → 已实现 SSO 登录
- ~~article 的 Markdown 转 HTML 选型与允许语法范围~~ → 已选型 gomarkdown/markdown
- `content view` 是否需要保留原始 HTML/JSON 输出模式
- gallery 短视频是否沿用 Web 端 120 秒限制，还是只沿用后端 200MB 限制
- 是否需要在后端新增更适合 CLI 的导入/导出接口

## 当前实现状态与差距分析（2026-04-04 更新）

### 已实现功能

| 功能 | 状态 | 备注 |
|------|------|------|
| `login`（用户名密码 + SSO） | ✅ | 含 `--sso`、`--password-stdin` |
| `logout` | ✅ | |
| `whoami` | ✅ | |
| `category list` | ✅ | |
| `content list`（含全部筛选参数） | ✅ | 支持 category/type/status/keyword/tag/sort/author_id/speaker_id/followed_by |
| `content view` | ✅ | 支持 article/gallery/video |
| `content create article`（Markdown + 上传） | ✅ | 含 front-matter、图片上传、附件上传 |
| `content delete` | ✅ | |
| `user list/view/create/update/delete` | ✅ | 管理员功能，超出 Phase 1 |
| Profile 多环境 `--profile` | ✅ | 超出 Phase 1 |

### 缺失功能（按优先级排列）

#### P1：内容更新 — 补齐 CRUD 关键一环

后端已有 `PUT /api/v1/contents/:id`，CLI 缺少 `content edit/update` 命令和 API client 方法。

| 功能 | 后端接口 | CLI 状态 |
|------|---------|---------|
| `content edit <id>` | `PUT /api/v1/contents/:id` | ❌ 缺失 |

#### P2：社交功能 — 互动能力

后端已提供完整接口，CLI 完全未覆盖。

| 功能 | 后端接口 | CLI 状态 |
|------|---------|---------|
| 评论列表 | `GET /api/v1/comments` | ❌ |
| 创建评论 | `POST /api/v1/comments` | ❌ |
| 删除评论 | `DELETE /api/v1/comments/:id` | ❌ |
| 点赞切换 | `POST /api/v1/likes` | ❌ |
| 收藏列表 | `GET /api/v1/favorites` | ❌ |
| 收藏切换 | `POST /api/v1/contents/:id/favorite` | ❌ |
| 关注/取关 | `POST /api/v1/users/:username/follow` | ❌ |
| 关注列表 | `GET /api/v1/users/:username/following` | ❌ |
| 粉丝列表 | `GET /api/v1/users/:username/followers` | ❌ |

#### P3：管理员分类管理

| 功能 | 后端接口 | CLI 状态 |
|------|---------|---------|
| 创建分类 | `POST /api/v1/admin/categories` | ❌ |
| 更新分类 | `PUT /api/v1/admin/categories/:id` | ❌ |
| 删除分类 | `DELETE /api/v1/admin/categories/:id` | ❌ |
| 排序分类 | `POST /api/v1/admin/categories/reorder` | ❌ |

#### P4：个人资料管理

| 功能 | 后端接口 | CLI 状态 |
|------|---------|---------|
| 查看/修改个人资料 | `GET/PATCH /api/v1/profile` | ❌ |
| 修改密码 | `POST /api/v1/profile/change-password` | ❌ |
| 头像上传 | `POST /api/v1/profile/upload` | ❌ |

#### P5：管理员设置管理

| 功能 | 后端接口 | CLI 状态 |
|------|---------|---------|
| 列出设置 | `GET /api/v1/admin/settings` | ❌ |
| 更新设置 | `PATCH /api/v1/admin/settings` | ❌ |

#### P6（Phase 3）：Gallery/Video 创建

- `content create gallery <dir>` — 需目录 + manifest 模式
- `content create video <dir>` — 需目录 + manifest 模式

### 需要的代码改动

1. **`cli/internal/api/methods.go`** — 补充 `UpdateContent`、Comments、Likes、Favorites、Follows、Profile、Admin Categories、Admin Settings 的 API 方法
2. **`cli/internal/api/types.go`** — 补充上述接口对应的请求/响应类型
3. **`cli/cmd/`** — 新增各命令文件
