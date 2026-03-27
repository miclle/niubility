package auth

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"time"

	"github.com/miclle/niubility/cli/internal/api"
)

const ssoSuccessPageHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>登录完成</title>
  <style>
    body { font-family: sans-serif; background: #f5f5f5; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); max-width: 420px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>登录已完成</h1>
    <p>你可以回到终端继续使用 Niubility CLI。</p>
  </div>
</body>
</html>`

type ssoCallbackResult struct {
	Ticket string
	Error  string
}

// SSOLogin completes a browser-based SSO login flow for the CLI.
func SSOLogin(ctx context.Context, client *api.Client) error {
	listener, callbackURL, err := startLocalCallbackServer()
	if err != nil {
		return fmt.Errorf("start local callback server: %w", err)
	}
	defer listener.Close()

	results := make(chan ssoCallbackResult, 1)
	server := &http.Server{Handler: buildLocalCallbackMux(results)}
	go server.Serve(listener)
	defer server.Shutdown(context.Background())

	startResp, err := client.StartCLISSO(ctx, callbackURL)
	if err != nil {
		return fmt.Errorf("create CLI SSO login session: %w", err)
	}

	fmt.Println("正在启动 SSO 登录流程...")
	fmt.Printf("本地回调服务器已启动: %s\n\n", callbackURL)
	fmt.Println("正在打开浏览器...")
	fmt.Printf("如果浏览器没有自动打开，请手动访问:\n%s\n\n", startResp.BrowserURL)
	fmt.Println("等待登录完成...")

	if err := openBrowser(startResp.BrowserURL); err != nil {
		fmt.Printf("无法自动打开浏览器，请手动访问上述 URL: %v\n", err)
	}

	select {
	case result := <-results:
		if result.Error != "" {
			return fmt.Errorf(result.Error)
		}
		if result.Ticket == "" {
			return fmt.Errorf("no ticket received from local callback")
		}

		if _, err := client.ExchangeCLISSOTicket(ctx, result.Ticket); err != nil {
			return fmt.Errorf("exchange CLI SSO ticket: %w", err)
		}
		return nil

	case <-ctx.Done():
		return ctx.Err()
	}
}

func startLocalCallbackServer() (net.Listener, string, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, "", err
	}

	port := listener.Addr().(*net.TCPAddr).Port
	callbackURL := fmt.Sprintf("http://127.0.0.1:%d/callback", port)
	return listener, callbackURL, nil
}

func buildLocalCallbackMux(results chan<- ssoCallbackResult) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		result := ssoCallbackResult{
			Ticket: r.URL.Query().Get("ticket"),
			Error:  r.URL.Query().Get("error"),
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if result.Error != "" {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("<html><body><h1>登录失败</h1><p>请返回终端查看错误信息。</p></body></html>"))
		} else {
			_, _ = w.Write([]byte(ssoSuccessPageHTML))
		}

		select {
		case results <- result:
		default:
		}
	})

	return mux
}

func openBrowser(target string) error {
	if _, err := url.Parse(target); err != nil {
		return fmt.Errorf("invalid browser URL: %w", err)
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", target)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", target)
	default:
		cmd = exec.Command("xdg-open", target)
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case err := <-done:
		return err
	case <-time.After(2 * time.Second):
		return nil
	}
}
