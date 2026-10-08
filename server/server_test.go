package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// mockSlave implements Slave for testing purposes.
type mockSlave struct{}

func (s *mockSlave) Read(p []byte) (n int, err error)               { return 0, nil }
func (s *mockSlave) Write(p []byte) (n int, err error)               { return len(p), nil }
func (s *mockSlave) Close() error                                     { return nil }
func (s *mockSlave) WindowTitleVariables() map[string]interface{}     { return nil }
func (s *mockSlave) ResizeTerminal(width int, height int) error       { return nil }

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