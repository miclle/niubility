package auth

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"time"

	"github.com/miclle/niubility/cli/internal/api"
	clii18n "github.com/miclle/niubility/cli/internal/i18n"
)

const ssoSuccessPageHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login complete</title>
  <style>
    body { font-family: sans-serif; background: #f5f5f5; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); max-width: 420px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Login complete</h1>
    <p>You can return to the terminal and continue using Niubility CLI.</p>
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
		return fmt.Errorf("%s: %w", clii18n.T("SSO.Error.StartCallbackServer", "start local callback server", nil), err)
	}
	defer func() {
		_ = listener.Close()
	}()

	results := make(chan ssoCallbackResult, 1)
	server := &http.Server{Handler: buildLocalCallbackMux(results)}
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			select {
			case results <- ssoCallbackResult{Error: fmt.Sprintf("%s: %v", clii18n.T("SSO.Error.CallbackServer", "local callback server error", nil), err)}:
			default:
			}
		}
	}()
	defer func() {
		_ = server.Shutdown(context.Background())
	}()

	startResp, err := client.StartCLISSO(ctx, callbackURL)
	if err != nil {
		return fmt.Errorf("%s: %w", clii18n.T("SSO.Error.CreateSession", "create CLI SSO login session", nil), err)
	}

	fmt.Println(clii18n.T("SSO.Message.StartingFlow", "Starting SSO login flow...", nil))
	fmt.Printf("%s: %s\n\n", clii18n.T("SSO.Message.CallbackServerStarted", "Local callback server started", nil), callbackURL)
	fmt.Println(clii18n.T("SSO.Message.OpeningBrowser", "Opening browser...", nil))
	fmt.Printf("%s:\n%s\n\n", clii18n.T("SSO.Message.ManualVisit", "If the browser did not open automatically, visit this URL manually", nil), startResp.BrowserURL)
	fmt.Println(clii18n.T("SSO.Message.Waiting", "Waiting for login to complete...", nil))

	if err := openBrowser(startResp.BrowserURL); err != nil {
		fmt.Printf("%s: %v\n", clii18n.T("SSO.Error.OpenBrowser", "Could not open the browser automatically, please visit the URL above manually", nil), err)
	}

	select {
	case result := <-results:
		if result.Error != "" {
			return errors.New(result.Error)
		}
		if result.Ticket == "" {
			return fmt.Errorf("%s", clii18n.T("SSO.Error.NoTicket", "no ticket received from local callback", nil))
		}

		if _, err := client.ExchangeCLISSOTicket(ctx, result.Ticket); err != nil {
			return fmt.Errorf("%s: %w", clii18n.T("SSO.Error.ExchangeTicket", "exchange CLI SSO ticket", nil), err)
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
			_, _ = w.Write([]byte(clii18n.T("SSO.Page.Error", "<html><body><h1>Login failed</h1><p>Please return to the terminal to view the error details.</p></body></html>", nil)))
		} else {
			_, _ = w.Write([]byte(clii18n.T("SSO.Page.Success", ssoSuccessPageHTML, nil)))
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
		return fmt.Errorf("%s: %w", clii18n.T("SSO.Error.InvalidBrowserURL", "invalid browser URL", nil), err)
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
		return fmt.Errorf("start browser: %w", err)
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("browser process: %w", err)
		}
		return nil
	case <-time.After(2 * time.Second):
		return nil
	}
}
