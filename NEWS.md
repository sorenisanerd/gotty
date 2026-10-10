##  v1.10.0 (2026-10-10)

* Fix the terminal hanging when the `rz` upload dialog is dismissed — Cancel,
  the ✕ button, Esc, or the backdrop. The ZMODEM session stayed open and
  `disableStdin` was never cleared, so the terminal stopped accepting input.
  Fixes #137.
* Fix the same freeze when the `sz` download dialog is dismissed, which left
  the incoming offer undeclined.
* Ask the browser to confirm before the page is closed or reloaded while a
  session is connected, so an accidental Ctrl+W doesn't silently drop the
  session. The guard is removed as soon as the connection closes, so exiting
  the shell (e.g. with Ctrl-D) still closes the tab without a prompt. Enabled
  by default; pass `--confirm-close=false` to disable. Fixes #142. Thanks,
  @iTrooz, for the suggestion.
* Fix the display settings picker's font handling. Changing the font size or
  family now re-fits the terminal to the window instead of leaving it
  overflowing the edge, and a restored preference is re-fitted on load too.
  Font families that are not installed are now marked "not installed" instead
  of silently falling back to monospace when selected.
* Refresh the JavaScript toolchain — TypeScript 7 with the type check split
  out of the bundler, preact 11, and the remaining `npm audit` advisories
  cleared. Also drop `react-bootstrap`, which nothing imported.

##  v1.9.0 (2026-10-08)

* Fix `sz` file download. `Browser` was imported from the `zmodem.js` package
  root, which does not export it, so the download failed with
  `Browser.save_to_disk is not a function`. Fixes #136. (#167)
* Add `preferences { alt_is_meta = true }` — restores hterm's Alt-as-Meta key
  behavior for Emacs users. Fixes #44.
* Support binding to multiple interfaces via a comma-separated address list.
* Add OSC 52 clipboard support, so selecting text in the terminal copies it to
  the local clipboard. Thanks, @tastypear! (#156)
* Return HTTP 503 instead of hanging when a connection is refused because the
  `--max-connection` limit is reached. Thanks, @VXNCXNX! (#155)
* Refresh and harden the JavaScript toolchain dependencies, clearing several
  open security advisories.
* CI: the Docker pre-release workflow no longer runs on Dependabot branch
  pushes, and the pull-request test gate watches the `main` branch instead of
  the non-existent `master`. (#157)

##  v1.8.0 (2026-05-24)

* Add sixel graphics support via xterm-addon-image. Thanks, @a2800276!
* Add server-side WebSocket Ping/Pong to prevent idle disconnects.
* Fix a WebSocket write deadline that caused ~45s disconnections.
* Improve terminal rendering of box-drawing characters and custom fonts.
  Thanks, @artile!
* Add better embedding support. Thanks, @pancsta!
* Handle missing terminal preferences and apply them before xterm opens.
  Thanks, @euisuh!
* Fix emoji / character-width spacing in Chrome (Unicode 11).
  Thanks, @WeaselScience!
* Fix ZMODEM protocol errors by catching and resetting the terminal state. (#46)
* Add custom favicon support. (#27)
* Add Dependabot configuration for Go modules, npm, and GitHub Actions.

##  v1.7.2 (2026-05-17)

* Fix the `default` theme not being applied on initial page load in a fresh browser.

##  v1.7.1 (2026-05-14)

* Fix non-constant format string vet errors in `fmt.Errorf` and `log.Printf`.
* Fix SASS 1.8 requiring full paths, and refresh the JS dependencies via
  `npm audit fix`. Thanks, @a2800276!

##  v1.7.0 (2026-05-13)

* Add runtime display picker — floating 🎨 button for live theme switching, font size adjustment, and font family selection, all persisted to localStorage.
* Add 6 built-in color themes: Catppuccin Mocha (default), Nord, Dracula, Solarized Dark, Monokai, Light — configurable via `preferences { theme = "name" }`.
* Add font size picker with preset buttons (10–24 px) and config support via `preferences { font_size = N }`.
* Add font family picker with 8 monospace fonts and in-font preview, configurable via `preferences { font_family = "...' }`.
* Add color palette overrides via `preferences { color_palette_overrides = [...] }`.
* Add cursor style (`block`/`underline`/`bar`), cursor blink, and scrollback lines to preferences.
* Add Display Customization section to README documenting all new features.

##  v1.6.0 (2025-08-02)

* Add Docker build. Thanks, @callumgare!
* Add a workflow to check embedded bundle is up-to-date.
* Allow setting arguments (like, say, an auth token) to be added to ws:// url. Thanks @josegonzalez!
* Update Golang imports for newer ioutil. Thanks @180909!
* Fix buffer size for slave output. Thanks @funnywwh!
* Add `--pass-headers` option to set environment variables based on HTTP headers. Thanks @lukaszlach!

## 1.5.0 (2022-09-01)

* Add @ahmetb as a contributor ([276767a](https://github.com/sorenisanerd/gotty/commit/276767a))
* Add @CoconutMacaroon as a contributor ([74c1318](https://github.com/sorenisanerd/gotty/commit/74c1318))
* Add @DannyBen as a contributor ([fcfa161](https://github.com/sorenisanerd/gotty/commit/fcfa161))
* Add @dmartin as a contributor ([6b2ae89](https://github.com/sorenisanerd/gotty/commit/6b2ae89))
* Add @Fan-SJ as a contributor ([c2428c8](https://github.com/sorenisanerd/gotty/commit/c2428c8))
* Add @flechaig as a contributor ([2c4004d](https://github.com/sorenisanerd/gotty/commit/2c4004d))
* Add @George-NG as a contributor ([270ae45](https://github.com/sorenisanerd/gotty/commit/270ae45))
* Add @ghthor as a contributor ([1a6bccd](https://github.com/sorenisanerd/gotty/commit/1a6bccd))
* Add @jpillora as a contributor ([f52fbd7](https://github.com/sorenisanerd/gotty/commit/f52fbd7))
* Add @kaisawind as a contributor ([accff3a](https://github.com/sorenisanerd/gotty/commit/accff3a))
* Add @linyinli as a contributor ([8014af3](https://github.com/sorenisanerd/gotty/commit/8014af3))
* Add @LucaMarconato as a contributor ([3bd9836](https://github.com/sorenisanerd/gotty/commit/3bd9836))
* Add @masterkain as a contributor ([369e2f7](https://github.com/sorenisanerd/gotty/commit/369e2f7))
* Add @Nexuist as a contributor ([ca691bc](https://github.com/sorenisanerd/gotty/commit/ca691bc))
* Add @qigj as a contributor ([5a052e7](https://github.com/sorenisanerd/gotty/commit/5a052e7))
* Add @shuaiyy as a contributor ([95e1bbd](https://github.com/sorenisanerd/gotty/commit/95e1bbd))
* Add @v20z as a contributor ([d594bef](https://github.com/sorenisanerd/gotty/commit/d594bef))
* Add @xgdgsc as a contributor ([c197990](https://github.com/sorenisanerd/gotty/commit/c197990))
* Add @Yann-Qiu as a contributor ([7b994ec](https://github.com/sorenisanerd/gotty/commit/7b994ec))
* Update @flechaig as a contributor ([9877e9c](https://github.com/sorenisanerd/gotty/commit/9877e9c))
* Update @flechaig as a contributor ([e03ea9c](https://github.com/sorenisanerd/gotty/commit/e03ea9c))
* Update @prusnak as a contributor ([3c45888](https://github.com/sorenisanerd/gotty/commit/3c45888))
* Update @prusnak as a contributor ([8d7f5fc](https://github.com/sorenisanerd/gotty/commit/8d7f5fc))
* Update @sorenisanerd as a contributor ([34f516b](https://github.com/sorenisanerd/gotty/commit/34f516b))
* Update @sorenisanerd as a contributor ([89a04d1](https://github.com/sorenisanerd/gotty/commit/89a04d1))
* Update @xgdgsc as a contributor ([b3c5d03](https://github.com/sorenisanerd/gotty/commit/b3c5d03))
* Update @xgdgsc as a contributor ([09f7e95](https://github.com/sorenisanerd/gotty/commit/09f7e95))
* Add make target to add contributors ([1bbfd5e](https://github.com/sorenisanerd/gotty/commit/1bbfd5e))
* Add missing import "strings" ([d0e3ffb](https://github.com/sorenisanerd/gotty/commit/d0e3ffb))
* add slash ([7706bf2](https://github.com/sorenisanerd/gotty/commit/7706bf2))
* Always disable CGO ([7a96f37](https://github.com/sorenisanerd/gotty/commit/7a96f37)), closes [#39](https://github.com/sorenisanerd/gotty/issues/39)
* Bump terser from 5.12.1 to 5.14.2 in /js ([3ae13e0](https://github.com/sorenisanerd/gotty/commit/3ae13e0))
* Create a release when a new tag is pushed ([d8fe975](https://github.com/sorenisanerd/gotty/commit/d8fe975))
* Ensure --quiet flag is honored ([7d431a7](https://github.com/sorenisanerd/gotty/commit/7d431a7)), closes [#45](https://github.com/sorenisanerd/gotty/issues/45)
* Refresh dependencies, drop node-sass ([94e5873](https://github.com/sorenisanerd/gotty/commit/94e5873))
* Run tests on pull requests ([316d5ff](https://github.com/sorenisanerd/gotty/commit/316d5ff))


## 1.4.0 (2022-05-30)

*  Add @hardliner66 as a contributor ([1ca998e](https://github.com/sorenisanerd/gotty/commit/1ca998e))
*  Add @jkandasa as a contributor ([cd23910](https://github.com/sorenisanerd/gotty/commit/cd23910))
* Add backend tests ([603c650](https://github.com/sorenisanerd/gotty/commit/603c650))
* Add generated data to git ([a9fbc07](https://github.com/sorenisanerd/gotty/commit/a9fbc07))
* add quiet flag to disable logging ([4109b11](https://github.com/sorenisanerd/gotty/commit/4109b11))
* Add references to @yudai ([bffd821](https://github.com/sorenisanerd/gotty/commit/bffd821)), closes [#8](https://github.com/sorenisanerd/gotty/issues/8)
* Add rule to build gotty.js.map ([82c3acf](https://github.com/sorenisanerd/gotty/commit/82c3acf))
* Apply font size and family in xterm ([f157dbe](https://github.com/sorenisanerd/gotty/commit/f157dbe)), closes [#21](https://github.com/sorenisanerd/gotty/issues/21)
* Avoid HTTP 401 error on manifest.json due to CORS ([817b5c8](https://github.com/sorenisanerd/gotty/commit/817b5c8))
* Bump browserslist from 4.16.4 to 4.16.6 in /js ([8deba62](https://github.com/sorenisanerd/gotty/commit/8deba62))
* Disable arg passing by default ([5c8eb10](https://github.com/sorenisanerd/gotty/commit/5c8eb10)), closes [#17](https://github.com/sorenisanerd/gotty/issues/17)
* Do not include ALL of bootstrap ([b63ea16](https://github.com/sorenisanerd/gotty/commit/b63ea16))
* Ensure defaults for booleans is set correctly ([28f8e61](https://github.com/sorenisanerd/gotty/commit/28f8e61)), closes [#16](https://github.com/sorenisanerd/gotty/issues/16)
* Fix existing tests ([d674aa1](https://github.com/sorenisanerd/gotty/commit/d674aa1)), closes [#13](https://github.com/sorenisanerd/gotty/issues/13)
* Fix warnings from Markdown linter ([aa86a34](https://github.com/sorenisanerd/gotty/commit/aa86a34))
* go fmt ([dcb153c](https://github.com/sorenisanerd/gotty/commit/dcb153c))
* Improve webtty test coverage ([f61763f](https://github.com/sorenisanerd/gotty/commit/f61763f))
* Make client request base64 encoding ([dd3603c](https://github.com/sorenisanerd/gotty/commit/dd3603c))
* Make sure we read the full message ([1eed97f](https://github.com/sorenisanerd/gotty/commit/1eed97f))
* Publish artifacts on push to master ([6c62ab7](https://github.com/sorenisanerd/gotty/commit/6c62ab7))
* Remove hterm ([163fd05](https://github.com/sorenisanerd/gotty/commit/163fd05))
* Run tests on push ([55674f1](https://github.com/sorenisanerd/gotty/commit/55674f1))
* Run tests on push to all branches ([679a324](https://github.com/sorenisanerd/gotty/commit/679a324))
* update go version in Dockerfile ([fd2fb99](https://github.com/sorenisanerd/gotty/commit/fd2fb99))
* Update js dependencies ([26fc412](https://github.com/sorenisanerd/gotty/commit/26fc412))
* Update xterm.js and other js libs ([81afdc7](https://github.com/sorenisanerd/gotty/commit/81afdc7)), closes [#18](https://github.com/sorenisanerd/gotty/issues/18)
* Use bootstrap components for up- and downloads ([7f05f2f](https://github.com/sorenisanerd/gotty/commit/7f05f2f))
* Use Go's built-in embed mechanism ([f66f0d0](https://github.com/sorenisanerd/gotty/commit/f66f0d0)), closes [#7](https://github.com/sorenisanerd/gotty/issues/7)
* feat(zmodem): Allow file uploads/downloads ([782991c](https://github.com/sorenisanerd/gotty/commit/782991c))



## v1.3.0

* Links in the tty are now clickable.
* Use WebGL for rendering by default.
* Ensure authentication (TLS or Basic auth) remain enabled even if some of the options are only given in config files Thanks, @devanlai!
* Fix typo in README.md Thanks, @prusnak!
* Add arm64/Linux build. Thanks for the suggestion, @nephaste!

## v1.2.0

* Pass BUILD\_OPTIONS to gox, too, so release artifacts have version info included.
* Update xterm.js 2.7.0 => 4.11.0
* Lots of clean up.

## v1.1.0

* Today I learned about Go's handling of versions, so re-releasing 2.1.0 as 1.1.0.
* Added path option. Thanks, @apatil!

## v2.1.0 (whoops)

* Use Go modules and update cli module import path. Thanks, @svanellewee!
* Fix typos. Thanks, @0xflotus, @RealCyGuy, @ygit, @Jason-Cooke and @fredster33!
* Fix printing of ipv6 addresses. Thanks, @Felixoid!
* Add Progressive Web App support. Thanks, @sehaas!
* Add instructions for GNU screen. Thanks, @Immortalin!
* Add Solaris support. Thanks, @fazalmajid!
* New maintainer: @sorenisanerd
