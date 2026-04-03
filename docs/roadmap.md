# Niubility Roadmap

该文档用于记录仍有明确价值、但暂未进入当前迭代的中长期事项。

## CLI Delivery

- [ ] 将 `cli/` 从"可用原型"推进到"可正式交付"
  - 对齐 [`docs/cli-design.md`](./cli-design.md) 中的命令范围、输出行为与验收标准
  - 补齐真实环境端到端验证，至少覆盖 `login -> whoami -> category list -> content list -> content create article -> content view -> content delete`
  - 补充打包、发布与版本管理流程
  - 将 CLI 使用说明以稳定入口形式接入仓库主文档

- [ ] 补齐 CLI 后续命令与内容类型支持
  - `content edit <id>`
  - `favorite list`、`comment list`、`comment create`、`like toggle`
  - `content create gallery <dir>`
  - `content create video <dir>`
  - shell completion 与脚本友好输出增强

- [ ] 完成 CLI SSO 的产品化收尾
  - 基于现有 `/api/v1/sso/cli/*` 链路完成真实环境验证
  - 补齐超时、取消、失败跳转、重复消费等异常场景处理
  - 明确 CLI SSO 的运维要求、限制条件与用户文档

## Notifications

- [ ] 实现通知偏好设置功能
  - 当前 `settings/notifications` 页面为占位页，显示"即将推出"
  - 需明确通知类型（评论回复、点赞、关注、系统通知等）
  - 设计通知投递策略（站内信、邮件、企业微信等）

## Security Backlog

- [ ] 分析 `server.secret` 和 `server.encryptionKey` 是否可以合并
  - `secret` 用于 JWT 签名
  - `encryptionKey` 用于敏感配置加密
  - 需要评估统一密钥管理与职责分离之间的取舍

- [ ] 实现 `encryptionKey` 轮换机制
  - 支持多版本密钥解密
  - 提供密钥轮换 API 或 CLI
  - 支持存量数据自动重加密

## Integrations

- [ ] 实现"转发企业微信群"能力
  - 管理后台配置群机器人 Webhook
  - 内容详情页提供管理员可见的转发入口
  - 统一消息卡片模板、失败提示与审计信息
  - 明确支持的内容类型与链接策略

## Asset Delivery

- [ ] 推进资源分发配置的第二阶段能力
  - 明确当前"关闭分发签名"和"七牛云私有分发"之外的产品边界
  - 评估是否需要支持更多 delivery provider
  - 梳理分发域名、私有签名、图片样式、TTL 等配置项的兼容性与默认行为
  - 对齐功能文档、设置页文案与实际实现，避免产品表述超前于能力边界
