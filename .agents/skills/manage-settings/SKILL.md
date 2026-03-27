---
name: manage-settings
description: Use when adding, changing, migrating, deprecating, or debugging settings-table backed configuration in Niubility, especially for admin settings pages, SSO, S3, WeChat, encryption, masking, and config-read/write flow.
---

# Manage Settings

适用于 Niubility 中所有以 `settings` 表为真源的配置改动，包括新增、修改、迁移、废弃与联动排查。

开始前先阅读：

1. `AGENTS.md`
2. `.agents/rules/settings-and-integrations.md`
3. `.agents/rules/change-checklist.md`
4. 如果改动会影响前端设置页，再读 `.agents/rules/frontend.md`

## 什么时候用

- 新增后台设置项
- 修改已有设置项的 key、语义、读取逻辑、默认行为或脱敏策略
- 新增或调整后台设置页字段
- 调整 OIDC、SAML、S3、企业微信相关配置
- 排查“配置已保存但未生效”“返回值未脱敏”“前后端字段不匹配”等问题

## 工作流

1. 先确认这是不是 `settings` 表负责的配置，而不是 YAML 启动配置
2. 找到受影响的 setting key、读取路径、写入路径、初始化路径
3. 同步检查后端常量、service 逻辑、管理端表单、前端类型和 API
4. 判断该字段是否敏感，是否需要加密存储和脱敏返回
5. 检查是否影响 SSO、S3、企业微信、启动流程、上传流程或回调地址
6. 运行与改动匹配的验证，并明确记录未验证部分

## 重点文件

- `internal/entity/setting.go`
- `internal/service/setting.go`
- `internal/service/service.go`
- `internal/handler/setting.go`
- `internal/website/src/views/admin/settings/`
- `internal/website/src/api/setting.ts`
- `internal/website/src/types/setting.ts`

根据具体场景，也可能涉及：

- `pkg/sso/`
- `internal/service/upload.go`
- `internal/service/wechat_sync.go`

## 检查清单

- 是否新增或修改了正确的 setting key
- 是否继续沿用现有 key 命名风格
- 是否同步更新了读取逻辑和写入逻辑
- 是否需要在后台设置页新增字段、说明或分组
- 是否需要同步更新前端类型和 API 请求结构
- 是否需要加密存储
- 是否需要在返回设置列表时脱敏
- 是否可能影响首次启动、回调地址、上传链路或第三方客户端初始化
- 是否需要补测试或更新文档

## 常见漏项

- 只改了 `setting.go` 常量，没有接上 service 读取逻辑
- 后台页面加了字段，但前端类型或 API body 没同步
- 敏感值保存时加密了，但列表返回没有脱敏
- 新配置生效依赖缓存、初始化或 client refresh，但没有触发
- 只验证了保存成功，没有验证“实际是否生效”

## 完成标准

- 配置链路改动完整闭环
- 敏感字段处理符合现有策略
- 前后端字段保持一致
- 已完成与改动匹配的验证，或明确说明未验证部分
