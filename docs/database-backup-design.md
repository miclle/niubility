# 数据库备份

## 当前状态

数据库备份能力已经实现，不再只是 V1 设计稿。当前后台支持：

- 管理员手动触发数据库备份
- 查看备份历史
- 获取下载链接
- PostgreSQL / MySQL 双支持
- 备份结果上传到现有 S3 兼容对象存储

## 当前接口

- `POST /api/v1/admin/backups/database`
- `GET /api/v1/admin/backups/database`
- `GET /api/v1/admin/backups/database/:id/download`

## 当前行为

### 触发流程

1. 管理员在后台点击立即备份
2. 服务端创建 `running` 状态记录
3. 异步执行 `pg_dump` 或 `mysqldump`
4. 生成 `.sql.gz`
5. 上传到对象存储
6. 更新为 `success` 或 `failed`

### 并发保护

- Service 内有互斥保护
- 数据库记录层也会避免同时存在多个运行中的数据库备份任务

### 下载方式

- 只对成功备份生成下载链接
- 返回的是短时有效签名 URL

## 运行依赖

### PostgreSQL

- 需要宿主机可执行 `pg_dump`

### MySQL

- 需要宿主机可执行 `mysqldump`

## 配置来源

数据库连接仍然来自启动 YAML，而不是 `settings` 表重复保存。

备份行为配置来自 `settings` 表：

- `backup.database.s3_prefix`
- `backup.database.download_url_ttl_seconds`

对象存储复用现有 S3 配置：

- `s3.endpoint`
- `s3.region`
- `s3.bucket`
- `s3.access_key`
- `s3.secret_key`

## 安全要求

- 备份错误信息必须脱敏
- 不在日志和响应中泄露 DSN、密码等敏感信息
- 下载使用短期签名 URL，而不是长期公开链接

## 后续方向

当前未实现：

- 自动定时调度
- 网页恢复数据库
- 备份文件加密
- 生命周期自动清理

这些能力仍应视为后续 roadmap，而非已上线功能。
