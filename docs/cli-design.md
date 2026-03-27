# Niubility CLI 工具设计方案

## 概述

为 Niubility 平台设计一个命令行工具，让用户可以在终端中浏览内容、发布文章、管理自己的内容。目标用户是技术人员，CLI 对他们是天然友好的交互方式。

## 核心场景

1. **本地写 Markdown → 一键发布**：用自己喜欢的编辑器写文章，通过 CLI 发布到平台
2. **终端浏览内容**：快速翻阅列表、搜索、查看详情，不用切换到浏览器
3. **批量管理**：结合 shell 管道做批量操作（打标签、归类、导出等）

## 技术选型

| 组件 | 选择 | 说明 |
|------|------|------|
| 语言 | Go | 与平台后端一致，单二进制分发 |
| 命令框架 | [cobra](https://github.com/spf13/cobra) | Go CLI 标准框架，支持子命令、自动补全、帮助生成 |
| 交互式 TUI | [bubbletea](https://github.com/charmbracelet/bubbletea) | 内容列表浏览、分类选择等交互场景 |
| 终端渲染 | [glamour](https://github.com/charmbracelet/glamour) | 终端内渲染 Markdown 内容 |
| 配置管理 | [viper](https://github.com/spf13/viper) | 管理认证 token 和用户配置 |

## 命令设计

```
niubility login                         # 登录，保存 token 到 ~/.config/niubility/
niubility logout                        # 登出，清除本地 token

niubility content list                  # 浏览内容列表（支持 --category, --type 过滤）
niubility content view <id>             # 查看内容详情（终端渲染 Markdown）
niubility content create <file.md>      # 从本地 Markdown 文件发布内容
niubility content edit <id>             # 拉取内容到本地编辑后更新
niubility content delete <id>           # 删除内容

niubility category list                 # 查看分类列表
```

### 认证机制

- `niubility login` 通过用户名密码登录，将 JWT token 保存到 `~/.config/niubility/config.yaml`
- 后续命令自动从配置文件读取 token，无需每次输入密码
- token 过期时提示重新登录
- 支持 `--server` 全局 flag 指定平台地址

### 内容发布流程

```
niubility content create article.md --category learning --tags "go,性能"
```

1. 解析 Markdown 文件
2. 扫描本地图片引用（`![](local.png)`），上传到 S3，替换为远程 URL
3. 提取 front-matter 元数据（标题、摘要、分类、标签等）
4. 调用平台 API 创建内容
5. 返回内容 URL

Markdown front-matter 示例：

```markdown
---
title: Go 性能优化实践
summary: 分享常见的 Go 性能优化技巧
category: learning
tags: [go, 性能]
type: article
---

正文内容...
```

### 视频内容处理

视频在终端中无法直接播放，CLI 的处理策略：

- 列表和详情中显示视频元信息（标题、时长、讲者等）
- 提供浏览器链接，用户点击即可在 Web 端观看
- 支持上传视频文件发布视频类内容

## MVP 功能范围

**第一阶段（MVP）**：

- [ ] 项目脚手架（cobra 初始化、配置管理）
- [ ] `login` / `logout`（认证 + token 持久化）
- [ ] `content list`（分页浏览，支持分类过滤）
- [ ] `content view`（终端渲染 Markdown 详情）
- [ ] `content create`（从 Markdown 文件发布，含本地图片上传）
- [ ] `category list`（查看分类）

**第二阶段**：

- [ ] `content edit`（拉取 → 本地编辑 → 更新）
- [ ] `content delete`
- [ ] 交互式 TUI 浏览模式（bubbletea）
- [ ] Shell 自动补全（bash / zsh / fish）

**第三阶段**：

- [ ] 评论功能（查看 / 发表评论）
- [ ] 点赞 / 收藏
- [ ] 搜索
- [ ] 批量操作支持

## 项目结构（预期）

```
niubility-cli/
├── cmd/                     # cobra 命令定义
│   ├── root.go              # 根命令，全局 flag
│   ├── login.go             # login / logout
│   ├── content.go           # content 子命令组
│   └── category.go          # category 子命令组
├── internal/
│   ├── api/                 # API client
│   ├── config/              # 配置管理（token、server 地址）
│   ├── markdown/            # Markdown 解析、图片提取与替换
│   └── ui/                  # TUI 组件（bubbletea）
├── main.go                  # 入口
├── go.mod
├── Taskfile.yaml
└── README.md
```
