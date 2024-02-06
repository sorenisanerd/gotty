package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync/atomic"
	"io"
	"os"
	"path/filepath"

	"github.com/gorilla/websocket"
	"github.com/pkg/errors"

	"github.com/unskript/gotty/webtty"
)

func (server *Server) generateHandleWS(ctx context.Context, cancel context.CancelFunc, counter *counter) http.HandlerFunc {
	once := new(int64)

	go func() {
		select {
		case <-counter.timer().C:
			cancel()
		case <-ctx.Done():
		}
	}()

	return func(w http.ResponseWriter, r *http.Request) {
		if server.options.Once {
			success := atomic.CompareAndSwapInt64(once, 0, 1)
			if !success {
				http.Error(w, "Server is shutting down", http.StatusServiceUnavailable)
				return
			}
		}

		num := counter.add(1)
		closeReason := "unknown reason"

		defer func() {
			num := counter.done()
			log.Printf(
				"Connection closed by %s: %s, connections: %d/%d",
				closeReason, r.RemoteAddr, num, server.options.MaxConnection,
			)

			if server.options.Once {
				cancel()
			}
		}()

		if int64(server.options.MaxConnection) != 0 {
			if num > server.options.MaxConnection {
				closeReason = "exceeding max number of connections"
				return
			}
		}

		log.Printf("New client connected: %s, connections: %d/%d", r.RemoteAddr, num, server.options.MaxConnection)

		if r.Method != "GET" {
			http.Error(w, "Method not allowed", 405)
			return
		}

		conn, err := server.upgrader.Upgrade(w, r, nil)
		if err != nil {
			closeReason = err.Error()
			return
		}
		defer conn.Close()

		if server.options.PassHeaders {
			err = server.processWSConn(ctx, conn, r.Header)
		} else {
			err = server.processWSConn(ctx, conn, nil)
		}

		switch err {
		case ctx.Err():
			closeReason = "cancelation"
		case webtty.ErrSlaveClosed:
			closeReason = server.factory.Name()
		case webtty.ErrMasterClosed:
			closeReason = "client"
		default:
			closeReason = fmt.Sprintf("an error: %s", err)
		}
	}
}

func (server *Server) processWSConn(ctx context.Context, conn *websocket.Conn, headers map[string][]string) error {
	typ, initLine, err := conn.ReadMessage()
	if err != nil {
		return errors.Wrapf(err, "failed to authenticate websocket connection")
	}
	if typ != websocket.TextMessage {
		return errors.New("failed to authenticate websocket connection: invalid message type")
	}

	var init InitMessage
	err = json.Unmarshal(initLine, &init)
	if err != nil {
		return errors.Wrapf(err, "failed to authenticate websocket connection")
	}
	if init.AuthToken != server.options.Credential {
		return errors.New("failed to authenticate websocket connection")
	}

	queryPath := "?"
	if server.options.PermitArguments && init.Arguments != "" {
		queryPath = init.Arguments
	}

	query, err := url.Parse(queryPath)
	if err != nil {
		return errors.Wrapf(err, "failed to parse arguments")
	}
	params := query.Query()
	var slave Slave
	slave, err = server.factory.New(params, headers)
	if err != nil {
		return errors.Wrapf(err, "failed to create backend")
	}
	defer slave.Close()

	titleVars := server.titleVariables(
		[]string{"server", "master", "slave"},
		map[string]map[string]interface{}{
			"server": server.options.TitleVariables,
			"master": map[string]interface{}{
				"remote_addr": conn.RemoteAddr(),
			},
			"slave": slave.WindowTitleVariables(),
		},
	)

	titleBuf := new(bytes.Buffer)
	err = server.titleTemplate.Execute(titleBuf, titleVars)
	if err != nil {
		return errors.Wrapf(err, "failed to fill window title template")
	}

	opts := []webtty.Option{
		webtty.WithWindowTitle(titleBuf.Bytes()),
	}
	if server.options.PermitWrite {
		opts = append(opts, webtty.WithPermitWrite())
	}
	if server.options.EnableReconnect {
		opts = append(opts, webtty.WithReconnect(server.options.ReconnectTime))
	}
	if server.options.Width > 0 {
		opts = append(opts, webtty.WithFixedColumns(server.options.Width))
	}
	if server.options.Height > 0 {
		opts = append(opts, webtty.WithFixedRows(server.options.Height))
	}
	tty, err := webtty.New(&wsWrapper{conn}, slave, opts...)
	if err != nil {
		return errors.Wrapf(err, "failed to create webtty")
	}

	err = tty.Run(ctx)

	return err
}

func (server *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	indexVars, err := server.indexVariables(r)
	if err != nil {
		http.Error(w, "Internal Server Error", 500)
		return
	}

	indexBuf := new(bytes.Buffer)
	err = server.indexTemplate.Execute(indexBuf, indexVars)
	if err != nil {
		http.Error(w, "Internal Server Error", 500)
		return
	}

	w.Write(indexBuf.Bytes())
}

func (server *Server) handleManifest(w http.ResponseWriter, r *http.Request) {
	indexVars, err := server.indexVariables(r)
	if err != nil {
		http.Error(w, "Internal Server Error", 500)
		return
	}

	indexBuf := new(bytes.Buffer)
	err = server.manifestTemplate.Execute(indexBuf, indexVars)
	if err != nil {
		http.Error(w, "Internal Server Error", 500)
		return
	}

	w.Write(indexBuf.Bytes())
}

func (server *Server) indexVariables(r *http.Request) (map[string]interface{}, error) {
	titleVars := server.titleVariables(
		[]string{"server", "master"},
		map[string]map[string]interface{}{
			"server": server.options.TitleVariables,
			"master": map[string]interface{}{
				"remote_addr": r.RemoteAddr,
			},
		},
	)

	titleBuf := new(bytes.Buffer)
	err := server.titleTemplate.Execute(titleBuf, titleVars)
	if err != nil {
		return nil, err
	}

	indexVars := map[string]interface{}{
		"title": titleBuf.String(),
	}
	return indexVars, err
}

func (server *Server) handleAuthToken(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript")
	// @TODO hashing?
	w.Write([]byte("var gotty_auth_token = '" + server.options.Credential + "';"))
}

func (server *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript")
	w.Write([]byte("var gotty_term = 'xterm';"))
}

// titleVariables merges maps in a specified order.
// varUnits are name-keyed maps, whose names will be iterated using order.
func (server *Server) titleVariables(order []string, varUnits map[string]map[string]interface{}) map[string]interface{} {
	titleVars := map[string]interface{}{}

	for _, name := range order {
		vars, ok := varUnits[name]
		if !ok {
			panic("title variable name error")
		}
		for key, val := range vars {
			titleVars[key] = val
		}
	}

	// safe net for conflicted keys
	for _, name := range order {
		titleVars[name] = varUnits[name]
	}

	return titleVars
}

// Add a new method to handle file download to gotty
func (server *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }
    // Get the file from the form data
    file, handler, err := r.FormFile("file")
    if err != nil {
        http.Error(w, fmt.Sprintf("Error retrieving file: %s", err), http.StatusBadRequest)
        return
    }
    defer file.Close()

    // Save the file to a location (you might want to customize this)
    filepath := filepath.Join("/unskript/downloads/", handler.Filename)
    outFile, err := os.Create(filepath)
    if err != nil {
        http.Error(w, fmt.Sprintf("Error creating file: %s", err), http.StatusInternalServerError)
        return
    }
    defer outFile.Close()

    // Copy the file content to the destination file
    _, err = io.Copy(outFile, file)
    if err != nil {
        http.Error(w, fmt.Sprintf("Error copying file: %s", err), http.StatusInternalServerError)
        return
    }

    log.Printf("File %s Downloaded successfully", handler.Filename)
}

// Add a new method to handle file uploads from gotty
func (server *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Retrieve the file path from the request parameters
    filePath := r.FormValue("path")
    if filePath == "" {
        http.Error(w, "File path parameter 'path' is missing", http.StatusBadRequest)
        return
    }

    // Open the file
    file, err := os.Open(filePath)
    if err != nil {
        http.Error(w, fmt.Sprintf("Error opening file: %s", err), http.StatusInternalServerError)
        return
    }
    defer file.Close()

    // Set the appropriate headers for download
    w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(filePath))
    w.Header().Set("Content-Type", "application/octet-stream")

    // Copy the file content to the response writer
    _, err = io.Copy(w, file)
    if err != nil {
        http.Error(w, fmt.Sprintf("Error copying file to response: %s", err), http.StatusInternalServerError)
        return
    }
}
