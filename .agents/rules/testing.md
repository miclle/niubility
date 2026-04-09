# Testing Rules

适用于所有代码改动后的验证与完成声明。

## MUST

- 在声称“已完成”“已修复”“测试通过”之前，执行与改动匹配的验证
- 每次提交前必须执行 `task check`，并确认命令通过
- 后端逻辑改动优先补充 Go 单元测试
- 影响接口、上传、登录、设置、SSO、企业微信等关键流程时，至少说明已做的验证范围
- 若未运行完整验证，必须明确说明未验证部分

## SHOULD

- 优先使用仓库已有命令：`task check`、`task test`
- 小改动至少运行受影响包或受影响模块的验证
- API 变更同时检查前端调用层与类型层是否仍然匹配
- 前端改动至少做关键路径自查，尤其是启动流程、路由跳转、表单提交和设置页

## AVOID

- 不要在没有任何验证证据时给出确定性完成结论
- 不要只修改实现不检查测试、类型、编译或核心交互路径

## 常用验证

```bash
task check
task test
go test ./internal/service/...
go test ./internal/handler/...
cd internal/website && npm run build
```

除提交前强制执行一次 `task check` 外，根据实际改动补充其他验证命令，并保留匹配的验证依据。
