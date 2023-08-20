package docker

import (
	"time"
)

type Option func(*DockerExec)

func WithDockerContainer(name string) Option {
	return func(lcmd *DockerExec) {
		lcmd.containerName = name
	}
}

func WithCloseTimeout(timeout time.Duration) Option {
	return func(lcmd *DockerExec) {
		lcmd.closeTimeout = timeout
	}
}
