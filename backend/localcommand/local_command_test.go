package localcommand

import (
	"bytes"
	"os/exec"
	"reflect"
	"testing"
	"time"
)

func TestNewFactory(t *testing.T) {
	command, err := exec.LookPath("false")
	if err != nil {
		t.Fatalf("failed to find false command: %v", err)
	}

	// command is resolved through PATH, so the assertion below is about
	// NewFactory storing what it was handed rather than about a specific
	// binary path.
	factory, err := NewFactory(command, []string{}, &Options{CloseSignal: 123, CloseTimeout: 321})
	if err != nil {
		t.Errorf("NewFactory() returned error")
		return
	}
	if factory.command != command {
		t.Errorf("factory.command = %v, expected %v", factory.command, command)
	}
	if !reflect.DeepEqual(factory.argv, []string{}) {
		t.Errorf("factory.argv = %v, expected %v", factory.argv, []string{})
	}
	if !reflect.DeepEqual(factory.options, &Options{CloseSignal: 123, CloseTimeout: 321}) {
		t.Errorf("factory.options = %v, expected %v", factory.options, &Options{})
	}

	slave, err := factory.New(nil, nil)
	if err != nil {
		t.Fatalf("factory.New() returned error: %v", err)
	}
	t.Cleanup(func() {
		if err := slave.Close(); err != nil {
			t.Errorf("close() failed: %v", err)
		}
	})
	lcmd, ok := slave.(*LocalCommand)
	if !ok {
		t.Fatalf("factory.New() returned %T, expected *LocalCommand", slave)
	}
	if lcmd.closeSignal != 123 {
		t.Errorf("lcmd.closeSignal = %v, expected %v", lcmd.closeSignal, 123)
	}
	if lcmd.closeTimeout != time.Second*321 {
		t.Errorf("lcmd.closeTimeout = %v, expected %v", lcmd.closeTimeout, time.Second*321)
	}
}

func TestFactoryNew(t *testing.T) {
	command, err := exec.LookPath("cat")
	if err != nil {
		t.Fatalf("failed to find cat command: %v", err)
	}

	factory, err := NewFactory(command, []string{}, &Options{})
	if err != nil {
		t.Errorf("NewFactory() returned error")
		return
	}

	slave, err := factory.New(nil, nil)
	if err != nil {
		t.Errorf("factory.New() returned error")
		return
	}

	writeBuf := []byte("foobar\n")
	n, err := slave.Write(writeBuf)
	if err != nil {
		t.Errorf("write() failed: %v", err)
		return
	}
	if n != 7 {
		t.Errorf("Unexpected write length. n = %d, expected n = %d", n, 7)
		return
	}

	// Local echo is on, so we get the output twice:
	// Once because we're "typing" it, and once more
	// repeated back to us by `cat`. Also, \r\n
	// because we're a terminal.
	expectedBuf := []byte("foobar\r\nfoobar\r\n")
	readBuf := make([]byte, 1024)
	var totalRead int
	for totalRead < 16 {
		n, err = slave.Read(readBuf[totalRead:])
		if err != nil {
			t.Errorf("read() failed: %v", err)
			return
		}
		totalRead += n
	}
	if totalRead != 16 {
		t.Errorf("Unexpected read length. totalRead = %d, expected totalRead = %d", totalRead, 16)
		return
	}
	if !bytes.Equal(readBuf[:totalRead], expectedBuf) {
		t.Errorf("unexpected output from slave: got %v, expected %v", readBuf[:totalRead], expectedBuf)
	}
	err = slave.Close()
	if err != nil {
		t.Errorf("close() failed: %v", err)
		return
	}

}
