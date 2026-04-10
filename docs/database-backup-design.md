# 数据库备份 V1 设计

## 目标

在后台管理中提供数据库备份能力，满足以下目标：

- 管理员可手动触发数据库备份
- 备份文件上传到现有 S3 兼容对象存储
- 后台可查看备份历史、状态、大小、触发人、耗时与错误摘要
- 支持 PostgreSQL 和 MySQL
- 不在 `settings` 表中复制数据库连接配置

V1 只做“备份与下载”，不做“网页一键恢复”。

## 范围

### 包含

- `POST /api/v1/admin/backups/database` 触发备份
- `GET /api/v1/admin/backups/database` 查询备份历史
- `GET /api/v1/admin/backups/database/:id/download` 获取下载链接
- 备份文件生成后压缩为 `.sql.gz`
- 上传到现有对象存储
- 管理后台新增“数据库备份”页面
- 单实例内与数据库记录级别的并发保护，避免同时执行多个数据库备份

### 不包含

- 网页恢复数据库
- 增量备份
- 自动定时调度
- 备份文件加密
- 对象存储生命周期自动清理

## 总体方案

### 备份触发流程

1. 管理员在后台点击“立即备份”
2. 后端校验当前是否已有运行中的数据库备份
3. 创建一条 `backup_records` 记录，状态为 `running`
4. 服务端异步执行 `pg_dump` 或 `mysqldump`
5. 将输出压缩为 `.sql.gz`
6. 上传到对象存储指定前缀
7. 更新记录为 `success` 或 `failed`

### 关键原则

- 数据库连接只来自启动 YAML，不增加第二套配置来源
- 备份产物复用现有对象存储配置
- 命令执行放在 service 层，handler 只负责权限与参数
- 下载通过短期有效的签名 URL 返回
- 日志和错误信息都要避免泄露 DSN 与密码

## 数据模型

新增表：`backup_records`

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `type` | string | 备份类型，V1 固定为 `database` |
| `status` | string | `running` / `success` / `failed` |
| `driver` | string | `postgres` / `mysql` |
| `object_key` | text | 上传后的对象存储 key |
| `file_name` | text | 文件名 |
| `file_size` | bigint | 压缩后文件大小 |
| `compressed` | bool | 是否压缩，V1 固定 `true` |
| `checksum_sha256` | string | 文件校验值 |
| `started_by_user_id` | string | 触发人 ID |
| `started_by_name` | string | 触发人展示名 |
| `started_at` | time | 开始时间 |
| `finished_at` | time/null | 结束时间 |
| `duration_ms` | bigint | 总耗时 |
| `error_message` | text | 脱敏后的错误摘要 |
| `created_at` | time | 创建时间 |
| `updated_at` | time | 更新时间 |

## API 设计

### 触发备份

`POST /api/v1/admin/backups/database`

响应示例：

```json
{
  "backup": {
    "id": "backup_123",
    "type": "database",
    "status": "running",
    "driver": "postgres",
    "started_by_name": "admin",
    "started_at": "2026-04-10T09:00:00+08:00"
  }
}
```

### 查询备份列表

`GET /api/v1/admin/backups/database?page=1&page_size=20`

响应示例：

```json
{
  "items": [
    {
      "id": "backup_123",
      "type": "database",
      "status": "success",
      "driver": "postgres",
      "file_name": "niubility-db-20260410-090000-postgres.sql.gz",
      "file_size": 52381,
      "compressed": true,
      "checksum_sha256": "abc123",
      "started_by_user_id": "user_1",
      "started_by_name": "admin",
      "started_at": "2026-04-10T09:00:00+08:00",
      "finished_at": "2026-04-10T09:00:08+08:00",
      "duration_ms": 8000,
      "error_message": ""
    }
  ],
  "total": 1
}
```

### 获取下载链接

`GET /api/v1/admin/backups/database/:id/download`

响应示例：

```json
{
  "url": "https://example.com/presigned",
  "expires_at": "2026-04-10T09:15:00+08:00"
}
```

## 备份文件命名

对象存储路径建议：

```text
backups/database/2026/04/10/niubility-db-20260410-090000-postgres.sql.gz
```

命名规则包含：

- 日期
- 时间
- 数据库类型

## 命令执行策略

### PostgreSQL

使用 `pg_dump` 导出纯 SQL。

敏感信息通过环境变量传递：

- `PGPASSWORD`

### MySQL

使用 `mysqldump` 导出纯 SQL。

敏感信息通过环境变量传递：

- `MYSQL_PWD`

### DSN 解析

服务端根据当前启动时使用的 `driver` 与 `dsn` 解析出：

- host
- port
- username
- password
- database name

解析后的结构仅用于构造命令，不应写入日志或返回前端。

## 并发控制

V1 约束：同一时间只允许一个数据库备份任务运行。

实现方式：

- Service 内使用互斥锁保护触发流程
- 创建前检查数据库中是否存在 `type=database` 且 `status=running` 的记录

这样可以避免同一实例内重复触发，也能在服务重启后依赖记录状态进行兜底判断。

## 对象存储

复用现有 S3 配置读取逻辑：

- `s3.endpoint`
- `s3.region`
- `s3.bucket`
- `s3.access_key`
- `s3.secret_key`

V1 新增备份相关设置：

- `backup.database.s3_prefix`
- `backup.database.download_url_ttl_seconds`

默认值：

- `backups/database`
- `900` 秒

## 后台页面

新增“数据库备份”页面，展示：

- 当前数据库类型
- 最近一次成功备份时间
- 是否有运行中的备份
- “立即备份”按钮
- 历史记录列表
- 下载按钮

交互约束：

- 若已有运行中任务，则按钮禁用
- 点击前弹确认提示，说明会占用数据库与磁盘 IO

## 安全要求

- 仅管理员可访问
- 对象存储路径默认私有
- 下载使用签名 URL
- 错误信息脱敏，不返回完整 DSN
- 日志不打印密码、secret、完整连接串

## 运维前置条件

部署环境需要具备：

- PostgreSQL 场景：`pg_dump`
- MySQL 场景：`mysqldump`
- 应用进程具备临时目录写权限
- 应用进程可访问数据库实例
- 应用进程可访问对象存储

## 验证建议

- service 单测覆盖：
  - DSN 解析
  - 对象 key 生成
  - 下载 TTL 默认值
  - 运行中任务互斥
  - 记录状态流转
- handler 单测覆盖：
  - 管理员触发
  - 运行中重复触发失败
  - 列表查询
- 前端至少验证：
  - 页面加载
  - 触发按钮
  - 运行中禁用
  - 列表刷新
