package server

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// mockSlave implements Slave for testing purposes.
type mockSlave struct{}

func (s *mockSlave) Read(p []byte) (n int, err error)             { return 0, nil }
func (s *mockSlave) Write(p []byte) (n int, err error)            { return len(p), nil }
func (s *mockSlave) Close() error                                 { return nil }
func (s *mockSlave) WindowTitleVariables() map[string]interface{} { return nil }
func (s *mockSlave) ResizeTerminal(width int, height int) error   { return nil }

// mockFactory implements Factory for testing purposes.
type mockFactory struct{}

func (f *mockFactory) Name() string { return "mock" }
func (f *mockFactory) New(params map[string][]string, headers map[string][]string) (Slave, error) {
	return &mockSlave{}, nil
}

func TestMultiInterfaceBinding_SingleAddress(t *testing.T) {
	// Backward compat: a single address (no comma) should work as before
	opts := &Options{
		Address: "127.0.0.1",
		Port:    "0",
		Quiet:   true,
	}

	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Run(ctx)
	}()

	time.Sleep(100 * time.Millisecond)

	select {
	case err := <-errCh:
		t.Fatalf("server.Run returned unexpectedly: %v", err)
	default:
	}

	cancel()
	<-errCh
}

func TestMultiInterfaceBinding_MultipleAddresses(t *testing.T) {
	// Test binding to 127.0.0.1 on a random port — verify server starts
	opts := &Options{
		Address: "127.0.0.1",
		Port:    "0",
		Quiet:   true,
	}

	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Run(ctx)
	}()

	time.Sleep(100 * time.Millisecond)

	select {
	case err := <-errCh:
		t.Fatalf("server.Run returned unexpectedly: %v", err)
	default:
	}

	cancel()
	<-errCh
}

func TestMultiInterfaceBinding_InvalidAddress(t *testing.T) {
	opts := &Options{
		Address: "999.999.999.999",
		Port:    "8080",
		Quiet:   true,
	}

	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = server.Run(ctx)
	if err == nil {
		t.Fatal("expected error for invalid address, got nil")
	}
	if !strings.Contains(err.Error(), "failed to listen") {
		t.Fatalf("expected error containing 'failed to listen', got: %v", err)
	}
}

func TestMultiInterfaceBinding_OneAddressFails(t *testing.T) {
	// When one address in a comma-separated list is invalid, the entire
	// server should fail and close any already-opened listeners.
	opts := &Options{
		Address: "127.0.0.1,999.999.999.999",
		Port:    "0",
		Quiet:   true,
	}

	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = server.Run(ctx)
	if err == nil {
		t.Fatal("expected error when one address is invalid, got nil")
	}
	if !strings.Contains(err.Error(), "failed to listen") {
		t.Fatalf("expected error containing 'failed to listen', got: %v", err)
	}
}

func TestMaxConnection_RefusesWithServiceUnavailable(t *testing.T) {
	// A connection beyond MaxConnection must be refused with 503, not a
	// silent 200 OK with an empty body.
	opts := &Options{
		Address:       "127.0.0.1",
		Port:          "0",
		Quiet:         true,
		MaxConnection: 1,
	}

	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	counter := newCounter(0)
	handler := server.setupHandlers(ctx, cancel, "/", counter)

	ts := httptest.NewServer(handler)
	defer ts.Close()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws"

	// First connection should be accepted.
	firstConn, firstResp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("first connection should have been accepted, got error: %v", err)
	}
	defer firstConn.Close()
	if firstResp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("expected first connection to get %d, got %d", http.StatusSwitchingProtocols, firstResp.StatusCode)
	}

	// Second connection should be refused with 503 while the first is held open.
	secondConn, secondResp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		secondConn.Close()
		t.Fatalf("expected second connection to be refused, but it was accepted")
	}
	if secondResp == nil {
		t.Fatalf("expected an HTTP response for the refused connection, got none (err: %v)", err)
	}
	if secondResp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("expected second connection to get %d, got %d", http.StatusServiceUnavailable, secondResp.StatusCode)
	}
}

func TestHandleConfig_EmitsConfirmClose(t *testing.T) {
	// /config.js must expose the confirm-close setting so the browser can decide
	// whether to arm the beforeunload guard.
	for _, tc := range []struct {
		name    string
		confirm bool
		want    string
	}{
		{"enabled", true, "var gotty_confirm_close = true;"},
		{"disabled", false, "var gotty_confirm_close = false;"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv, err := New(&mockFactory{}, &Options{Quiet: true, ConfirmClose: tc.confirm})
			if err != nil {
				t.Fatalf("failed to create server: %v", err)
			}

			rec := httptest.NewRecorder()
			srv.handleConfig(rec, httptest.NewRequest(http.MethodGet, "/config.js", nil))

			if rec.Code != http.StatusOK {
				t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tc.want) {
				t.Fatalf("expected config.js to contain %q, got:\n%s", tc.want, rec.Body.String())
			}
		})
	}
}

func TestHandleConfig_EmitsMobileKeys(t *testing.T) {
	// /config.js must tell the browser whether to show the touch-device key
	// strip. A read-only session ignores input, so the strip is off there too.
	for _, tc := range []struct {
		name  string
		keys  bool
		write bool
		want  string
	}{
		{"enabled with write", true, true, "var gotty_mobile_keys = true;"},
		{"enabled read-only", true, false, "var gotty_mobile_keys = false;"},
		{"disabled", false, true, "var gotty_mobile_keys = false;"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv, err := New(&mockFactory{}, &Options{Quiet: true, MobileKeys: tc.keys, PermitWrite: tc.write})
			if err != nil {
				t.Fatalf("failed to create server: %v", err)
			}

			rec := httptest.NewRecorder()
			srv.handleConfig(rec, httptest.NewRequest(http.MethodGet, "/config.js", nil))

			if rec.Code != http.StatusOK {
				t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tc.want) {
				t.Fatalf("expected config.js to contain %q, got:\n%s", tc.want, rec.Body.String())
			}
		})
	}
}

func TestMultiInterfaceBinding_AddressTrimming(t *testing.T) {
	// Spaces around addresses should be trimmed
	opts := &Options{
		Address: " 127.0.0.1 ",
		Port:    "0",
		Quiet:   true,
	}

	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Run(ctx)
	}()

	time.Sleep(100 * time.Millisecond)

	select {
	case err := <-errCh:
		t.Fatalf("server.Run returned unexpectedly: %v", err)
	default:
	}

	cancel()
	<-errCh
}

func TestWebSocket_RejectsOversizedMessageBeforeAuth(t *testing.T) {
	// An unauthenticated client must not be able to make the server buffer
	// an arbitrarily large message.
	opts := &Options{
		Address:         "127.0.0.1",
		Port:            "0",
		Quiet:           true,
		EnableBasicAuth: true,
		Credential:      "user:pass",
	}

	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	handler := server.setupHandlers(ctx, cancel, "/", newCounter(0))
	ts := httptest.NewServer(handler)
	defer ts.Close()

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.Close()

	// The write may fail partway once the server closes the connection.
	_ = conn.WriteMessage(websocket.TextMessage, make([]byte, maxWSMessageSize+1))

	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, _, err = conn.ReadMessage()
	if err == nil {
		t.Fatalf("expected the server to close the connection")
	}
	if ce, ok := err.(*websocket.CloseError); ok && ce.Code != websocket.CloseMessageTooBig {
		t.Fatalf("expected close code %d, got %d", websocket.CloseMessageTooBig, ce.Code)
	}
}

func TestWSWrapper_ReadRejectsMessageLargerThanBuffer(t *testing.T) {
	upgrader := websocket.Upgrader{}
	errCh := make(chan error, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			errCh <- err
			return
		}
		defer c.Close()
		_, err = (&wsWrapper{c}).Read(make([]byte, 8))
		errCh <- err
	}))
	defer ts.Close()

	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(ts.URL, "http"), nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.Close()
	if err := conn.WriteMessage(websocket.TextMessage, []byte("123456789")); err != nil {
		t.Fatalf("write failed: %v", err)
	}

	select {
	case err := <-errCh:
		if err == nil {
			t.Fatalf("expected an error for a message larger than the buffer")
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for Read to return")
	}
}

func TestCredentialWithoutEnableBasicAuth_StillRequiresAuth(t *testing.T) {
	// A credential set without enable_basic_auth (e.g. only in the config
	// file) must not be served unauthenticated from auth_token.js.
	opts := &Options{
		Address:    "127.0.0.1",
		Port:       "0",
		Quiet:      true,
		Credential: "user:pass",
	}

	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	handler := server.setupHandlers(ctx, cancel, "/", newCounter(0))
	ts := httptest.NewServer(handler)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/auth_token.js")
	if err != nil {
		t.Fatalf("GET auth_token.js failed: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected %d without credentials, got %d", http.StatusUnauthorized, resp.StatusCode)
	}
	if strings.Contains(string(body), "user:pass") {
		t.Fatalf("credential leaked in unauthenticated response: %q", body)
	}

	req, _ := http.NewRequest("GET", ts.URL+"/auth_token.js", nil)
	req.SetBasicAuth("user", "pass")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("authenticated GET failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected %d with credentials, got %d", http.StatusOK, resp.StatusCode)
	}
}

func TestAuthToken_RejectsCrossOriginRequests(t *testing.T) {
	opts := &Options{
		Address:    "127.0.0.1",
		Port:       "0",
		Quiet:      true,
		Credential: "user:pass",
	}

	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	handler := server.setupHandlers(ctx, cancel, "/", newCounter(0))
	ts := httptest.NewServer(handler)
	defer ts.Close()

	tests := []struct {
		secFetchSite string
		wantStatus   int
	}{
		{"", http.StatusOK},
		{"same-origin", http.StatusOK},
		{"none", http.StatusOK},
		{"same-site", http.StatusForbidden},
		{"cross-site", http.StatusForbidden},
	}

	for _, tt := range tests {
		req, _ := http.NewRequest("GET", ts.URL+"/auth_token.js", nil)
		req.SetBasicAuth("user", "pass")
		if tt.secFetchSite != "" {
			req.Header.Set("Sec-Fetch-Site", tt.secFetchSite)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("Sec-Fetch-Site %q: request failed: %v", tt.secFetchSite, err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != tt.wantStatus {
			t.Errorf("Sec-Fetch-Site %q: expected %d, got %d", tt.secFetchSite, tt.wantStatus, resp.StatusCode)
		}
		if got := resp.Header.Get("Cross-Origin-Resource-Policy"); got != "same-origin" {
			t.Errorf("Sec-Fetch-Site %q: expected Cross-Origin-Resource-Policy same-origin, got %q", tt.secFetchSite, got)
		}
		if tt.wantStatus != http.StatusOK && strings.Contains(string(body), "user:pass") {
			t.Errorf("Sec-Fetch-Site %q: credential leaked in rejected response", tt.secFetchSite)
		}
	}
}

func TestCredentialsEqual(t *testing.T) {
	tests := []struct {
		a, b string
		want bool
	}{
		{"user:pass", "user:pass", true},
		{"", "", true},
		{"user:pass", "user:pasS", false},
		{"user:pass", "user:pass2", false},
		{"user:pass", "", false},
	}
	for _, tt := range tests {
		if got := credentialsEqual(tt.a, tt.b); got != tt.want {
			t.Errorf("credentialsEqual(%q, %q) = %v, want %v", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestFrameAncestorsHeaders(t *testing.T) {
	tests := []struct {
		value   string
		wantCSP string
		wantXFO string
		wantErr bool
	}{
		{"", "frame-ancestors 'none'", "DENY", false},
		{"'none'", "frame-ancestors 'none'", "DENY", false},
		{"none", "frame-ancestors 'none'", "DENY", false},
		{"'self'", "frame-ancestors 'self'", "SAMEORIGIN", false},
		{"self", "frame-ancestors 'self'", "SAMEORIGIN", false},
		{"'self' https://dash.example.com", "frame-ancestors 'self' https://dash.example.com", "", false},
		{"https://a.example https://b.example", "frame-ancestors https://a.example https://b.example", "", false},
		{"'none' https://dash.example.com", "", "", true},
		{"'self'; script-src *", "", "", true},
		{"https://a.example, https://b.example", "", "", true},
		{"'self'\r\nX-Injected: 1", "", "", true},
	}
	for _, tt := range tests {
		csp, xfo, err := frameAncestorsHeaders(tt.value)
		if tt.wantErr {
			if err == nil {
				t.Errorf("frameAncestorsHeaders(%q): expected an error", tt.value)
			}
			continue
		}
		if err != nil {
			t.Errorf("frameAncestorsHeaders(%q): unexpected error: %v", tt.value, err)
			continue
		}
		if csp != tt.wantCSP || xfo != tt.wantXFO {
			t.Errorf("frameAncestorsHeaders(%q) = (%q, %q), want (%q, %q)", tt.value, csp, xfo, tt.wantCSP, tt.wantXFO)
		}
	}
}

func TestFrameHeadersOnResponses(t *testing.T) {
	tests := []struct {
		frameAncestors string
		wantCSP        string
		wantXFO        string
	}{
		{"", "frame-ancestors 'none'", "DENY"},
		{"'self' https://dash.example.com", "frame-ancestors 'self' https://dash.example.com", ""},
	}
	for _, tt := range tests {
		opts := &Options{
			Address:        "127.0.0.1",
			Port:           "0",
			Quiet:          true,
			Credential:     "user:pass",
			FrameAncestors: tt.frameAncestors,
		}
		server, err := New(&mockFactory{}, opts)
		if err != nil {
			t.Fatalf("failed to create server: %v", err)
		}

		ctx, cancel := context.WithCancel(context.Background())
		handler := server.setupHandlers(ctx, cancel, "/", newCounter(0))
		ts := httptest.NewServer(handler)

		// Check both the index page and a 401 from basic auth, which an
		// attacker could also try to frame.
		for _, withAuth := range []bool{true, false} {
			req, _ := http.NewRequest("GET", ts.URL+"/", nil)
			if withAuth {
				req.SetBasicAuth("user", "pass")
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("GET / failed: %v", err)
			}
			resp.Body.Close()
			if got := resp.Header.Get("Content-Security-Policy"); got != tt.wantCSP {
				t.Errorf("frame-ancestors %q, auth %v: Content-Security-Policy = %q, want %q", tt.frameAncestors, withAuth, got, tt.wantCSP)
			}
			if got := resp.Header.Get("X-Frame-Options"); got != tt.wantXFO {
				t.Errorf("frame-ancestors %q, auth %v: X-Frame-Options = %q, want %q", tt.frameAncestors, withAuth, got, tt.wantXFO)
			}
		}

		ts.Close()
		cancel()
	}
}

func TestNew_RejectsInvalidFrameAncestors(t *testing.T) {
	_, err := New(&mockFactory{}, &Options{FrameAncestors: "'self'; script-src *"})
	if err == nil {
		t.Fatalf("expected New to reject an invalid frame-ancestors value")
	}
}

func TestJSString(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"user:pass", `"user:pass"`},
		{"it's", `"it's"`},
		{`a"b\c`, `"a\"b\\c"`},
		{"';alert(1);'", `"';alert(1);'"`},
		{"</script><script>alert(1)</script>", `"\u003c/script\u003e\u003cscript\u003ealert(1)\u003c/script\u003e"`},
		{"line\nbreak\u2028", `"line\nbreak\u2028"`},
	}
	for _, tt := range tests {
		if got := jsString(tt.in); got != tt.want {
			t.Errorf("jsString(%q) = %s, want %s", tt.in, got, tt.want)
		}
	}
}

func TestScripts_EscapeOperatorValues(t *testing.T) {
	opts := &Options{
		Address:     "127.0.0.1",
		Port:        "0",
		Quiet:       true,
		Credential:  "user:pa'ss",
		WSQueryArgs: "a=1';alert(1);'",
	}
	server, err := New(&mockFactory{}, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	handler := server.setupHandlers(ctx, cancel, "/", newCounter(0))
	ts := httptest.NewServer(handler)
	defer ts.Close()

	get := func(path string) string {
		req, _ := http.NewRequest("GET", ts.URL+path, nil)
		req.SetBasicAuth("user", "pa'ss")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("GET %s failed: %v", path, err)
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		return string(body)
	}

	if got, want := get("/auth_token.js"), `var gotty_auth_token = "user:pa'ss";`; got != want {
		t.Errorf("auth_token.js = %q, want %q", got, want)
	}
	if got, want := get("/config.js"), `var gotty_ws_query_args = "a=1';alert(1);'";`; !strings.Contains(got, want) {
		t.Errorf("config.js does not contain %q:\n%s", want, got)
	}
}

func TestHeadersForBackend(t *testing.T) {
	in := http.Header{
		"Cookie":              {"session=abc"},
		"X-Remote-User":       {"alice"},
		"Authorization":       {"Basic dXNlcjpwYXNz"},
		"Proxy-Authorization": {"Basic dXNlcjpwYXNz"},
		"X_remote_user":       {"mallory"},
		"X.Weird":             {"1"},
	}
	got := headersForBackend(in)

	want := map[string][]string{
		"Cookie":        {"session=abc"},
		"X-Remote-User": {"alice"},
	}
	if len(got) != len(want) {
		t.Fatalf("headersForBackend() = %v, want %v", got, want)
	}
	for k, v := range want {
		if strings.Join(got[k], ",") != strings.Join(v, ",") {
			t.Errorf("header %q = %v, want %v", k, got[k], v)
		}
	}
}

// recordingFactory records the headers each backend was created with.
type recordingFactory struct {
	headers chan map[string][]string
}

func (f *recordingFactory) Name() string { return "recording" }
func (f *recordingFactory) New(params map[string][]string, headers map[string][]string) (Slave, error) {
	f.headers <- headers
	return &mockSlave{}, nil
}

func TestPassHeaders_DropsAuthorization(t *testing.T) {
	factory := &recordingFactory{headers: make(chan map[string][]string, 1)}
	opts := &Options{
		Address:     "127.0.0.1",
		Port:        "0",
		Quiet:       true,
		Credential:  "user:pass",
		PassHeaders: true,
	}
	server, err := New(factory, opts)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ts := httptest.NewServer(server.setupHandlers(ctx, cancel, "/", newCounter(0)))
	defer ts.Close()

	reqHeader := http.Header{}
	reqHeader.Set("Authorization", "Basic dXNlcjpwYXNz")
	reqHeader.Set("Cookie", "session=abc")
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(ts.URL, "http")+"/ws", reqHeader)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.Close()
	if err := conn.WriteMessage(websocket.TextMessage, []byte(`{"AuthToken":"user:pass"}`)); err != nil {
		t.Fatalf("write failed: %v", err)
	}

	select {
	case headers := <-factory.headers:
		if _, ok := headers["Authorization"]; ok {
			t.Errorf("Authorization header was passed to the backend")
		}
		if got := strings.Join(headers["Cookie"], ","); got != "session=abc" {
			t.Errorf("Cookie = %q, want %q", got, "session=abc")
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("backend was not created")
	}
}
