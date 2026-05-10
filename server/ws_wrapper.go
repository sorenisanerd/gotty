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

		// Limit reads to the buffer size to prevent unbounded memory allocation
		limited := io.LimitReader(reader, int64(len(p)))
		b, err := io.ReadAll(limited)
		if err != nil {
			return 0, errors.Wrapf(err, "failed to read client message")
		}
		if len(b) > len(p) {
			return 0, errors.New("client message exceeded buffer size")
		}
		n = copy(p, b)
		return n, nil
	}
}
