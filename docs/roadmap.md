# Niubility Roadmap

本文档记录仍有明确价值、但尚未完整落地的事项。已在代码中完成的能力不再重复列入 roadmap。

## CLI

- [ ] 将 `cli/` 从“可用命令集”推进到“稳定交付入口”
  - 对齐主 README、`cli/README.md` 与实际命令范围
  - 增加版本信息、发布流程与打包说明
  - 补齐更多真实环境端到端验证

- [ ] 完成非文章内容的 CLI 发布链路
  - `content create gallery <dir>`
  - `content create video <dir>`
  - `content create podcast <dir-or-file>`
  - 与附件上传、封面、排序、speaker 信息保持一致

- [ ] 补齐 CLI 内容与互动命令的用户体验
  - 更完整的 `content edit`
  - 更清晰的 HTML 内容查看体验
  - shell completion、脚本友好输出增强

- [ ] 完成 CLI SSO 的产品化收尾
  - 覆盖超时、取消、失败跳转、重复消费等异常场景
  - 补齐用户文档与运维要求

## Notifications

- [ ] 实现通知偏好设置功能
  - 当前 `settings/notifications` 页面仅为占位
  - 明确通知类型与投递策略
  - 设计站内、邮件、企业微信等可能通道

## Integrations

- [ ] 决定企业微信网页 OAuth 自动登录是否进入实现
  - 当前仅有设计文档，无对应后端/前端路由
  - 需评估与现有 SSO、登录页、部署环境的边界

- [ ] 评估企业微信群转发能力
  - 管理后台配置机器人 Webhook
  - 内容详情页管理员操作入口
  - 模板、审计、失败提示统一

## Security

- [ ] 评估密钥治理方案
  - JWT 签名密钥与敏感配置加密密钥是否需要统一管理
  - 是否需要显式轮换流程

- [ ] 设计加密密钥轮换能力
  - 多版本密钥解密
  - 存量数据重加密
  - 管理或 CLI 操作入口

## Asset Delivery

- [ ] 扩展资源分发 provider 的产品边界
  - 当前重点适配 `disabled` 与 `qiniu`
  - 评估更多 provider 是否值得支持
  - 梳理私有分发、样式追加、TTL 与 S3 公网 URL 的组合行为

## Operations

- [ ] 评估数据库备份的后续能力
  - 自动调度
  - 生命周期清理
  - 加密归档
  - 恢复流程文档或工具支持

- [ ] 评估服务节点能力扩展
  - 节点告警
  - 更细粒度健康指标
  - 与调度型节点的协同展示
