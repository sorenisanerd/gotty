package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	cli "github.com/urfave/cli/v2"

	"github.com/unskript/gotty/backend/localcommand"
	"github.com/unskript/gotty/pkg/homedir"
	"github.com/unskript/gotty/server"
	"github.com/unskript/gotty/utils"
)

func main() {
	app := cli.NewApp()
	app.Name = "gotty"
	app.Version = Version
	app.Usage = "Share your terminal as a web application"
	app.HideHelpCommand = true
	appOptions := &server.Options{}

	if err := utils.ApplyDefaultValues(appOptions); err != nil {
		exit(err, 1)
	}
	backendOptions := &localcommand.Options{}
	if err := utils.ApplyDefaultValues(backendOptions); err != nil {
		exit(err, 1)
	}

	cliFlags, flagMappings, err := utils.GenerateFlags(appOptions, backendOptions)
	if err != nil {
		exit(err, 3)
	}

	app.Flags = append(
		cliFlags,
		&cli.StringFlag{
			Name:    "config",
			Value:   "~/.gotty",
			Usage:   "Config file path",
			EnvVars: []string{"GOTTY_CONFIG"},
		},
	)

	app.Action = func(c *cli.Context) error {
		if c.NArg() == 0 {
			msg := "Error: No command given."
			cli.ShowAppHelp(c)
			exit(fmt.Errorf(msg), 1)
		}

		configFile := c.String("config")
		_, err := os.Stat(homedir.Expand(configFile))
		if configFile != "~/.gotty" || !os.IsNotExist(err) {
			if err := utils.ApplyConfigFile(configFile, appOptions, backendOptions); err != nil {
				exit(err, 2)
			}
		}

		utils.ApplyFlags(cliFlags, flagMappings, c, appOptions, backendOptions)

		if appOptions.Quiet {
			log.SetFlags(0)
			log.SetOutput(ioutil.Discard)
		}

		if c.IsSet("credential") {
			appOptions.EnableBasicAuth = true
		}
		if c.IsSet("tls-ca-crt") {
			appOptions.EnableTLSClientAuth = true
		}

		err = appOptions.Validate()
		if err != nil {
			exit(err, 6)
		}

		args := c.Args()
		factory, err := localcommand.NewFactory(args.First(), args.Tail(), backendOptions)
		if err != nil {
			exit(err, 3)
		}

		hostname, _ := os.Hostname()
		appOptions.TitleVariables = map[string]interface{}{
			"command":  args.First(),
			"argv":     args.Tail(),
			"hostname": hostname,
		}

		srv, err := server.New(factory, appOptions)
		if err != nil {
			exit(err, 3)
		}

		ctx, cancel := context.WithCancel(context.Background())
		gCtx, gCancel := context.WithCancel(context.Background())

		log.Printf("GoTTY is starting with command: %s", strings.Join(args.Slice(), " "))

		errs := make(chan error, 1)
		go func() {
			errs <- srv.Run(ctx, server.WithGracefullContext(gCtx))
		}()
		err = waitSignals(errs, cancel, gCancel)

		if err != nil && err != context.Canceled {
			fmt.Printf("Error: %s\n", err)
			exit(err, 8)
		}

		return nil
	}
	app.Run(os.Args)
}

func exit(err error, code int) {
	if err != nil {
		fmt.Println(err)
	}
	os.Exit(code)
}

func waitSignals(errs chan error, cancel context.CancelFunc, gracefullCancel context.CancelFunc) error {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(
		sigChan,
		syscall.SIGINT,
		syscall.SIGTERM,
	)

	select {
	case err := <-errs:
		return err

	case s := <-sigChan:
		switch s {
		case syscall.SIGINT:
			gracefullCancel()
			fmt.Println("C-C to force close")
			select {
			case err := <-errs:
				return err
			case <-sigChan:
				fmt.Println("Force closing...")
				cancel()
				return <-errs
			}
		default:
			cancel()
			return <-errs
		}
	}
}
