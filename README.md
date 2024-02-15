# ![](https://raw.githubusercontent.com/sorenisanerd/gotty/master/resources/favicon.ico) GoTTY - Share your terminal as a web application
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-57-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

[![GitHub release](http://img.shields.io/github/release/sorenisanerd/gotty.svg?style=flat-square)][release]
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)][license]
[![Maintainer streaming](https://twitch-status.soren.tools/sorencodes)][twitch]

[release]: https://github.com/sorenisanerd/gotty/releases
[license]: https://github.com/sorenisanerd/gotty/blob/master/LICENSE
[twitch]: https://twitch.tv/sorencodes

GoTTY is a simple command line tool that turns your CLI tools into web applications.

[Original work](https://github.com/yudai/gotty) by [Iwasaki Yudai](https://github.com/yudai). There would be no GoTTY without him. ❤️

![Screenshot](https://raw.githubusercontent.com/sorenisanerd/gotty/master/screenshot.gif)

# Installation

## From release page

You can download the latest stable binary file from the [Releases](https://github.com/sorenisanerd/gotty/releases) page. Note that the release marked `Pre-release` is built for testing purpose, which can include unstable or breaking changes. Download a release marked [Latest release](https://github.com/sorenisanerd/gotty/releases/latest) for a stable build.

(Files named with `darwin_amd64` are for Mac OS X users)

## Homebrew Installation

You can install GoTTY with [Homebrew](http://brew.sh/) as well.

```sh
$ brew install sorenisanerd/gotty/gotty
```

## `go get` Installation (Development)

If you have a Go language environment, you can install GoTTY with the `go get` command. However, this command builds a binary file from the latest master branch, which can include unstable or breaking changes. GoTTY requires go1.9 or later.

```sh
$ go get github.com/sorenisanerd/gotty
```

# Usage

```
Usage: gotty [options] <command> [<arguments...>]
```

Run `gotty` with your preferred command as its arguments (e.g. `gotty top`).

By default, GoTTY starts a web server at port 8080. Open the URL on your web browser and you can see the running command as if it were running on your terminal.

## Options
```sh
   --address value, -a value     IP address to listen (default: "0.0.0.0") [$GOTTY_ADDRESS]
   --port value, -p value        Port number to liten (default: "8080") [$GOTTY_PORT]
   --path value, -m value        Base path (default: "/") [$GOTTY_PATH]
   --permit-write, -w            Permit clients to write to the TTY (BE CAREFUL) (default: false) [$GOTTY_PERMIT_WRITE]
   --credential value, -c value  Credential for Basic Authentication (ex: user:pass, default disabled) [$GOTTY_CREDENTIAL]
   --random-url, -r              Add a random string to the URL (default: false) [$GOTTY_RANDOM_URL]
   --random-url-length value     Random URL length (default: 8) [$GOTTY_RANDOM_URL_LENGTH]
   --tls, -t                     Enable TLS/SSL (default: false) [$GOTTY_TLS]
   --tls-crt value               TLS/SSL certificate file path (default: "~/.gotty.crt") [$GOTTY_TLS_CRT]
   --tls-key value               TLS/SSL key file path (default: "~/.gotty.key") [$GOTTY_TLS_KEY]
   --tls-ca-crt value            TLS/SSL CA certificate file for client certifications (default: "~/.gotty.ca.crt") [$GOTTY_TLS_CA_CRT]
   --index value                 Custom index.html file [$GOTTY_INDEX]
   --title-format value          Title format of browser window (default: "{{ .command }}@{{ .hostname }}") [$GOTTY_TITLE_FORMAT]
   --reconnect                   Enable reconnection (default: false) [$GOTTY_RECONNECT]
   --reconnect-time value        Time to reconnect (default: 10) [$GOTTY_RECONNECT_TIME]
   --max-connection value        Maximum connection to gotty (default: 0) [$GOTTY_MAX_CONNECTION]
   --once                        Accept only one client and exit on disconnection (default: false) [$GOTTY_ONCE]
   --timeout value               Timeout seconds for waiting a client(0 to disable) (default: 0) [$GOTTY_TIMEOUT]
   --permit-arguments            Permit clients to send command line arguments in URL (e.g. http://example.com:8080/?arg=AAA&arg=BBB) (default: false) [$GOTTY_PERMIT_ARGUMENTS]
   --width value                 Static width of the screen, 0(default) means dynamically resize (default: 0) [$GOTTY_WIDTH]
   --height value                Static height of the screen, 0(default) means dynamically resize (default: 0) [$GOTTY_HEIGHT]
   --ws-origin value             A regular expression that matches origin URLs to be accepted by WebSocket. No cross origin requests are acceptable by default [$GOTTY_WS_ORIGIN]
   --ws-query-args value         Querystring arguments to append to the websocket instantiation [$GOTTY_WS_QUERY_ARGS]
   --enable-webgl                Enable WebGL renderer (default: true) [$GOTTY_ENABLE_WEBGL]
   --close-signal value          Signal sent to the command process when gotty close it (default: SIGHUP) (default: 1) [$GOTTY_CLOSE_SIGNAL]
   --close-timeout value         Time in seconds to force kill process after client is disconnected (default: -1) (default: -1) [$GOTTY_CLOSE_TIMEOUT]
   --config value                Config file path (default: "~/.gotty") [$GOTTY_CONFIG]
   --help, -h                    show help (default: false)
   --version, -v                 print the version (default: false)
```
### Config File
You can customize default options and your terminal by providing a config file to the `gotty` command. GoTTY loads a profile file at `~/.gotty` by default when it exists.

```
// Listen at port 9000 by default
port = "9000"

// Enable TSL/SSL by default
enable_tls = true

```

See the [`.gotty`](https://github.com/sorenisanerd/gotty/blob/master/.gotty) file in this repository for the list of configuration options.

### Security Options

By default, GoTTY doesn't allow clients to send any keystrokes or commands except terminal window resizing. When you want to permit clients to write input to the TTY, add the `-w` option. However, accepting input from remote clients is dangerous for most commands. When you need interaction with the TTY for some reasons, consider starting GoTTY with tmux or GNU Screen and run your command on it (see "Sharing with Multiple Clients" section for detail).

To restrict client access, you can use the `-c` option to enable the basic authentication. With this option, clients need to input the specified username and password to connect to the GoTTY server. Note that the credentials will be transmitted between the server and clients in plain text. For more strict authentication, consider the SSL/TLS client certificate authentication described below.

The `-r` option is a little bit more casual way to restrict access. With this option, GoTTY generates a random URL so that only people who know the URL can get access to the server.

All traffic between the server and clients are NOT encrypted by default. When you send secret information through GoTTY, we strongly recommend you use the `-t` option which enables TLS/SSL on the session. By default, GoTTY loads the crt and key files placed at `~/.gotty.crt` and `~/.gotty.key`. You can overwrite these file paths with the `--tls-crt` and `--tls-key` options. When you need to generate a self-signed certification file, you can use the `openssl` command.

```sh
openssl req -x509 -nodes -days 9999 -newkey rsa:2048 -keyout ~/.gotty.key -out ~/.gotty.crt
```

(NOTE: For Safari uses, see [how to enable self-signed certificates for WebSockets](http://blog.marcon.me/post/24874118286/secure-websockets-safari) when use self-signed certificates)

For additional security, you can use the SSL/TLS client certificate authentication by providing a CA certificate file to the `--tls-ca-crt` option (this option requires the `-t` or `--tls` to be set). This option requires all clients to send valid client certificates that are signed by the specified certification authority.

## Sharing with Multiple Clients

GoTTY starts a new process with the given command when a new client connects to the server. This means users cannot share a single terminal with others by default. However, you can use terminal multiplexers for sharing a single process with multiple clients.
### Screen
After installing GNU screen, start a new session with `screen -S name-for-session` and connect to it with gotty in another terminal window/tab through `screen -x name-for-session`. All commands and activities being done in the first terminal tab/window will now be broadcasted by gotty.
### Tmux
For example, you can start a new tmux session named `gotty` with `top` command by the command below.

```sh
$ gotty tmux new -A -s gotty top
```

This command doesn't allow clients to send keystrokes, however, you can attach the session from your local terminal and run operations like switching the mode of the `top` command. To connect to the tmux session from your terminal, you can use following command.

```sh
$ tmux new -A -s gotty
```

By using terminal multiplexers, you can have the control of your terminal and allow clients to just see your screen.

### Quick Sharing on tmux

To share your current session with others by a shortcut key, you can add a line like below to your `.tmux.conf`.

```
# Start GoTTY in a new window with C-t
bind-key C-t new-window "gotty tmux attach -t `tmux display -p '#S'`"
```

## Playing with Docker

When you want to create a jailed environment for each client, you can use Docker containers like following:

```sh
$ gotty -w docker run -it --rm busybox
```

## Development

You can build a binary by simply running `make`. go1.16 is required.

To build the frontend part (JS files and other static files), you need `npm`.

## Architecture

GoTTY uses [xterm.js](https://xtermjs.org/) to run a JavaScript based terminal on web browsers. GoTTY itself provides a websocket server that simply relays output from the TTY to clients and receives input from clients and forwards it to the TTY. This xterm + websocket idea is inspired by [Wetty](https://github.com/krishnasrinivas/wetty).

## Alternatives

### Command line client

* [gotty-client](https://github.com/moul/gotty-client): If you want to connect to GoTTY server from your terminal

### Terminal/SSH on Web Browsers

* [Secure Shell (Chrome App)](https://chrome.google.com/webstore/detail/secure-shell/pnhechapfaindjhompbnflcldabbghjo): If you are a chrome user and need a "real" SSH client on your web browser, perhaps the Secure Shell app is what you want
* [Wetty](https://github.com/krishnasrinivas/wetty): Node based web terminal (SSH/login)
* [ttyd](https://tsl0922.github.io/ttyd): C port of GoTTY with CJK and IME support

### Terminal Sharing

* [tmate](http://tmate.io/): Forked-Tmux based Terminal-Terminal sharing
* [termshare](https://termsha.re): Terminal-Terminal sharing through a HTTP server
* [tmux](https://tmux.github.io/): Tmux itself also supports TTY sharing through SSH)

# License

The MIT License

# Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://yudai.arielworks.com/"><img src="https://avatars.githubusercontent.com/u/33192?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Iwasaki Yudai</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=yudai" title="Code">💻</a></td>
    <td align="center"><a href="http://linux2go.dk/"><img src="https://avatars.githubusercontent.com/u/160090?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Soren L. Hansen</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Asorenisanerd" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/uovobw"><img src="https://avatars.githubusercontent.com/u/1194751?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Andrea Lusuardi</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=uovobw" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/moul"><img src="https://avatars.githubusercontent.com/u/94029?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Manfred Touron</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=moul" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/svanellewee"><img src="https://avatars.githubusercontent.com/u/1567439?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Stephan</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=svanellewee" title="Code">💻</a></td>
    <td align="center"><a href="https://fr.linkedin.com/in/quentinperez"><img src="https://avatars.githubusercontent.com/u/3081204?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Quentin Perez</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=QuentinPerez" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jizhilong"><img src="https://avatars.githubusercontent.com/u/816618?v=4?s=100" width="100px;" alt=""/><br /><sub><b>jzl</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=jizhilong" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://majid.info/"><img src="https://avatars.githubusercontent.com/u/331198?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Fazal Majid</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=fazalmajid" title="Code">💻</a></td>
    <td align="center"><a href="https://narrationbox.com/"><img src="https://avatars.githubusercontent.com/u/7126128?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Immortalin</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=Immortalin" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/freakhill"><img src="https://avatars.githubusercontent.com/u/916582?v=4?s=100" width="100px;" alt=""/><br /><sub><b>freakhill</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=freakhill" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/0xflotus"><img src="https://avatars.githubusercontent.com/u/26602940?v=4?s=100" width="100px;" alt=""/><br /><sub><b>0xflotus</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=0xflotus" title="Code">💻</a></td>
    <td align="center"><a href="https://andy.blog/"><img src="https://avatars.githubusercontent.com/u/52292?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Andy Skelton</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=skeltoac" title="Code">💻</a></td>
    <td align="center"><a href="https://twitter.com/artdevjs"><img src="https://avatars.githubusercontent.com/u/7567983?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Artem Medvedev</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=artdevjs" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/blakejennings"><img src="https://avatars.githubusercontent.com/u/1976331?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Blake Jennings</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=blakejennings" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/jensenbox"><img src="https://avatars.githubusercontent.com/u/189265?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Christian Jensen</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=jensenbox" title="Code">💻</a></td>
    <td align="center"><a href="https://wilk.tech/"><img src="https://avatars.githubusercontent.com/u/9367803?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Christopher Wilkinson</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=TechWilk" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/RealCyGuy"><img src="https://avatars.githubusercontent.com/u/54488650?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Cyrus</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=RealCyGuy" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/dehorsley"><img src="https://avatars.githubusercontent.com/u/3401668?v=4?s=100" width="100px;" alt=""/><br /><sub><b>David Horsley</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=dehorsley" title="Code">💻</a></td>
    <td align="center"><a href="https://jasoncooke.dev/"><img src="https://avatars.githubusercontent.com/u/5185660?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jason Cooke</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=Jason-Cooke" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/DenKoren"><img src="https://avatars.githubusercontent.com/u/3419381?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Denis Korenevskiy</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=DenKoren" title="Code">💻</a></td>
    <td align="center"><a href="https://www.stucchi.ch/"><img src="https://avatars.githubusercontent.com/u/1331438?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Massimiliano Stucchi</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=stucchimax" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://www.linkedin.com/in/felixoid/"><img src="https://avatars.githubusercontent.com/u/3025537?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mikhail f. Shiryaev</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=Felixoid" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/guywithnose"><img src="https://avatars.githubusercontent.com/u/1059169?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Robert Bittle</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=guywithnose" title="Code">💻</a></td>
    <td align="center"><a href="https://deebas.com/"><img src="https://avatars.githubusercontent.com/u/283482?v=4?s=100" width="100px;" alt=""/><br /><sub><b>sebastian haas</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=sehaas" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/shoz"><img src="https://avatars.githubusercontent.com/u/225194?v=4?s=100" width="100px;" alt=""/><br /><sub><b>shoji</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=shoz" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/tsl0922"><img src="https://avatars.githubusercontent.com/u/1680515?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Shuanglei Tao</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=tsl0922" title="Code">💻</a></td>
    <td align="center"><a href="https://gitter.im/"><img src="https://avatars.githubusercontent.com/u/8518239?v=4?s=100" width="100px;" alt=""/><br /><sub><b>The Gitter Badger</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=gitter-badger" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/xinsnake"><img src="https://avatars.githubusercontent.com/u/1287677?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jacob Zhou</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=xinsnake" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/zyfdegh"><img src="https://avatars.githubusercontent.com/u/7880217?v=4?s=100" width="100px;" alt=""/><br /><sub><b>zyfdegh</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=zyfdegh" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/fredster33"><img src="https://avatars.githubusercontent.com/u/64927044?v=4?s=100" width="100px;" alt=""/><br /><sub><b>fredster33</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=fredster33" title="Code">💻</a></td>
    <td align="center"><a href="https://mattn.kaoriya.net/"><img src="https://avatars.githubusercontent.com/u/10111?v=4?s=100" width="100px;" alt=""/><br /><sub><b>mattn</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=mattn" title="Code">💻</a></td>
    <td align="center"><a href="https://www.shingt.com/"><img src="https://avatars.githubusercontent.com/u/1391330?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Shinichi Goto</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=shingt" title="Code">💻</a></td>
    <td align="center"><a href="https://twitter.com/_yogeshsingh"><img src="https://avatars.githubusercontent.com/u/8512357?v=4?s=100" width="100px;" alt=""/><br /><sub><b>ygit</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=ygit" title="Code">💻</a></td>
    <td align="center"><a href="http://forum.cachem.fr/viewforum.php?f=21"><img src="https://avatars.githubusercontent.com/u/3392684?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Stéphane</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Anephaste" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://rusnak.io/"><img src="https://avatars.githubusercontent.com/u/42201?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Pavol Rusnak</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Aprusnak" title="Bug reports">🐛</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/devanlai"><img src="https://avatars.githubusercontent.com/u/1348448?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Devan Lai</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=devanlai" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jkandasa"><img src="https://avatars.githubusercontent.com/u/1004403?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jeeva Kandasamy</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=jkandasa" title="Code">💻</a></td>
    <td align="center"><a href="https://twitch.tv/iamhardliner"><img src="https://avatars.githubusercontent.com/u/2937272?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Steve Biedermann</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/commits?author=hardliner66" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/xgdgsc"><img src="https://avatars.githubusercontent.com/u/1189869?v=4?s=100" width="100px;" alt=""/><br /><sub><b>xgdgsc</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Axgdgsc" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/flechaig"><img src="https://avatars.githubusercontent.com/u/10887132?v=4?s=100" width="100px;" alt=""/><br /><sub><b>flechaig</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Aflechaig" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/Fan-SJ"><img src="https://avatars.githubusercontent.com/u/49977708?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Fan-SJ</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3AFan-SJ" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/dmartin"><img src="https://avatars.githubusercontent.com/u/1657652?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Dustin Martin</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Admartin" title="Bug reports">🐛</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://ahmet.dev/"><img src="https://avatars.githubusercontent.com/u/159209?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ahmet Alp Balkan</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Aahmetb" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/CoconutMacaroon"><img src="https://avatars.githubusercontent.com/u/45187468?v=4?s=100" width="100px;" alt=""/><br /><sub><b>CoconutMacaroon</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3ACoconutMacaroon" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.dannyben.com/"><img src="https://avatars.githubusercontent.com/u/2405099?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Danny Ben Shitrit</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3ADannyBen" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/George-NG"><img src="https://avatars.githubusercontent.com/u/28577165?v=4?s=100" width="100px;" alt=""/><br /><sub><b>George-NG</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3AGeorge-NG" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/ghthor"><img src="https://avatars.githubusercontent.com/u/160298?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Will Owens</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Aghthor" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://jpillora.com/"><img src="https://avatars.githubusercontent.com/u/633843?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jaime Pillora</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Ajpillora" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/kaisawind"><img src="https://avatars.githubusercontent.com/u/4010613?v=4?s=100" width="100px;" alt=""/><br /><sub><b>kaisawind</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Akaisawind" title="Bug reports">🐛</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/linyinli"><img src="https://avatars.githubusercontent.com/u/42955482?v=4?s=100" width="100px;" alt=""/><br /><sub><b>linyinli</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Alinyinli" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/LucaMarconato"><img src="https://avatars.githubusercontent.com/u/2664412?v=4?s=100" width="100px;" alt=""/><br /><sub><b>LucaMarconato</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3ALucaMarconato" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://audiobox.fm/"><img src="https://avatars.githubusercontent.com/u/12844?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Kain</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Amasterkain" title="Bug reports">🐛</a></td>
    <td align="center"><a href="http://duro.me/"><img src="https://avatars.githubusercontent.com/u/1498061?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Andi Andreas</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3ANexuist" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/qigj"><img src="https://avatars.githubusercontent.com/u/56585735?v=4?s=100" width="100px;" alt=""/><br /><sub><b>qigj</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Aqigj" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/shuaiyy"><img src="https://avatars.githubusercontent.com/u/19821321?v=4?s=100" width="100px;" alt=""/><br /><sub><b>shuaiyy</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Ashuaiyy" title="Bug reports">🐛</a></td>
    <td align="center"><a href="https://github.com/v20z"><img src="https://avatars.githubusercontent.com/u/2884824?v=4?s=100" width="100px;" alt=""/><br /><sub><b>v20z</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3Av20z" title="Bug reports">🐛</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/Yann-Qiu"><img src="https://avatars.githubusercontent.com/u/56961747?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Yanfeng Qiu</b></sub></a><br /><a href="https://github.com/sorenisanerd/gotty/issues?q=author%3AYann-Qiu" title="Bug reports">🐛</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
