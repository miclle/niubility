# CLAUDE.md

本仓库的第一规范来源是 `AGENTS.md`。开始任何分析、修改、重构、补测试、写文档之前，先阅读：

1. `AGENTS.md`
2. 与当前任务相关的 `.agents/rules/*.md`

## 任务入口

- 后端接口、路由、handler 改动：`.agents/rules/backend-handler.md`
- 业务逻辑、事务、计数、跨实体操作：`.agents/rules/backend-service.md`
- 设置项、SSO、S3、企业微信、密钥与证书：`.agents/rules/settings-and-integrations.md`
- React 页面、路由、API、类型、布局：`.agents/rules/frontend.md`
- 提交前验证、测试范围、完成声明：`.agents/rules/testing.md`
- API 变更、配置联动、文档联动、自查：`.agents/rules/change-checklist.md`

## 使用原则

- `AGENTS.md` 是权威入口；本文件只做导航，不重复维护整份项目规范
- 遵循仓库既有模式，不为局部问题随意引入新框架、新分层或新状态管理
- 涉及敏感配置时，禁止在日志、文档、测试数据中泄露 secret、token、证书正文
- 未完成对应验证前，不要宣称“已修复”或“已完成”
