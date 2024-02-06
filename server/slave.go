package server

import (
	"github.com/unskript/gotty/webtty"
)

// Slave is webtty.Slave with some additional methods.
type Slave interface {
	webtty.Slave

	Close() error
}

type Factory interface {
	Name() string
	New(params map[string][]string, headers map[string][]string) (Slave, error)
}
