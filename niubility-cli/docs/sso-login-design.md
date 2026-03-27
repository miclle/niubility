# SSO 登录设计方案

## 概述

本文档描述 Niubility CLI 如何处理 SSO（单点登录）认证。SSO 允许用户通过企业身份提供商（IdP）进行身份验证，而不是使用用户名/密码。

## 支持的 SSO 协议

- **OIDC** (OpenID Connect)：基于 OAuth 2.0 的身份层
- **SAML 2.0**：企业级单点登录标准

## 方案：本地回调服务器

### 原理

CLI 在本地启动一个临时的 HTTP 服务器，用于接收 SSO 认证完成后的回调。

### 流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户电脑                                   │
│                                                                     │
│   终端                        浏览器                                 │
│  ┌──────────────┐           ┌──────────────┐                        │
│  │     CLI      │           │              │                        │
│  │              │           │              │                        │
│  │ ┌──────────┐ │  1.打开    │              │                        │
│  │ │  本地    │ │ ─────────> │   IdP 登录页  │                        │
│  │ │  HTTP    │ │  浏览器    │              │                        │
│  │ │  Server  │ │           │              │                        │
│  │ │  :随机端口│<─────────── │              │                        │
│  │ └──────────┘ │  4.回调    └──────────────┘                        │
│  │       │      │     到本地                                         │
│  │       │      │                                                    │
│  │       ▼      │                                                    │
│  │  5.获取 code │                                                    │
│  │       │      │                                                    │
│  └───────┼──────┘                                                    │
│          │                                                           │
└──────────┼───────────────────────────────────────────────────────────┘
           │
           │  6. POST /api/v1/sso/cli-exchange
           │     {"code": "xxx", "state": "yyy"}
           ▼
    ┌──────────────┐
    │   服务端      │
    │  Niubility   │
    └──────────────┘
```

### 详细步骤

1. **启动本地服务器**
   - CLI 启动一个临时的 HTTP 服务器
   - 监听 `127.0.0.1:0`（系统分配随机端口）
   - 注册 `/callback` 路径用于接收回调

2. **获取 SSO 登录 URL**
   - CLI 调用服务端 API，传递本地回调 URL
   - 服务端生成带有自定义回调的 SSO URL

3. **打开浏览器**
   - CLI 调用系统默认浏览器
   - 用户在浏览器中完成 IdP 登录

4. **接收回调**
   - IdP 认证成功后重定向到本地服务器
   - 本地服务器从 URL 参数中提取 `code` 和 `state`

5. **交换授权码**
   - CLI 将授权码发送到服务端
   - 服务端验证并返回会话凭证

6. **保存会话**
   - CLI 保存会话 Cookie 到本地

### 用户体验

```bash
$ niubility login --sso

正在启动 SSO 登录流程...
本地回调服务器已启动: http://127.0.0.1:54321/callback

正在打开浏览器...
如果浏览器没有自动打开，请手动访问:
https://niubility.example.com/api/v1/sso/cli-login?callback=http://127.0.0.1:54321/callback

等待登录完成... (5 分钟超时)

✓ 登录成功！
用户: miclle
邮箱: miclle@example.com
```

## 服务端 API 要求

### 1. 获取 CLI SSO 登录 URL

```
GET /api/v1/sso/cli-login?callback={callback_url}
```

**参数：**
- `callback` (必填): 本地回调 URL，必须是 `http://127.0.0.1:xxx/callback` 格式

**响应：**
- 重定向到 IdP 登录页面

**验证规则：**
- callback URL 必须是 `http://127.0.0.1` 或 `http://localhost`
- 端口号必须在有效范围内 (1-65535)
- 路径必须以 `/callback` 结尾

### 2. 交换授权码

```
POST /api/v1/sso/cli-exchange
Content-Type: application/json

{
  "code": "authorization_code",
  "state": "state_string"
}
```

**响应：**
```json
{
  "user": {
    "id": "xxx",
    "username": "miclle",
    "email": "miclle@example.com",
    "name": "miclle"
  }
}
```

**注意：** 响应通过 `Set-Cookie` 头设置会话 Cookie。

## CLI 实现代码

### 核心结构

```go
// internal/auth/sso.go

package auth

import (
    "context"
    "fmt"
    "net"
    "net/http"
    "time"
)

// SSOLogin handles SSO authentication flow
func SSOLogin(ctx context.Context, serverURL string) (*Session, error) {
    // 1. 启动本地回调服务器
    listener, port, err := startLocalServer()
    if err != nil {
        return nil, fmt.Errorf("start local server: %w", err)
    }
    defer listener.Close()

    callbackURL := fmt.Sprintf("http://127.0.0.1:%d/callback", port)

    // 2. 创建回调通道
    resultChan := make(chan *callbackResult)

    // 3. 注册回调处理
    mux := http.NewServeMux()
    mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
        result := &callbackResult{
            Code:  r.URL.Query().Get("code"),
            State: r.URL.Query().Get("state"),
        }

        // 返回成功页面
        w.Header().Set("Content-Type", "text/html; charset=utf-8")
        w.Write([]byte(successPageHTML))

        resultChan <- result
    })

    server := &http.Server{Handler: mux}
    go server.Serve(listener)
    defer server.Shutdown(ctx)

    // 4. 获取 SSO URL 并打开浏览器
    ssoURL := buildSSOURL(serverURL, callbackURL)

    fmt.Printf("正在打开浏览器...\n")
    fmt.Printf("如果浏览器没有自动打开，请访问: %s\n", ssoURL)

    if err := openBrowser(ssoURL); err != nil {
        fmt.Printf("无法自动打开浏览器，请手动访问上述 URL\n")
    }

    // 5. 等待回调
    fmt.Printf("等待登录完成...\n")

    select {
    case result := <-resultChan:
        if result.Error != "" {
            return nil, fmt.Errorf("SSO error: %s", result.Error)
        }

        // 6. 交换授权码
        session, err := exchangeCode(ctx, serverURL, result.Code, result.State)
        if err != nil {
            return nil, fmt.Errorf("exchange code: %w", err)
        }

        return session, nil

    case <-time.After(5 * time.Minute):
        return nil, fmt.Errorf("登录超时")
    case <-ctx.Done():
        return nil, ctx.Err()
    }
}

// startLocalServer starts a local HTTP server on a random port
func startLocalServer() (net.Listener, int, error) {
    listener, err := net.Listen("tcp", "127.0.0.1:0")
    if err != nil {
        return nil, 0, err
    }

    port := listener.Addr().(*net.TCPAddr).Port
    return listener, port, nil
}

type callbackResult struct {
    Code  string
    State string
    Error string
}

const successPageHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>登录成功</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .icon { font-size: 48px; color: #22c55e; }
        h1 { color: #333; margin: 16px 0; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✓</div>
        <h1>登录成功</h1>
        <p>您可以关闭此页面并返回终端继续操作。</p>
    </div>
</body>
</html>`
```

### 命令集成

```go
// cmd/login.go

var loginCmd = &cobra.Command{
    Use:   "login",
    Short: "Login to Niubility server",
    RunE: func(cmd *cobra.Command, args []string) error {
        // 检查是否启用 SSO
        if isSSOEnabled(cfg) || ssoFlag {
            return auth.SSOLogin(context.Background(), cfg.Server)
        }

        // 否则使用用户名密码登录
        return passwordLogin(cfg)
    },
}

func init() {
    loginCmd.Flags().BoolVar(&ssoFlag, "sso", false, "Use SSO login")
}
```

## 安全考虑

### 1. 回调 URL 验证

服务端必须验证回调 URL：
- 只允许 `http://127.0.0.1` 或 `http://localhost`
- 不允许外部域名或 IP

```go
func isValidCallbackURL(callback string) bool {
    u, err := url.Parse(callback)
    if err != nil {
        return false
    }

    // 必须是 http 协议
    if u.Scheme != "http" {
        return false
    }

    // 必须是 localhost 或 127.0.0.1
    host := u.Hostname()
    if host != "localhost" && host != "127.0.0.1" {
        return false
    }

    return true
}
```

### 2. State 参数

使用 state 参数防止 CSRF 攻击：
- 服务端生成带签名的 state
- 回调时验证 state 签名
- state 包含过期时间（建议 10 分钟）

### 3. 授权码有效期

- 授权码应只能使用一次
- 授权码有效期应很短（建议 5-10 分钟）

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| 浏览器无法打开 | 打印 URL 让用户手动访问 |
| 登录超时 | 提示用户重新执行登录命令 |
| 授权码无效 | 提示用户重新登录 |
| 网络错误 | 显示具体错误信息 |
| 用户取消 | 捕获中断信号，清理资源 |

## 测试策略

### 单元测试

- 本地服务器启动/关闭
- 回调 URL 解析和验证
- 授权码交换逻辑

### 集成测试

- 使用 mock IdP 服务器
- 测试完整的 SSO 流程
- 测试超时和错误场景

### 手动测试

- 真实 IdP 环境（如 Okta、Azure AD）
- 不同操作系统（macOS、Linux、Windows）
- 不同浏览器

## 参考资料

- [OAuth 2.0 for Native Apps (RFC 8252)](https://datatracker.ietf.org/doc/html/rfc8252)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [GitHub CLI OAuth Flow](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
