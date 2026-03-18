# 七牛 SSO SAML 2.0 配置指南

本文档说明如何将 Niubility 通过 SAML 2.0 协议对接七牛 SSO。

## 前置条件

- Niubility 已部署并可访问
- 拥有七牛 SSO 服务器的文件系统权限（用于注册 SP）

## 配置步骤

### 第一步：获取七牛 SSO 的 IdP 信息

访问七牛 SSO 的 metadata 端点获取 IdP 配置：

```
{SSO_HOST}/saml2/meta
```

七牛 SSO 的 URL 规则：

| 信息 | 规则 | 示例 |
|------|------|------|
| IdP Entity ID | `{SSO_HOST}/saml2/meta` | `http://bo-staging-sso-internal.jfcs-k8s-qa1.qiniu.io/saml2/meta` |
| IdP SSO URL | `{SSO_HOST}` （根路径） | `http://bo-staging-sso-internal.jfcs-k8s-qa1.qiniu.io` |
| IdP Certificate | metadata XML 中 `<X509Certificate>` 元素内容 | 见下方 |

> **注意**：七牛 SSO 的 Entity ID 是 metadata URL（`/saml2/meta`），SSO URL 是根路径（`/`），这与一些 IdP 的常见约定不同。

### 第二步：提取 IdP 证书

从 metadata XML 中提取 `<X509Certificate>` 的 Base64 内容，添加 PEM 头尾：

```
-----BEGIN CERTIFICATE-----
（从 metadata XML 的 <X509Certificate> 中复制 Base64 内容，注意保留完整内容）
-----END CERTIFICATE-----
```

### 第三步：在 Niubility 管理后台配置 SSO

进入 **管理后台 → 系统配置 → SSO 配置**，填写以下内容：

| 字段 | 值 |
|------|-----|
| SSO 类型 | `SAML 2.0` |
| IdP Metadata URL | `{SSO_HOST}/saml2/meta` |
| IdP Entity ID | `{SSO_HOST}/saml2/meta` |
| IdP SSO URL | `{SSO_HOST}` |
| IdP Certificate (PEM) | 第二步中提取的 PEM 证书 |

点击 **保存配置**。

### 第四步：在七牛 SSO 注册 SP（关键步骤）

七牛 SSO 使用**文件方式**管理 SP 注册。SP metadata XML 文件必须放到七牛 SSO 的 `sp_conf_dir` 目录并重启服务后才能生效。

> 如果跳过此步骤，点击 SSO 登录后会看到"请直接打开你需要登录的网站"的提示，登录后跳转到 `/404`，这是因为七牛 SSO 无法识别该 SP。

操作步骤：

1. 保存 SSO 配置后，在 Niubility 管理后台 SAML 配置区底部会显示 SP Metadata 地址

2. 下载 SP metadata XML 文件：

   ```bash
   curl -o niubility.xml {NIUBILITY_HOST}/sso/metadata
   ```

3. 确认 SP metadata XML 中的 `entityID` 和 ACS `Location` 地址是七牛 SSO 服务器能访问到的地址。如果 Niubility 在本地运行（`localhost`），需要确保 SSO 服务器能回调到该地址

4. 查看七牛 SSO 服务器的配置文件（`sso.json`），找到 `SAML.sp_conf_dir` 字段的路径

5. 将 SP metadata 文件复制到该目录：

   ```bash
   scp niubility.xml sso-server:{sp_conf_dir}/niubility.xml
   ```

6. **重启七牛 SSO 服务**（SP 配置仅在启动时加载，不支持热更新）

### 第五步：验证

1. 打开 Niubility 登录页面，应显示 SSO 登录按钮
2. 点击 SSO 登录，应跳转到七牛 SSO 的 LDAP 登录页
3. 输入 LDAP 用户名和密码（如需要还包括 TOTP）
4. 登录成功后应自动跳转回 Niubility 并完成登录

## SAML 断言属性映射

七牛 SSO 使用 `crewjam/saml` 的 `DefaultAssertionMaker`，在 SAML 断言中返回以下用户属性：

| SAML 属性 | OID | 值 | Niubility 映射字段 |
|-----------|-----|-----|-----|
| uid | `urn:oid:0.9.2342.19200300.100.1.1` | LDAP 用户名（如 `miclle`） | `Username` |
| mail | `urn:oid:0.9.2342.19200300.100.1.3` | 邮箱（如 `miclle@qiniu.com`） | `Email` |
| NameID | — | LDAP 用户名 | `Username`（fallback） |

> `name` / `displayName` 属性未被七牛 SSO 填充，Niubility 中用户的显示名称会在首次登录后由管理员或用户自行补充。

## 认证流程

```
用户                    Niubility                    七牛 SSO
 │                         │                            │
 │  点击 SSO 登录          │                            │
 │ ───────────────────────>│                            │
 │                         │  SAMLRequest (Redirect)    │
 │                         │ ──────────────────────────>│
 │                         │                            │
 │                         │         LDAP 登录页面       │
 │ <────────────────────────────────────────────────────│
 │                         │                            │
 │  输入用户名 + 密码 (+ TOTP)                          │
 │ ────────────────────────────────────────────────────>│
 │                         │                            │
 │                         │  SAMLResponse (POST /sso/acs)
 │                         │ <──────────────────────────│
 │                         │                            │
 │                         │  解析断言 → Upsert 用户     │
 │                         │  签发 JWT → Set Cookie      │
 │   302 Redirect /        │                            │
 │ <───────────────────────│                            │
```

## 故障排查

| 现象 | 可能原因 | 解决方法 |
|------|---------|---------|
| SSO 页面显示"请直接打开你需要登录的网站"，登录后跳转 `/404` | SP 未在七牛 SSO 注册 | 将 SP metadata XML 放入 `sp_conf_dir` 并重启 SSO 服务 |
| 点击 SSO 登录无反应 | SSO 配置未保存或字段为空 | 检查管理后台 SSO 配置是否完整 |
| 登录后跳转到 Niubility 的 /500 | SAMLResponse 解析失败 | 检查 IdP Certificate 是否正确（必须是 PEM 格式） |
| 登录后跳转到 Niubility 的 /500 | 用户属性为空 | 确认七牛 SSO 返回了 uid 或 NameID 属性 |
| ACL 拒绝访问 | 七牛 SSO 的 ACL 规则限制 | 联系七牛 SSO 管理员将用户或 SP 加入白名单 |
| SSO 回调失败（ACS 无法访问） | Niubility 运行在 localhost，SSO 无法回调 | 确保 SP metadata 中的 ACS 地址是 SSO 服务器可达的 |

## 与旧版私有协议的区别

| | 旧版（私有协议） | 新版（SAML 2.0） |
|---|---|---|
| 协议 | AES-CFB 加密 token + 自定义 API | OASIS SAML 2.0 标准 |
| 认证方式 | `sso_secret`（AES 密钥） | IdP X.509 证书签名 |
| SP 注册 | `client_id` 参数 | SP Metadata XML 文件 + 重启 |
| 用户信息获取 | `GET /api/userinfo` | SAML 断言中的属性 |
| 可对接范围 | 仅七牛 SSO | 任何 SAML 2.0 IdP |
