module github.com/sorenisanerd/gotty/v2

go 1.13

require (
	github.com/NYTimes/gziphandler v1.1.1
	github.com/creack/pty v1.1.11
	github.com/elazarl/go-bindata-assetfs v1.0.1
	github.com/fatih/structs v1.1.0
	github.com/gorilla/websocket v1.4.2
	github.com/pkg/errors v0.9.1
	github.com/sorenisanerd/gotty v1.3.0
	github.com/urfave/cli/v2 v2.3.0
	github.com/yudai/hcl v0.0.0-20151013225006-5fa2393b3552
)

retract [v2.0.0, v2.1.1]
