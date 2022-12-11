//go:build dev

package bindata

import (
	"io"
	"io/fs"
	"os"
)

type GottyFS struct {
	fs.FS
}

var Fs GottyFS

func (gfs *GottyFS) ReadFile(name string) ([]byte, error) {
	fp, err := gfs.Open(name)
	if err != nil {
		return nil, err
	}

	return io.ReadAll(fp)
}

func init() {
	Fs = GottyFS{os.DirFS("bindata")}
}
