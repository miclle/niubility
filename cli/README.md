# Niubility CLI

Niubility CLI 是 Niubility 平台的命令行工具，允许用户在终端中浏览内容、发布文章、管理分类等。

## 安装

```bash
# 编译安装
go build -o niubility .

# 或安装到 GOPATH/bin
go install .
```

## 快速开始

### 1. 登录

```bash
# 交互式登录
niubility login --server http://your-server:9000

# 使用独立 profile 登录不同环境
niubility --profile prod login --server http://prod-server:9000 --sso
niubility --profile dev login --server http://dev-server:9000 --sso

# 使用浏览器 SSO 登录
niubility login --server http://your-server:9000 --sso

# 指定用户名
niubility login --server http://your-server:9000 --username admin

# 从 stdin 读取密码
echo "password" | niubility login --server http://your-server:9000 --username admin --password-stdin
```

### 2. 查看状态

```bash
niubility whoami
```

### 3. 浏览内容

```bash
# 列出所有内容
niubility content list

# 按类型筛选
niubility content list --type article

# 按分类筛选
niubility content list --category learning

# 搜索
niubility content list --keyword "golang"

# JSON 输出
niubility content list --output json
```

### 4. 查看内容详情

```bash
niubility content view 123
```

### 5. 发布文章

创建一个 Markdown 文件 `my-article.md`：

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

发布：

```bash
niubility content create article my-article.md
```

### 6. 删除内容

```bash
# 交互式确认
niubility content delete 123

# 跳过确认
niubility content delete 123 --yes
```

### 7. 管理用户

```bash
# 列出用户
niubility user list

# 搜索用户
niubility user list --search alice

# 查看用户详情
niubility user view <user-id>

# 创建管理员
niubility user create \
  --username alice \
  --email alice@example.com \
  --password secret123 \
  --role admin \
  --status activated

# 更新用户状态
niubility user update <user-id> --status deactivated

# 更新社交账号
niubility user update <user-id> --social github=alice --social x=@alice

# 清空社交账号
niubility user update <user-id> --clear-socials

# 删除用户
niubility user delete <user-id> --yes
```

## 命令列表

### 认证

| 命令 | 说明 |
|------|------|
| `niubility login` | 使用用户名密码或 `--sso` 登录到服务器 |
| `niubility logout` | 登出 |
| `niubility whoami` | 显示当前登录用户 |

### 分类

| 命令 | 说明 |
|------|------|
| `niubility category list` | 列出所有分类 |
| `niubility category ls` | 别名 |

### 用户

| 命令 | 说明 |
|------|------|
| `niubility user list` | 列出用户 |
| `niubility user ls` | 别名 |
| `niubility user view <id>` | 查看用户详情 |
| `niubility user get <id>` | 别名 |
| `niubility user create` | 创建用户 |
| `niubility user update <id>` | 更新用户 |
| `niubility user delete <id>` | 删除用户 |
| `niubility user rm <id>` | 别名 |

### 内容

| 命令 | 说明 |
|------|------|
| `niubility content list` | 列出内容 |
| `niubility content ls` | 别名 |
| `niubility content view <id>` | 查看内容详情 |
| `niubility content get <id>` | 别名 |
| `niubility content create article <file>` | 创建文章 |
| `niubility content new article <file>` | 别名 |
| `niubility content edit <id> <file>` | 更新内容 |
| `niubility content delete <id>` | 删除内容 |
| `niubility content rm <id>` | 别名 |

## 配置

配置文件位于 `~/.config/niubility/config.yaml`：

```yaml
server: "http://127.0.0.1:9000"
output: "table"
editor: "vim"
default_status: "draft"
timeout: "30s"
```

### 配置项说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `server` | string | 是 | Niubility 服务器地址 |
| `output` | string | 否 | 输出格式 (table/json) |
| `editor` | string | 否 | 编辑器命令 |
| `default_status` | string | 否 | 默认内容状态 (draft/published) |
| `timeout` | string | 否 | HTTP 请求超时时间 |

使用 `--profile <name>` 时，CLI 会改用独立的配置文件和会话文件：

- 配置文件：`~/.config/niubility/profiles/<name>.yaml`
- 会话文件：`~/.config/niubility/profiles/<name>.cookies.json`

这样可以同时保持多个不同 Niubility 平台的登录态。

## Front-matter 格式

文章 Markdown 文件支持以下 front-matter 字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 文章标题 |
| `summary` | string | 否 | 文章摘要 |
| `category` | string | 是 | 分类 slug |
| `tags` | []string | 否 | 标签列表 |
| `status` | string | 否 | 状态 (draft/published) |
| `cover` | string | 否 | 封面图本地路径 |
| `attachments` | []string | 否 | 附件本地路径列表 |
| `speaker_id` | string | 否 | 主讲人用户 ID |
| `speaker_name` | string | 否 | 主讲人名称 |
| `speaker_bio` | string | 否 | 主讲人简介 |

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 通用运行时错误 |
| 2 | 参数错误或输入不合法 |
| 3 | 未认证或会话失效 |
| 4 | 权限不足 |
| 5 | 资源不存在 |
| 6 | 上传失败 |
| 7 | 配置错误 |

## 开发

```bash
# 安装依赖
go mod tidy

# 编译
go build .

# 运行测试
go test ./...
```

## 许可证

MIT License
