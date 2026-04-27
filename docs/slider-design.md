# Slider (幻灯片) 内容类型设计方案

> 创建日期：2026-04-14

## 背景

Niubility 当前支持四种内容类型：`video`、`gallery`、`article`、`podcast`，覆盖了视频、图集、文章和播客场景。但在知识分享领域，"演讲稿/课件/方案分享"这一高频场景缺乏原生支持——用户无法直接上传 PPT/PDF/Keynote 文件并在线浏览。

### 现有类型为什么不够

| 方式 | 问题 |
|------|------|
| 用 Gallery 上传 PPT 截图 | 需要用户手动截图，且 Gallery 的网格浏览模式不适合幻灯片逐页阅读 |
| 用 Article 上传 PDF 附件 | 只能下载，无法在线浏览 |
| 用 Video 录屏讲解 | 制作成本高，不适合"只想分享一份 PPT"的场景 |

### 目标

新增 `slider` 内容类型，支持用户上传 PPT/PDF/Keynote 文件，服务端自动将文件转换为逐页图片，前端提供翻页浏览体验。

### 长远愿景：AI 语音讲解

在基础功能稳定后，利用 AI 为每页幻灯片生成讲解文案并转为语音，实现"自动演讲"体验——**低成本的视频替代品**。

```
用户上传 PPT/PDF/Keynote
       ↓
服务端转换为逐页图片
       ↓
AI 读取每页内容（文本提取）
       ↓
AI 为每页生成讲解文案
       ↓
TTS 将文案转为语音（每页一段音频）
       ↓
前端播放：翻到第 N 页 → 播放第 N 段语音
```

---

## 分阶段规划

| 阶段 | 范围 | 目标 |
|------|------|------|
| **Phase 1** | Slider 内容类型 + PDF 上传 + 转图片 + 翻页浏览 | 跑通核心链路 |
| **Phase 2** | 支持 PPT/PPTX 和 Keynote 上传 | 补齐格式支持 |
| **Phase 3** | AI 语音讲解 | 差异化体验 |

---

## Phase 1：Slider 基础功能（PDF 上传 + 转图片 + 翻页浏览）

### 1.1 产品体验

#### 创建流程

1. 用户点击"创建 Slider"
2. 填写标题、分类、标签等基本信息
3. 上传一个 PDF 文件
4. 系统显示"转换中"状态
5. 转换完成后，用户可预览每页幻灯片
6. 用户可为每页编辑标题和描述（可选）
7. 点击发布

#### 浏览体验

- 详情页展示翻页浏览器：左右箭头翻页、键盘方向键支持、页码显示
- 支持全屏演示模式
- 每页下方可展示该页的标题和描述（如果有）
- 底部显示缩略图导航条，点击可快速跳转

### 1.2 数据模型

#### 复用现有 `contents` 表

`slider` 与其他内容类型共享 `contents` 单表，通过 `type = 'slider'` 区分。

**使用的字段**：

| 字段 | 用途 |
|------|------|
| `title` | 幻灯片标题 |
| `summary` | 简介 |
| `cover_url` | 封面（取第一页转换后的图片） |
| `type` | `"slider"` |
| `status` | `draft` / `published` |
| `category` | 分类 |
| `tags` | 标签 |
| `body` | 暂不使用，预留给 Phase 3 存储 AI 生成的完整讲稿 |

**不使用的字段**：`speaker_id`、`speaker_name`、`speaker_bio`（幻灯片不需要主讲人信息）

#### 复用现有 `attachments` 表

每页转换后的图片存储为一条 `attachment` 记录：

| 字段 | 用途 |
|------|------|
| `type` | `"image"` |
| `url` | 该页图片的 S3 key |
| `title` | 该页标题（用户可选编辑） |
| `description` | 该页描述/讲解文案（Phase 3 由 AI 生成） |
| `sort_order` | 页码顺序（从 0 开始） |
| `width` / `height` | 图片尺寸 |
| `file_size` | 图片文件大小 |

原始上传的 PDF 文件存储为一条 `type = "document"` 的 attachment，用于保留原始文件。

#### 新增 `slider_conversions` 表

用于跟踪 PDF → 图片的异步转换任务：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string (UUID)` | 主键 |
| `content_id` | `string` | 关联的 content ID，索引 |
| `source_url` | `string` | 原始 PDF 文件的 S3 key |
| `status` | `string` | `pending` / `processing` / `completed` / `failed` |
| `slide_count` | `int` | 转换后的总页数 |
| `error_message` | `string` | 失败时的错误信息 |
| `created_at` | `time.Time` | |
| `updated_at` | `time.Time` | |

### 1.3 转换方案

#### PDF → 图片

使用 `poppler-utils` 的 `pdftoppm` 命令行工具：

```bash
pdftoppm -png -r 300 input.pdf output_prefix
```

- **输出格式**：PNG（清晰度优先）或 JPEG（体积优先，可配置）
- **DPI**：默认 300，可通过 settings 配置
- **运行依赖**：宿主机需安装 `poppler-utils`（与项目现有的 `pg_dump` 依赖模式一致）

#### 转换流程

```
1. 用户上传 PDF → presign → 直传 S3
2. 创建 content (status=draft) + 原始 PDF attachment (type=document)
3. 创建 slider_conversion 记录 (status=pending)
4. asyncRunner 启动转换 goroutine：
   a. 更新 status=processing
   b. 从 S3 下载 PDF 到临时目录
   c. 调用 pdftoppm 转换为图片
   d. 逐页上传图片到 S3 (attachments/{uuid}.png)
   e. 为每页创建 attachment 记录 (type=image, sort_order=页码)
   f. 用第一页图片设置 content.cover_url
   g. 更新 slider_conversion (status=completed, slide_count=N)
   h. 清理临时文件
5. 如果失败 → 更新 status=failed + error_message
```

#### 配置项（settings 表）

| Key | 说明 | 默认值 |
|-----|------|--------|
| `slider.conversion.dpi` | 转换 DPI | `300` |
| `slider.conversion.format` | 输出格式 | `png` |
| `slider.conversion.max_file_size` | 上传文件大小限制 | `104857600`（100MB） |
| `slider.conversion.max_pages` | 最大页数限制 | `200` |

### 1.4 API 设计

#### 复用现有内容 API

| 接口 | 说明 |
|------|------|
| `POST /api/v1/contents` | 创建 slider（`type: "slider"`） |
| `GET /api/v1/contents/:id` | 获取 slider 详情（含 attachments） |
| `PUT /api/v1/contents/:id` | 更新 slider |
| `DELETE /api/v1/contents/:id` | 删除 slider |
| `GET /api/v1/contents?type=slider` | 列表查询 |

#### 新增转换状态 API

| 接口 | 说明 |
|------|------|
| `GET /api/v1/contents/:id/conversion` | 查询转换状态 |
| `POST /api/v1/admin/contents/:id/reconvert` | 管理员重新触发转换 |

### 1.5 后端改动清单

#### Entity 层

- [ ] `internal/entity/content.go`：添加 `ContentTypeSlider ContentType = "slider"` 常量
- [ ] `internal/entity/content.go`：在 `ReservedSlugs` 中添加 `"sliders": true`
- [ ] `internal/entity/slider_conversion.go`：新建 `SliderConversion` 实体

#### Service 层

- [ ] `internal/service/service.go`：在 `AutoMigrate()` 中添加 `&entity.SliderConversion{}`
- [ ] `internal/service/content.go`：`ListContents()` 的 attachment 预加载条件中添加 `ContentTypeSlider`（slider 在列表页需要展示页数）
- [ ] `internal/service/content.go`：`listContentSelect` SQL 的 `CASE` 表达式中添加 `'slider'` 分支（封面取第一页图片）
- [ ] `internal/service/content.go`：`CreateContent()` 中添加 slider 类型的封面自动计算逻辑
- [ ] `internal/service/content.go`：`createAttachments()` 中添加 slider 的文件大小/页数验证
- [ ] `internal/service/slider_conversion.go`：新建文件，实现转换相关的 service 方法
  - [ ] `StartSliderConversion(ctx, contentID, sourceURL)` — 创建转换记录，启动 asyncRunner
  - [ ] `GetSliderConversion(ctx, contentID)` — 查询转换状态
  - [ ] `runSliderConversion(ctx, conversionID)` — 实际转换逻辑（下载 → 转换 → 上传 → 更新记录）
- [ ] `internal/service/domain.go`：添加 `SliderConversionDomain` 接口

#### Handler 层

- [ ] `internal/handler/slider_conversion.go`：新建文件
  - [ ] `GetSliderConversion` handler
  - [ ] `ReconvertSlider` handler（管理员）
- [ ] `internal/handler/handler.go`：注册新路由
  - [ ] `GET /api/v1/contents/:id/conversion`
  - [ ] `POST /api/v1/admin/contents/:id/reconvert`

#### 设置

- [ ] `internal/entity/setting.go`：添加 slider 相关的 setting key 常量
  - [ ] `SettingSliderConversionDPI`
  - [ ] `SettingSliderConversionFormat`
  - [ ] `SettingSliderConversionMaxFileSize`
  - [ ] `SettingSliderConversionMaxPages`

### 1.6 前端改动清单

#### 类型定义

- [ ] `website/src/types/content.ts`：`ContentType` 联合类型中添加 `'slider'`
- [ ] `website/src/types/content.ts`：添加 `SliderConversion` 接口定义

#### 路由

- [ ] `website/src/router.tsx`：添加 slider 相关路由
  - [ ] `/slider/new` → `SliderEditor`
  - [ ] `/slider/:id/edit` → `SliderEditor`
  - [ ] `/slider/:id` → `SliderDetail`
  - [ ] `/sliders` → `Home`（列表过滤）
  - [ ] `/admin/contents/sliders` → `AdminSliderContents`
  - [ ] profile 子路由中添加 `/sliders` → `ProfileContents`

#### URL 与资源辅助

- [ ] `website/src/lib/content-url.ts`：`typePrefix` 中添加 `slider: 'slider'`
- [ ] `website/src/lib/content-assets.ts`：`getStyledContentCardCover` 中处理 slider 类型（可复用 gallery 的 image style）

#### 共享组件修改

- [ ] `website/src/components/ContentCard.tsx`：添加 slider 类型的卡片覆盖层（页数角标 + Presentation 图标）
- [ ] `website/src/views/admin/contents/ContentTable.tsx`：`typeIcons` 中添加 slider 图标

#### 导航与菜单

- [ ] `website/src/layouts/SidebarNav.tsx`：添加 `/sliders` 导航链接
- [ ] `website/src/layouts/CreateMenu.tsx`：添加创建 Slider 菜单项
- [ ] `website/src/layouts/AdminLayout.tsx`：admin 侧边栏添加 `contents/sliders`

#### 列表与筛选

- [ ] `website/src/views/home/index.tsx`：`contentTypeOptions` 中添加 slider
- [ ] `website/src/views/settings/contents/index.tsx`：`typeTabs` 中添加 slider
- [ ] `website/src/views/profile/index.tsx`：`profileTabs` 中添加 sliders tab
- [ ] `website/src/views/profile/contents.tsx`：路径映射中添加 `sliders` → `'slider'`

#### 新建页面

- [ ] `website/src/views/slider/index.tsx`：Slider 详情页
  - [ ] 翻页浏览器组件（左右箭头、键盘导航、页码）
  - [ ] 全屏演示模式
  - [ ] 缩略图导航条
  - [ ] 转换状态展示（转换中/失败/完成）
  - [ ] 每页标题和描述展示
  - [ ] 点赞/收藏/评论/分享操作栏
- [ ] `website/src/views/slider/editor.tsx`：Slider 编辑器页面（薄包装层）
- [ ] `website/src/components/SliderEditorForm.tsx`：Slider 编辑器表单
  - [ ] PDF 文件上传区域（支持拖拽）
  - [ ] 转换状态轮询与展示
  - [ ] 转换完成后展示每页预览
  - [ ] 每页标题/描述编辑
  - [ ] 标题、分类、标签等通用字段
- [ ] `website/src/components/SlideViewer.tsx`：翻页浏览器核心组件
  - [ ] 图片预加载（当前页 ± 1）
  - [ ] 左右翻页动画
  - [ ] 键盘快捷键（← → 翻页，F 全屏，Esc 退出）
  - [ ] 触控滑动支持（移动端）
  - [ ] 页码显示（当前页 / 总页数）
- [ ] `website/src/views/admin/contents/sliders.tsx`：Admin 管理页（薄包装层，调用 `ContentTable`）

#### API 调用

- [ ] `website/src/api/content.ts`：添加 `getSliderConversion(contentId)` 方法

#### 国际化

- [ ] `website/src/locales/en/common.json`：添加 `"slider": "Slider"`
- [ ] `website/src/locales/zh-CN/common.json`：添加 `"slider": "幻灯片"`
- [ ] `website/src/locales/en/nav.json`：添加 `"slider": "Sliders"`
- [ ] `website/src/locales/zh-CN/nav.json`：添加 `"slider": "幻灯片"`
- [ ] `website/src/locales/en/admin.json`：添加 slider 相关 key
- [ ] `website/src/locales/zh-CN/admin.json`：添加 slider 相关 key
- [ ] `website/src/locales/en/settings.json`：添加 `"sliders": "Sliders"`
- [ ] `website/src/locales/zh-CN/settings.json`：添加 `"sliders": "幻灯片"`
- [ ] `website/src/locales/en/editor.json`：添加 slider 编辑器相关文案
- [ ] `website/src/locales/zh-CN/editor.json`：添加 slider 编辑器相关文案

### 1.7 CLI 改动清单

- [ ] `cli/internal/api/types.go`：添加 `ContentTypeSlider ContentType = "slider"` 常量

### 1.8 测试清单

- [ ] `internal/service/content_test.go`：slider 类型的 CRUD 测试
- [ ] `internal/service/slider_conversion_test.go`：转换流程测试（使用 mock PDF）
- [ ] `internal/handler/slider_conversion_test.go`：转换状态 API 测试

### 1.9 文档清单

- [ ] `docs/features.md`：内容类型表格中添加 slider
- [ ] `docs/roadmap.md`：添加 Slider Phase 2/Phase 3 规划条目

### 1.10 运行依赖

| 依赖 | 安装方式 | 说明 |
|------|---------|------|
| `poppler-utils` | `apt install poppler-utils` (Debian/Ubuntu) / `brew install poppler` (macOS) | 提供 `pdftoppm` 命令 |

与项目现有的 `pg_dump`/`mysqldump` 依赖模式一致：宿主机安装命令行工具，Go 代码通过 `exec.Command` 调用。

---

## Phase 2：PPT/PPTX + Keynote 支持

### 概述

在 Phase 1 的 PDF 转换链路基础上，增加 PPT/PPTX 和 Keynote 格式的支持。核心思路：先将 PPT/Keynote 转为 PDF，再复用 Phase 1 的 PDF → 图片链路。

### 转换链路

```
PPT/PPTX ──LibreOffice──► PDF ──pdftoppm──► 图片
Keynote  ──LibreOffice──► PDF ──pdftoppm──► 图片
```

### 2.1 TODO

- [ ] 引入 LibreOffice headless 作为转换依赖
  - [ ] 调研 Go 调用 LibreOffice 的最佳方式（`soffice --headless --convert-to pdf`）
  - [ ] 处理字体问题（服务端需安装常用字体包）
  - [ ] 评估转换质量和性能
- [ ] `internal/service/slider_conversion.go`：扩展 `runSliderConversion`
  - [ ] 根据 MIME type 判断是否需要先转 PDF
  - [ ] PPT/PPTX → PDF 转换步骤
  - [ ] Keynote → PDF 转换步骤
- [ ] 前端编辑器更新上传组件的 accept 类型
  - [ ] 添加 `.pptx`、`.ppt`、`.key` 文件类型
  - [ ] 更新上传提示文案
- [ ] 转换配置扩展
  - [ ] `slider.conversion.libreoffice_path`：LibreOffice 可执行文件路径
  - [ ] `slider.conversion.font_config_path`：字体配置路径（可选）
- [ ] 并发控制
  - [ ] LibreOffice 转换是 CPU/内存密集型操作，需要限制并发数
  - [ ] 考虑使用带缓冲的 channel 作为简单的并发限制器
- [ ] 更新运行依赖文档

### 2.2 运行依赖

| 依赖 | 安装方式 | 说明 |
|------|---------|------|
| `libreoffice` | `apt install libreoffice-core libreoffice-impress` (Debian/Ubuntu) / `brew install libreoffice` (macOS) | PPT/Keynote → PDF 转换 |
| 常用字体包 | `apt install fonts-noto fonts-liberation` 等 | 保证转换后的排版质量 |

---

## Phase 3：AI 语音讲解

### 概述

为每页幻灯片生成 AI 讲解文案，并通过 TTS 转为语音，实现"上传 PPT 即可获得一段完整演讲"的体验。

### 用户体验

1. 用户上传 PPT/PDF 并完成转换（Phase 1/2）
2. 点击"生成 AI 讲解"按钮
3. AI 读取每页内容，生成讲解文案
4. 用户可逐页编辑文案（修正 AI 的错误或补充内容）
5. 确认后，系统将文案转为语音
6. 浏览时：翻到第 N 页 → 自动播放第 N 段语音

### 3.1 技术方案

#### 文本提取

- PDF 文本提取：使用 `pdftotext`（poppler-utils 自带）或 Go PDF 库
- 图片 OCR 兜底：对于扫描件类 PDF，使用 OCR 提取文字

#### AI 文案生成

- 输入：每页的文本内容 + 前后页上下文 + 幻灯片标题
- 输出：自然语言讲解文案
- 存储：`attachments.description` 字段（Phase 1 已预留）
- 模型：Claude API 或其他 LLM

#### TTS 语音合成

- 每页文案 → 一段独立音频文件
- 音频存储为额外的 `type = "audio"` attachment，通过 `sort_order` 与图片页码对应
- 可选语音风格和语言

#### 前端播放

- `SlideViewer` 组件扩展：每页关联一个音频播放器
- 自动播放模式：播放完当前页语音 → 自动翻到下一页
- 手动翻页时：停止当前音频，播放新页面的音频

### 3.2 TODO

- [ ] 文本提取
  - [ ] PDF 文本提取（`pdftotext` 或 Go 库）
  - [ ] OCR 兜底方案评估
- [ ] AI 文案生成
  - [ ] 设计 prompt（输入每页文本，输出讲解文案）
  - [ ] 集成 LLM API
  - [ ] 文案存储到 `attachment.description`
  - [ ] 用户编辑文案的 UI
- [ ] TTS 语音合成
  - [ ] 选择 TTS 服务（云端 API vs 本地模型）
  - [ ] 音频生成 + 上传 S3
  - [ ] 音频 attachment 关联逻辑
- [ ] 前端播放
  - [ ] `SlideViewer` 集成音频播放
  - [ ] 自动播放 / 手动翻页切换逻辑
  - [ ] 播放进度条
  - [ ] 语音开关控制
- [ ] 配置项
  - [ ] `slider.ai.provider`：AI 文案生成 provider
  - [ ] `slider.ai.tts_provider`：TTS 服务 provider
  - [ ] `slider.ai.voice`：语音风格选择
  - [ ] `slider.ai.language`：讲解语言
- [ ] 数据模型扩展
  - [ ] `slider_conversions` 表添加 AI 相关状态字段
  - [ ] 或新建 `slider_narrations` 表跟踪 AI 生成任务

### 3.3 运行依赖

| 依赖 | 说明 |
|------|------|
| LLM API | Claude API / OpenAI API 等，用于生成讲解文案 |
| TTS API | 云端 TTS 服务（如 Azure Speech / Google TTS / 阿里云 TTS）或开源方案 |

---

## 附录

### A. 与现有内容类型的对比

| 维度 | Video | Gallery | Article | Podcast | **Slider** |
|------|-------|---------|---------|---------|-----------|
| 核心交互 | 播放器 | 网格 + Lightbox | 长文阅读 | 音频播放 | **逐页翻页** |
| 内容来源 | 视频文件 | 手动上传图片 | 富文本编辑 | 音频文件 | **上传文档，自动转换** |
| 附件类型 | video | image | document | audio | **image + document** |
| 主讲人信息 | 是 | 否 | 否 | 可选 | 否 |
| 服务端处理 | 无 | 无 | 无 | 无 | **文件转换** |

### B. 架构一致性

新增 `slider` 类型严格遵循现有架构模式：

- **单表多类型**：复用 `contents` 表，`type = 'slider'`
- **附件体系**：复用 `attachments` 表，每页为一条 `type = "image"` 记录
- **API 复用**：内容 CRUD 使用现有的 `/api/v1/contents` 端点
- **异步处理**：使用现有的 `asyncRunner` goroutine 模式（同 database backup）
- **文件上传**：复用 presign → 直传 S3 → key 回写的流程
- **外部依赖**：命令行工具依赖模式（同 `pg_dump`/`mysqldump`）

### C. 后端涉及文件索引

| 文件 | 改动 |
|------|------|
| `internal/entity/content.go` | 添加 `ContentTypeSlider` 常量和保留 slug |
| `internal/entity/setting.go` | 添加 slider 配置 key 常量 |
| `internal/entity/slider_conversion.go` | 新建：`SliderConversion` 实体 |
| `internal/service/service.go` | `AutoMigrate` 中添加 `SliderConversion` |
| `internal/service/content.go` | attachment 预加载、封面计算、验证逻辑 |
| `internal/service/slider_conversion.go` | 新建：转换 service 方法 |
| `internal/service/domain.go` | 添加 `SliderConversionDomain` 接口 |
| `internal/handler/slider_conversion.go` | 新建：转换 API handler |
| `internal/handler/handler.go` | 注册新路由 |
| `cli/internal/api/types.go` | 添加 `ContentTypeSlider` 常量 |

### D. 前端涉及文件索引

| 文件 | 改动 |
|------|------|
| `src/types/content.ts` | `ContentType` 联合类型添加 `'slider'` |
| `src/router.tsx` | 添加 6 条路由 |
| `src/lib/content-url.ts` | `typePrefix` 添加 slider |
| `src/lib/content-assets.ts` | 处理 slider 封面样式 |
| `src/components/ContentCard.tsx` | slider 卡片覆盖层 |
| `src/views/admin/contents/ContentTable.tsx` | `typeIcons` 添加 slider |
| `src/layouts/SidebarNav.tsx` | 添加导航链接 |
| `src/layouts/CreateMenu.tsx` | 添加创建菜单项 |
| `src/layouts/AdminLayout.tsx` | admin 侧边栏添加 slider |
| `src/views/home/index.tsx` | 类型筛选添加 slider |
| `src/views/settings/contents/index.tsx` | 内容管理 tab 添加 slider |
| `src/views/profile/index.tsx` | profile tab 添加 slider |
| `src/views/profile/contents.tsx` | 路径映射添加 slider |
| `src/api/content.ts` | 添加转换状态 API 调用 |
| `src/views/slider/index.tsx` | 新建：详情页 |
| `src/views/slider/editor.tsx` | 新建：编辑器页面 |
| `src/components/SliderEditorForm.tsx` | 新建：编辑器表单 |
| `src/components/SlideViewer.tsx` | 新建：翻页浏览器组件 |
| `src/views/admin/contents/sliders.tsx` | 新建：Admin 管理页 |
| `src/locales/en/*.json` | 添加 slider 相关翻译 |
| `src/locales/zh-CN/*.json` | 添加 slider 相关翻译 |
