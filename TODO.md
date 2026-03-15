# TODO

## Security

- [ ] 分析 `server.secret` 和 `server.encryptionKey` 是否可以合并
  - `secret` 用于 JWT 签名
  - `encryptionKey` 用于敏感配置加密
  - 考虑：统一密钥管理 vs 职责分离

- [ ] 实现 encryptionKey 轮换机制
  - 支持多版本密钥解密
  - 提供密钥轮换 API 或 CLI
  - 自动重加密存量数据
