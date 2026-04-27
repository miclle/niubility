# Frontend Rules

适用于 `website/src/` 下的页面、组件、路由、API 调用和类型定义。

## MUST

- API 请求逻辑放在 `src/api/`
- 类型定义放在 `src/types/`
- 页面放在 `src/views/`
- 布局继续复用 `MainLayout`、`AdminLayout`、`SettingsLayout`
- 修改启动流程时，必须检查 `/api/v1/boot`、初始化页、登录页和受保护页面的联动

## SHOULD

- 继续复用现有 axios client、路由组织和 shadcn/ui 组件
- 新页面和设置页沿用现有信息架构与导航风格
- 表单字段、接口字段、类型字段尽量保持命名一致
- 影响上传流程时检查 presign、上传进度、返回 key 与资源访问 URL 是否匹配

## AVOID

- 不要随意引入新的状态管理、请求库或 UI 基础设施
- 不要把页面私有逻辑散落到全局 context
- 不要绕开 `src/api/` 直接在视图里拼接大量请求细节

## 变更检查

- 是否需要同步更新 `src/api/*`、`src/types/*`、路由配置和页面组件
- 是否破坏了现有布局、导航或启动流程
- 是否影响动态 `/:slug` 路由或管理后台设置页入口
