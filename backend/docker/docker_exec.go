package docker

import (
	"syscall"
	"time"
	"context"
	"strings"

	"github.com/pkg/errors"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"
)

const (
	DefaultCloseSignal  = syscall.SIGINT
	DefaultCloseTimeout = 10 * time.Second
)

type DockerExec struct {
	command string
	argv    []string

	containerName string

	closeTimeout time.Duration

	c types.HijackedResponse

	cli *client.Client
	id string

}

func New(command string, argv []string, headers map[string][]string, options ...Option) (*DockerExec, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		panic(err)
	}

	cmd := make([]string, 0)
	cmd = append(cmd, command)
	cmd = append(cmd, argv...)

	eConfig := types.ExecConfig {
		User:         "0:0",
		Privileged:   false,
		Tty:          true,
		AttachStdin:  true,
		AttachStderr: true,
		AttachStdout: true,
		Detach:       false,
		Env:          make([]string, 0),
		// TODO WorkingDir   string   // Working directory
		Cmd:          cmd,
	}

	eConfig.Env = append(eConfig.Env, "TERM=xterm-256color")

	// Combine headers into key=value pairs to set as env vars
	// Prefix the headers with "http_" so we don't overwrite any other env vars
	// which potentially has the same name and to bring these closer to what
	// a (F)CGI server would proxy to a backend service
	// Replace hyphen with underscore and make them all upper case
	for key, values := range headers {
		h := "HTTP_" + strings.Replace(strings.ToUpper(key), "-", "_", -1) + "=" + strings.Join(values, ",")
		// log.Printf("Adding header: %s", h)
		eConfig.Env = append(eConfig.Env, h)
	}

	lcmd := &DockerExec{
		command: command,
		argv:    argv,

		closeTimeout: DefaultCloseTimeout,

		cli:       cli,
	}

	for _, option := range options {
		option(lcmd)
	}

	ctx := context.Background()

	id, err := cli.ContainerExecCreate(ctx, lcmd.containerName, eConfig)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create exec")
	}
	lcmd.id = id.ID

	cSize := [2]uint{}
	hiResp, err := cli.ContainerExecAttach(ctx,id.ID,types.ExecStartCheck{Detach: false, Tty: true, ConsoleSize: &cSize})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to attach exec")
	}
	lcmd.c = hiResp

	return lcmd, nil
}

func (lcmd *DockerExec) Read(p []byte) (n int, err error) {
	return lcmd.c.Reader.Read(p)
}

func (lcmd *DockerExec) Write(p []byte) (n int, err error) {
	return lcmd.c.Conn.Write(p)
}

func (lcmd *DockerExec) Close() error {
	lcmd.c.Close()
	return nil
}

func (lcmd *DockerExec) WindowTitleVariables() map[string]interface{} {
	return map[string]interface{}{
		"command": lcmd.command,
		"argv":    lcmd.argv,
	}
}

func (lcmd *DockerExec) ResizeTerminal(width int, height int) error {
	ctx := context.Background()
	return lcmd.cli.ContainerExecResize(ctx,lcmd.id,types.ResizeOptions{Width: uint(width), Height: uint(height)})
}

func (lcmd *DockerExec) closeTimeoutC() <-chan time.Time {
	if lcmd.closeTimeout >= 0 {
		return time.After(lcmd.closeTimeout)
	}

	return make(chan time.Time)
}
