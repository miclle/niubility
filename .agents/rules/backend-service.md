# Backend Service Rules

适用于 `internal/service/` 下的业务逻辑、事务、数据库操作和跨实体更新。

## MUST

- service 层承接核心业务逻辑，保持 `Handler -> Service -> Entity` 边界
- 跨实体更新、计数同步、事务处理放在 service，而不是 handler
- 数据库存取、外部集成调用和领域规则集中在 service 层
- 新增业务时优先延续现有 service 的命名、返回值和错误处理风格

## SHOULD

- service 不携带 HTTP 语义，不依赖前端展示结构
- 复用已有查询模式、分页模式和计数维护方式
- 对内容、评论、点赞、收藏、关注等核心域改动时，主动检查关联计数和权限边界
- 新增或修改复杂逻辑时优先补 service test

## AVOID

- 不要把协议层细节、路由细节、页面文案放进 service
- 不要把单个 service 写成无边界的“大杂烩”
- 不要为了局部需求绕过现有实体和服务边界直接在 handler 中操作数据库

## 变更检查

- 是否影响计数字段或聚合结果
- 是否影响 cursor 分页或排序稳定性
- 是否需要事务保证一致性
- 是否需要同步更新测试
