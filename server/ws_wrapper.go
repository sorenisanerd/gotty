package server

import (
	"io"

	"github.com/gorilla/websocket"
	"github.com/pkg/errors"
)

type wsWrapper struct {
	*websocket.Conn
}

func (wsw *wsWrapper) Write(p []byte) (n int, err error) {
	writer, err := wsw.Conn.NextWriter(websocket.TextMessage)
	if err != nil {
		return 0, err
	}
	defer writer.Close()
	return writer.Write(p)
}

func (wsw *wsWrapper) Read(p []byte) (n int, err error) {
	for {
		msgType, reader, err := wsw.Conn.NextReader()
		if err != nil {
			return 0, err
		}

		if msgType != websocket.TextMessage {
			continue
		}

		// Read at most one byte more than fits in p, so an oversized message
		// is detected without buffering all of it.
		b, err := io.ReadAll(io.LimitReader(reader, int64(len(p))+1))
		if err != nil {
			return 0, err
		}
		if len(b) > len(p) {
			return 0, errors.Errorf("client message exceeded buffer size of %d bytes", len(p))
		}
		return copy(p, b), nil
	}
}
