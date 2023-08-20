package docker

import (
	"time"

	"github.com/sorenisanerd/gotty/server"
)

type Options struct {
	ContainerName string `hcl:"docker_container" flagName:"docker-container" flagSName:"" flagDescribe:"Name of the container to attach" default:""`
	CloseTimeout int `hcl:"docker_close_timeout" flagName:"docker-close-timeout" flagSName:"" flagDescribe:"Time in seconds to force kill process after client is disconnected (default: -1)" default:"-1"`
}

type Factory struct {
	command string
	argv    []string
	options *Options
	opts    []Option
}

func NewFactory(command string, argv []string, options *Options) (*Factory, error) {
	opts := []Option{WithDockerContainer(options.ContainerName)}
	if options.CloseTimeout >= 0 {
		opts = append(opts, WithCloseTimeout(time.Duration(options.CloseTimeout)*time.Second))
	}

	return &Factory{
		command: command,
		argv:    argv,
		options: options,
		opts:    opts,
	}, nil
}

func (factory *Factory) Name() string {
	return "docker exec"
}

func (factory *Factory) New(params map[string][]string, headers map[string][]string) (server.Slave, error) {
	argv := make([]string, len(factory.argv))
	copy(argv, factory.argv)
	if params["arg"] != nil && len(params["arg"]) > 0 {
		argv = append(argv, params["arg"]...)
	}

	return New(factory.command, argv, headers, factory.opts...)
}
